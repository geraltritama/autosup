import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AutosupReputation } from "../target/types/autosup_reputation";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

describe("autosup-reputation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .AutosupReputation as Program<AutosupReputation>;

  const authority = (provider.wallet as anchor.Wallet).payer;
  const entity = anchor.web3.Keypair.generate();

  let reputationPda: PublicKey;

  before(async () => {
    [reputationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), entity.publicKey.toBuffer()],
      program.programId,
    );
  });

  it("Initializes a reputation record", async () => {
    const role = 0; // supplier

    await program.methods
      .initializeReputation(role)
      .accounts({
        authority: authority.publicKey,
        entity: entity.publicKey,
        reputation: reputationPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const reputation = await program.account.reputation.fetch(reputationPda);
    assert.equal(reputation.entity.toBase58(), entity.publicKey.toBase58());
    assert.equal(reputation.score, 50);
    assert.equal(reputation.version, 1);
    assert.ok(reputation.role.supplier);
  });

  it("Updates reputation metrics", async () => {
    await program.methods
      .updateReputation(
        95,  // fulfillment_rate
        92,  // payment_punctuality
        88,  // on_time_delivery_rate
        2,   // avg_delivery_days
        150, // total_transactions
        140, // positive_feedbacks
        10,  // negative_feedbacks
      )
      .accounts({
        authority: authority.publicKey,
        reputation: reputationPda,
      })
      .rpc();

    const reputation = await program.account.reputation.fetch(reputationPda);
    assert.equal(reputation.fulfillmentRate, 95);
    assert.equal(reputation.paymentPunctuality, 92);
    assert.equal(reputation.totalTransactions, 150);
    assert.equal(reputation.version, 2);

    // Expected: (95*35 + 92*25 + 88*25 + 93*15) / 100
    // = (3325 + 2300 + 2200 + 1395) / 100 = 9220/100 = 92 (floor)
    assert.isAtLeast(reputation.score, 90);
  });

  it("Submits positive feedback", async () => {
    const before = await program.account.reputation.fetch(reputationPda);
    const prev = before.positiveFeedbacks;

    await program.methods
      .submitFeedback(true)
      .accounts({
        submitter: authority.publicKey,
        reputation: reputationPda,
      })
      .rpc();

    const after = await program.account.reputation.fetch(reputationPda);
    assert.equal(after.positiveFeedbacks, prev + 1);
  });

  it("Submits negative feedback", async () => {
    await program.methods
      .submitFeedback(false)
      .accounts({
        submitter: authority.publicKey,
        reputation: reputationPda,
      })
      .rpc();

    const reputation = await program.account.reputation.fetch(reputationPda);
    assert.equal(reputation.negativeFeedbacks, 1);
    assert.equal(reputation.version, 4);
  });

  it("Fails to update with invalid rate", async () => {
    try {
      await program.methods
        .updateReputation(101, 50, 50, 1, 0, 0, 0)
        .accounts({
          authority: authority.publicKey,
          reputation: reputationPda,
        })
        .rpc();
      assert.fail("Expected error for rate > 100");
    } catch (err) {
      assert.include(err.toString(), "InvalidRate");
    }
  });
});
