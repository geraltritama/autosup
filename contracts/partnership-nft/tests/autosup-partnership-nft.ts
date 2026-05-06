import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AutosupPartnershipNft } from "../target/types/autosup_partnership_nft";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("autosup-partnership-nft", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .AutosupPartnershipNft as Program<AutosupPartnershipNft>;

  const authority = (provider.wallet as anchor.Wallet).payer;
  const supplier = anchor.web3.Keypair.generate();
  const distributor = anchor.web3.Keypair.generate();

  const role = 0; // supplier

  let partnershipPda: PublicKey;
  let mintPda: PublicKey;

  before(async () => {
    const [pp] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("partnership-mint"),
        supplier.publicKey.toBuffer(),
        distributor.publicKey.toBuffer(),
        Buffer.from([role]),
      ],
      program.programId,
    );
    partnershipPda = pp;

    const [mp] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("partnership-token"),
        supplier.publicKey.toBuffer(),
        distributor.publicKey.toBuffer(),
        Buffer.from([role]),
      ],
      program.programId,
    );
    mintPda = mp;
  });

  it("Mints a partnership NFT", async () => {
    const terms = "Supply agreement — 30 day net payment, min order 50 units";

    const distributorAta = anchor.utils.token.associatedAddress({
      mint: mintPda,
      owner: distributor.publicKey,
    });

    const [metadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s").toBuffer(),
        mintPda.toBuffer(),
      ],
      new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"),
    );

    await program.methods
      .mintPartnership(
        supplier.publicKey,
        distributor.publicKey,
        null, // no retailer
        role,
        terms,
      )
      .accountsStrict({
        authority: authority.publicKey,
        partnership: partnershipPda,
        mint: mintPda,
        tokenAccount: distributorAta,
        metadata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: new PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
        ),
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    const partnership = await program.account.partnershipNft.fetch(
      partnershipPda,
    );
    assert.equal(partnership.authority.toBase58(), authority.publicKey.toBase58());
    assert.equal(partnership.supplier.toBase58(), supplier.publicKey.toBase58());
    assert.ok(partnership.status.active);
    assert.equal(partnership.terms, terms);
  });

  it("Revokes a partnership", async () => {
    await program.methods
      .revokePartnership()
      .accountsStrict({
        authority: authority.publicKey,
        partnership: partnershipPda,
      })
      .rpc();

    const partnership = await program.account.partnershipNft.fetch(
      partnershipPda,
    );
    assert.ok(partnership.status.revoked);
    assert.isNotNull(partnership.revokedAt);
  });

  it("Fails to verify a revoked partnership", async () => {
    try {
      await program.methods
        .verifyPartnership()
        .accountsStrict({
          partnership: partnershipPda,
        })
        .rpc();
      assert.fail("Expected error for revoked partnership");
    } catch (err) {
      assert.include(err.toString(), "PartnershipNotActive");
    }
  });
});
