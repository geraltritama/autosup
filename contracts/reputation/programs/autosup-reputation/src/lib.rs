use anchor_lang::prelude::*;

declare_id!("RePuT8qDgLFk3zG4kJBNFNhRaBmxVmgh5xBoRmM4V2m");

/// ─── Constants ──────────────────────────────────────────────────────────────

const REPUTATION_SEED: &[u8] = b"reputation";

/// Reputation score range: 0–100
const MAX_SCORE: u8 = 100;

/// ─── Role ────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EntityRole {
    Supplier,
    Distributor,
    Retailer,
}

/// ─── Reputation Account ──────────────────────────────────────────────────────

#[account]
pub struct Reputation {
    /// The entity being rated (pubkey of supplier/distributor/retailer)
    pub entity: Pubkey,
    /// The role of this entity
    pub role: EntityRole,
    /// Composite reputation score (0–100)
    pub score: u8,
    /// Fulfillment rate (0.0–1.0 stored as u8 percentage)
    pub fulfillment_rate: u8,
    /// Payment punctuality (0.0–1.0 stored as u8 percentage)
    pub payment_punctuality: u8,
    /// On-time delivery rate (0.0–1.0 stored as u8 percentage)
    pub on_time_delivery_rate: u8,
    /// Average delivery days (stored as u8, max 255)
    pub avg_delivery_days: u8,
    /// Total transactions counted
    pub total_transactions: u32,
    /// Number of positive feedbacks
    pub positive_feedbacks: u32,
    /// Number of negative feedbacks
    pub negative_feedbacks: u32,
    /// Timestamp of last update
    pub last_updated: i64,
    /// Version counter for this reputation record
    pub version: u16,
    /// Bump seed
    pub bump: u8,
}

/// ─── Instructions ────────────────────────────────────────────────────────────

#[program]
pub mod autosup_reputation {

    use super::*;

    /// Initialize a reputation record for a new entity.
    /// Only the authority (backend oracle) can create reputation records.
    pub fn initialize_reputation(
        ctx: Context<InitializeReputation>,
        role: u8,
    ) -> Result<()> {
        let role = match role {
            0 => EntityRole::Supplier,
            1 => EntityRole::Distributor,
            2 => EntityRole::Retailer,
            _ => return Err(ReputationError::InvalidRole.into()),
        };

        let reputation = &mut ctx.accounts.reputation;
        reputation.entity = ctx.accounts.entity.key();
        reputation.role = role;
        reputation.score = 50; // neutral starting score
        reputation.fulfillment_rate = 0;
        reputation.payment_punctuality = 0;
        reputation.on_time_delivery_rate = 0;
        reputation.avg_delivery_days = 0;
        reputation.total_transactions = 0;
        reputation.positive_feedbacks = 0;
        reputation.negative_feedbacks = 0;
        reputation.last_updated = Clock::get()?.unix_timestamp;
        reputation.version = 1;
        reputation.bump = ctx.bumps.reputation;

        emit!(ReputationInitialized {
            entity: reputation.entity,
            initial_score: reputation.score,
            last_updated: reputation.last_updated,
        });

        Ok(())
    }

    /// Update reputation metrics for an entity.
    ///
    /// Only the authority (backend oracle) can update reputation.
    /// The composite score is computed:
    ///   score = (fulfillment_rate * 0.35) + (payment_punctuality * 0.25)
    ///         + (on_time_delivery_rate * 0.25) + (positive_ratio * 0.15)
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        fulfillment_rate: u8,
        payment_punctuality: u8,
        on_time_delivery_rate: u8,
        avg_delivery_days: u8,
        total_transactions: u32,
        positive_feedbacks: u32,
        negative_feedbacks: u32,
    ) -> Result<()> {
        let reputation = &mut ctx.accounts.reputation;

        // Validate inputs
        require!(fulfillment_rate <= 100, ReputationError::InvalidRate);
        require!(payment_punctuality <= 100, ReputationError::InvalidRate);
        require!(on_time_delivery_rate <= 100, ReputationError::InvalidRate);

        reputation.fulfillment_rate = fulfillment_rate;
        reputation.payment_punctuality = payment_punctuality;
        reputation.on_time_delivery_rate = on_time_delivery_rate;
        reputation.avg_delivery_days = avg_delivery_days;
        reputation.total_transactions = total_transactions;
        reputation.positive_feedbacks = positive_feedbacks;
        reputation.negative_feedbacks = negative_feedbacks;

        // ── Compute composite score ────────────────────────────────────────

        let total_feedback = positive_feedbacks.saturating_add(negative_feedbacks);
        let positive_ratio: u8 = if total_feedback > 0 {
            ((positive_feedbacks as u64 * 100) / total_feedback as u64) as u8
        } else {
            50 // neutral if no feedback
        };

        let score = ((fulfillment_rate as u64 * 35)
            + (payment_punctuality as u64 * 25)
            + (on_time_delivery_rate as u64 * 25)
            + (positive_ratio as u64 * 15))
            / 100;

        reputation.score = score.min(MAX_SCORE as u64) as u8;
        reputation.last_updated = Clock::get()?.unix_timestamp;
        reputation.version = reputation.version.saturating_add(1);

        emit!(ReputationUpdated {
            entity: reputation.entity,
            new_score: reputation.score,
            fulfillment_rate,
            payment_punctuality,
            on_time_delivery_rate,
            total_transactions,
            version: reputation.version,
            last_updated: reputation.last_updated,
        });

        Ok(())
    }

    /// Submit a feedback for an entity (positive or negative).
    /// This increments the respective counter. In a real implementation,
    /// you'd add deduplication logic (one feedback per order/entity pair).
    pub fn submit_feedback(
        ctx: Context<SubmitFeedback>,
        is_positive: bool,
    ) -> Result<()> {
        let reputation = &mut ctx.accounts.reputation;

        if is_positive {
            reputation.positive_feedbacks = reputation.positive_feedbacks.saturating_add(1);
        } else {
            reputation.negative_feedbacks = reputation.negative_feedbacks.saturating_add(1);
        }

        reputation.last_updated = Clock::get()?.unix_timestamp;
        reputation.version = reputation.version.saturating_add(1);

        emit!(FeedbackSubmitted {
            entity: reputation.entity,
            is_positive,
            positive_feedbacks: reputation.positive_feedbacks,
            negative_feedbacks: reputation.negative_feedbacks,
        });

        Ok(())
    }
}

/// ─── Contexts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct InitializeReputation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The entity being rated
    /// CHECK: only stored as pubkey; no account data access required
    pub entity: UncheckedAccount<'info>,

    /// Reputation PDA for this entity
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1 + 1 + 1 + 1 + 1 + 1 + 4 + 4 + 4 + 8 + 2 + 1,
        seeds = [
            REPUTATION_SEED,
            entity.key().as_ref(),
        ],
        bump,
    )]
    pub reputation: Account<'info, Reputation>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    /// Only the authority can update reputation
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The reputation record to update
    #[account(
        mut,
        seeds = [
            REPUTATION_SEED,
            reputation.entity.as_ref(),
        ],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, Reputation>,
}

#[derive(Accounts)]
pub struct SubmitFeedback<'info> {
    /// Any user can submit feedback
    pub submitter: Signer<'info>,

    /// The reputation record for the rated entity
    #[account(
        mut,
        seeds = [
            REPUTATION_SEED,
            reputation.entity.as_ref(),
        ],
        bump = reputation.bump,
    )]
    pub reputation: Account<'info, Reputation>,
}

/// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct ReputationInitialized {
    pub entity: Pubkey,
    pub initial_score: u8,
    pub last_updated: i64,
}

#[event]
pub struct ReputationUpdated {
    pub entity: Pubkey,
    pub new_score: u8,
    pub fulfillment_rate: u8,
    pub payment_punctuality: u8,
    pub on_time_delivery_rate: u8,
    pub total_transactions: u32,
    pub version: u16,
    pub last_updated: i64,
}

#[event]
pub struct FeedbackSubmitted {
    pub entity: Pubkey,
    pub is_positive: bool,
    pub positive_feedbacks: u32,
    pub negative_feedbacks: u32,
}

/// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum ReputationError {
    #[msg("Invalid entity role (0=supplier, 1=distributor, 2=retailer)")]
    InvalidRole,
    #[msg("Rate must be between 0 and 100")]
    InvalidRate,
    #[msg("Unauthorized: only the reputation authority can update")]
    Unauthorized,
}

/// ─── Re-exports ──────────────────────────────────────────────────────────────

use anchor_lang::solana_program::clock::Clock;
