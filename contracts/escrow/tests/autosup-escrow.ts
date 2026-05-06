import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AutosupEscrow } from "../target/types/autosup_escrow";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("autosup-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AutosoftEscrow as Program<AutosupEscrow>;

  const buyer = (provider.wallet as anchor.Wallet).payer;
  const seller = anchor.web3.Keypair.generate();

  // Create a fresh mint for each test run
  let usdcMint: PublicKey;
  let buyerAta: PublicKey;
  let sellerAta: PublicKey;
  let escrowPda: PublicKey;
  let vaultPda: PublicKey;

  const orderId = Buffer.from("ord-001-order-id-32-bytes-long!", "utf8");
  const depositAmount = new anchor.BN(1_000_000); // 1 USDC (6 decimals)

  before(async () => {
    usdcMint = await createMint(
      provider.connection,
      buyer,
      buyer.publicKey,
      null,
      6,
    );

    const buyerToken = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      buyer,
      usdcMint,
      buyer.publicKey,
    );
    buyerAta = buyerToken.address;

    const sellerToken = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      buyer,
      usdcMint,
      seller.publicKey,
    );
    sellerAta = sellerToken.address;

    await mintTo(
      provider.connection,
      buyer,
      usdcMint,
      buyerAta,
      buyer,
      depositAmount.toNumber() * 2,
    );

    [escrowPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        buyer.publicKey.toBuffer(),
        seller.publicKey.toBuffer(),
        orderId,
      ],
      program.programId,
    );

    [vaultPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow-vault"),
        buyer.publicKey.toBuffer(),
        seller.publicKey.toBuffer(),
        orderId,
      ],
      program.programId,
    );
  });

  it("Initializes an escrow", async () => {
    await program.methods
      .initialize([...orderId], depositAmount)
      .accountsStrict({
        buyer: buyer.publicKey,
        seller: seller.publicKey,
        mint: usdcMint,
        buyerTokenAccount: buyerAta,
        escrow: escrowPda,
        escrowVault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const escrow = await program.account.escrow.fetch(escrowPda);
    assert.equal(escrow.buyer.toBase58(), buyer.publicKey.toBase58());
    assert.equal(escrow.seller.toBase58(), seller.publicKey.toBase58());
    assert.isTrue(escrow.status.held);
    assert.isTrue(escrow.amount.eq(depositAmount));
  });

  it("Releases escrow to seller", async () => {
    await program.methods
      .release()
      .accountsStrict({
        authority: buyer.publicKey,
        escrow: escrowPda,
        escrowVault: vaultPda,
        sellerTokenAccount: sellerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    const escrow = await program.account.escrow.fetch(escrowPda);
    assert.isTrue(escrow.status.released);
    assert.isNotNull(escrow.settledAt);

    // Verify seller received funds
    const sellerBalance = await provider.connection.getTokenAccountBalance(
      sellerAta,
    );
    assert.equal(sellerBalance.value.uiAmount, 1);
  });

  it("Fails to release an already-released escrow", async () => {
    try {
      await program.methods
        .release()
        .accountsStrict({
          authority: buyer.publicKey,
          escrow: escrowPda,
          escrowVault: vaultPda,
          sellerTokenAccount: sellerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      assert.fail("Expected error for already-released escrow");
    } catch (err) {
      assert.include(err.toString(), "EscrowNotHeld");
    }
  });
});
