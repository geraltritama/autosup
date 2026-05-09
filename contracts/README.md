# AUTOSUP Smart Contracts (Solana / Anchor)

Three Anchor programs powering the AUTOSUP trust layer on Solana Devnet.

---

## Programs

| Workshop | Program ID (Devnet) | Purpose |
|----------|---------------------|---------|
| `partnership-nft/` | `5YNmS1R9nNSCDZB5P7F3YTvGRR1Px2JnyM7FQNHpdYSw` | **Soulbound Partnership NFT** — non-transferable token certifying supplier↔distributor↔retailer relationships |
| `escrow/` | `EsC3wXJYx4G8MgPkFUK3VHgJZP8eBUWH69LMnRSq1HRT` | **Smart Escrow** — holds SPL tokens (USDC) until order delivery confirmed, then releases to seller |
| `reputation/` | `RePuT8qDgLFk3zG4kJBNFNhRaBmxVmgh5xBoRmM4V2m` | **On-chain Reputation** — composite score (0–100) from fulfillment, payment, delivery, and feedback |

---

## Prerequisites

| Tool | Version |
|------|---------|
| [Rust](https://rustup.rs/) | 1.75+ |
| [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) | 1.18+ |
| [Anchor CLI](https://www.anchor-lang.com/docs/installation) | 0.30.1+ |
| [Node.js](https://nodejs.org/) | 18+ (for tests) |
| [Yarn](https://yarnpkg.com/) | 1.x (for tests) |

---

## Quick Start

```bash
# Configure Solana for devnet
solana config set --url devnet

# Build all programs
cd contracts/partnership-nft && anchor build
cd ../escrow && anchor build
cd ../reputation && anchor build

# Run tests (local validator)
cd contracts/partnership-nft && anchor test
cd ../escrow && anchor test
cd ../reputation && anchor test

# Deploy to devnet
cd contracts/partnership-nft && anchor deploy
cd ../escrow && anchor deploy
cd ../reputation && anchor deploy
```

---

## 1. Partnership NFT (Soulbound)

**Instructions:**

| Instruction | Description |
|-------------|-------------|
| `mint_partnership` | Mint a non-transferable NFT certifying partnership between entities |
| `revoke_partnership` | Revoke an active partnership (token stays in wallet, status flips) |
| `verify_partnership` | Read-only check that partnership is active |

**Account layout:**

| Field | Type | Description |
|-------|------|-------------|
| `authority` | Pubkey | Who minted this partnership |
| `supplier` | Pubkey | Supplier party |
| `distributor` | Pubkey | Distributor party |
| `retailer` | Option\<Pubkey\> | Retailer party (for dist→retail partnerships) |
| `role` | enum | `Supplier` / `Distributor` / `Retailer` |
| `status` | enum | `Active` / `Revoked` |
| `terms` | String (256) | Partnership terms summary |
| `issued_at` | i64 | Unix timestamp of issuance |
| `revoked_at` | Option\<i64\> | Unix timestamp of revocation |

**PDAs:**
- Mint: `partnership-token` + supplier + distributor + role
- Metadata: `metadata` + Metaplex PID + mint

---

## 2. Smart Escrow

**Instructions:**

| Instruction | Description |
|-------------|-------------|
| `initialize` | Buyer deposits tokens into escrow vault (status: `Held`) |
| `release` | Authority releases funds to seller (status: `Released`) |
| `refund` | Authority refunds funds to buyer (status: `Refunded`) |

**Account layout:**

| Field | Type | Description |
|-------|------|-------------|
| `buyer` | Pubkey | Buyer (depositor) |
| `seller` | Pubkey | Seller (payee) |
| `mint` | Pubkey | SPL token mint |
| `amount` | u64 | Amount held |
| `status` | enum | `Held` / `Released` / `Refunded` |
| `order_id` | [u8;32] | Linked order identifier |
| `created_at` | i64 | Init timestamp |
| `settled_at` | Option\<i64\> | Settlement timestamp |

**PDAs:**
- Escrow: `escrow` + buyer + seller + order_id
- Vault: `escrow-vault` + buyer + seller + order_id

---

## 3. On-chain Reputation

**Instructions:**

| Instruction | Description |
|-------------|-------------|
| `initialize_reputation` | Create reputation record (starts at 50) |
| `update_reputation` | Authority updates metrics and recomputes composite score |
| `submit_feedback` | Anyone submits positive/negative feedback |

**Composite Score Formula:**
```
score = (fulfillment_rate × 0.35) + (payment_punctuality × 0.25)
      + (on_time_delivery_rate × 0.25) + (positive_ratio × 0.15)
```

**Account layout:**

| Field | Type | Description |
|-------|------|-------------|
| `entity` | Pubkey | Rated entity |
| `role` | enum | `Supplier` / `Distributor` / `Retailer` |
| `score` | u8 | Composite reputation (0–100) |
| `fulfillment_rate` | u8 | Fulfillment % |
| `payment_punctuality` | u8 | Payment % |
| `on_time_delivery_rate` | u8 | Delivery % |
| `avg_delivery_days` | u8 | Avg delivery days |
| `total_transactions` | u32 | Transaction count |
| `positive_feedbacks` | u32 | Positive feedback count |
| `negative_feedbacks` | u32 | Negative feedback count |
| `version` | u16 | Version counter |

**PDA:** `reputation` + entity

---

## Integration with Backend

The backend (`backend/`) is responsible for:

1. **Partnership NFT** — calling `mint_partnership` when supplier/distributor accept a partnership request
2. **Smart Escrow** — calling `initialize` on order creation, `release` on delivery confirmation, `refund` on cancellation/dispute
3. **Reputation** — calling `update_reputation` periodically from aggregated metrics (fulfillment rate, payment history, delivery performance)

The frontend only surfaces results as badges, status chips, and explorer links — no wallet interaction required for end users.

---

## Security Model

| Concern | Approach |
|---------|----------|
| **Authority** | Backend-held keypair signs transactions; users do not hold keys |
| **Soulbound** | No transfer instruction exposed; token account has no close authority |
| **Escrow** | Only authority PDA can release/refund; buyers cannot withdraw unilaterally |
| **Reputation** | Only authority can update core metrics; anyone can submit feedback |
| **Devnet First** | All programs deploy to Solana Devnet during MVP phase |