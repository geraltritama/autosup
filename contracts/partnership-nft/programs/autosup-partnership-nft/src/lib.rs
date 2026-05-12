use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use solana_program::pubkey::Pubkey;

declare_id!("FNjMqtcKX6H2VdTxk2qtW7UZyGhJwjEC7DvHbWDY3Zfi");

/// ─── Constants ──────────────────────────────────────────────────────────────

const PARTNERSHIP_MINT_SEED: &[u8] = b"partnership-mint";
const PARTNERSHIP_TOKEN_SEED: &[u8] = b"partnership-token";

/// ─── Partnership Role ────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PartnershipRole {
    Supplier,
    Distributor,
    Retailer,
}

/// ─── Partnership Status ──────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum PartnershipStatus {
    Active,
    Revoked,
}

/// ─── Retailer Tier ───────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RetailerTier {
    Bronze,
    Silver,
    Gold,
}

/// ─── Partnership NFT Account ─────────────────────────────────────────────────

#[account]
pub struct PartnershipNFT {
    pub authority: Pubkey,
    pub supplier: Pubkey,
    pub distributor: Pubkey,
    pub retailer: Option<Pubkey>,
    pub role: PartnershipRole,
    pub status: PartnershipStatus,
    pub retailer_tier: Option<RetailerTier>,
    pub terms: String,                   // max 256 bytes
    pub legal_contract_hash: [u8; 32],   // SHA-256 of MoU PDF
    pub valid_until: i64,                // 0 = no expiry
    pub distribution_region: String,     // max 64 bytes
    pub issued_at: i64,
    pub revoked_at: Option<i64>,
    pub bump: u8,
}

/// ─── Instructions ────────────────────────────────────────────────────────────

#[program]
pub mod autosup_partnership_nft {

    use super::*;

    /// Mint a soulbound supplier→distributor partnership NFT.
    pub fn mint_partnership(
        ctx: Context<MintPartnership>,
        role: u8,
        terms: String,
        legal_contract_hash: [u8; 32],
        valid_until: i64,
        distribution_region: String,
    ) -> Result<()> {
        require!(terms.len() <= 256, PartnershipError::TermsTooLong);
        require!(distribution_region.len() <= 64, PartnershipError::RegionTooLong);

        let supplier = ctx.accounts.supplier_account.key();
        let distributor = ctx.accounts.distributor_account.key();

        let role_enum = match role {
            0 => PartnershipRole::Supplier,
            1 => PartnershipRole::Distributor,
            2 => PartnershipRole::Retailer,
            _ => return Err(PartnershipError::InvalidRole.into()),
        };

        let partnership = &mut ctx.accounts.partnership;
        partnership.authority = ctx.accounts.authority.key();
        partnership.supplier = supplier;
        partnership.distributor = distributor;
        partnership.retailer = None;
        partnership.role = role_enum;
        partnership.status = PartnershipStatus::Active;
        partnership.retailer_tier = None;
        partnership.terms = terms;
        partnership.legal_contract_hash = legal_contract_hash;
        partnership.valid_until = valid_until;
        partnership.distribution_region = distribution_region;
        partnership.issued_at = Clock::get()?.unix_timestamp;
        partnership.revoked_at = None;
        partnership.bump = ctx.bumps.partnership;

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        mint_to(cpi_ctx, 1)?;

        emit!(PartnershipMinted {
            authority: ctx.accounts.authority.key(),
            supplier,
            distributor,
            issued_at: partnership.issued_at,
        });

        Ok(())
    }

    /// Mint distributor→retailer partnership NFT with hierarchy validation.
    pub fn mint_retailer_partnership(
        ctx: Context<MintRetailerPartnership>,
        terms: String,
        legal_contract_hash: [u8; 32],
        valid_until: i64,
        distribution_region: String,
        tier: u8,
    ) -> Result<()> {
        let distributor = ctx.accounts.distributor_account.key();
        let retailer = ctx.accounts.retailer_account.key();

        require!(
            ctx.accounts.parent_partnership.status == PartnershipStatus::Active,
            PartnershipError::ParentPartnershipNotActive
        );
        require!(
            ctx.accounts.parent_partnership.distributor == distributor,
            PartnershipError::DistributorMismatch
        );
        require!(terms.len() <= 256, PartnershipError::TermsTooLong);
        require!(distribution_region.len() <= 64, PartnershipError::RegionTooLong);

        let tier = match tier {
            0 => RetailerTier::Bronze,
            1 => RetailerTier::Silver,
            2 => RetailerTier::Gold,
            _ => return Err(PartnershipError::InvalidTier.into()),
        };

        let supplier = ctx.accounts.supplier_account.key();

        let partnership = &mut ctx.accounts.partnership;
        partnership.authority = ctx.accounts.authority.key();
        partnership.supplier = supplier;
        partnership.distributor = distributor;
        partnership.retailer = Some(retailer);
        partnership.role = PartnershipRole::Retailer;
        partnership.status = PartnershipStatus::Active;
        partnership.retailer_tier = Some(tier);
        partnership.terms = terms;
        partnership.legal_contract_hash = legal_contract_hash;
        partnership.valid_until = valid_until;
        partnership.distribution_region = distribution_region;
        partnership.issued_at = Clock::get()?.unix_timestamp;
        partnership.revoked_at = None;
        partnership.bump = ctx.bumps.partnership;

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        mint_to(cpi_ctx, 1)?;

        emit!(RetailerPartnershipMinted {
            authority: ctx.accounts.authority.key(),
            distributor,
            retailer,
            tier: tier as u8,
            issued_at: partnership.issued_at,
        });

        Ok(())
    }

    /// Update retailer tier (Bronze/Silver/Gold) — issuer only.
    pub fn update_retailer_tier(ctx: Context<UpdateTier>, new_tier: u8) -> Result<()> {
        let partnership = &mut ctx.accounts.partnership;
        require!(
            partnership.authority == ctx.accounts.authority.key(),
            PartnershipError::Unauthorized
        );
        require!(
            partnership.retailer.is_some(),
            PartnershipError::NotRetailerPartnership
        );
        require!(
            partnership.status == PartnershipStatus::Active,
            PartnershipError::PartnershipNotActive
        );

        let tier = match new_tier {
            0 => RetailerTier::Bronze,
            1 => RetailerTier::Silver,
            2 => RetailerTier::Gold,
            _ => return Err(PartnershipError::InvalidTier.into()),
        };

        partnership.retailer_tier = Some(tier);

        emit!(TierUpdated {
            authority: ctx.accounts.authority.key(),
            retailer: partnership.retailer.unwrap(),
            tier: new_tier,
        });

        Ok(())
    }

    /// Revoke an active partnership (state change, token stays in wallet).
    pub fn revoke_partnership(ctx: Context<RevokePartnership>) -> Result<()> {
        let partnership = &mut ctx.accounts.partnership;
        require!(
            partnership.status == PartnershipStatus::Active,
            PartnershipError::AlreadyRevoked
        );
        require!(
            partnership.authority == ctx.accounts.authority.key(),
            PartnershipError::Unauthorized
        );

        partnership.status = PartnershipStatus::Revoked;
        partnership.revoked_at = Some(Clock::get()?.unix_timestamp);

        emit!(PartnershipRevoked {
            authority: ctx.accounts.authority.key(),
            supplier: partnership.supplier,
            distributor: partnership.distributor,
            revoked_at: partnership.revoked_at.unwrap(),
        });

        Ok(())
    }

    /// Verify a partnership is active (read-only).
    pub fn verify_partnership(ctx: Context<VerifyPartnership>) -> Result<()> {
        let partnership = &ctx.accounts.partnership;
        require!(
            partnership.status == PartnershipStatus::Active,
            PartnershipError::PartnershipNotActive
        );
        Ok(())
    }
}

/// ─── Contexts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(role: u8)]
pub struct MintPartnership<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Supplier — pubkey used in PDA seed
    pub supplier_account: AccountInfo<'info>,

    /// CHECK: Distributor — pubkey used in PDA seed and receives the soulbound token
    pub distributor_account: AccountInfo<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 33 + 1 + 2 + 1 + 260 + 32 + 8 + 68 + 8 + 9 + 1,
        seeds = [
            PARTNERSHIP_MINT_SEED,
            supplier_account.key().as_ref(),
            distributor_account.key().as_ref(),
            &[role],
        ],
        bump,
    )]
    pub partnership: Box<Account<'info, PartnershipNFT>>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        seeds = [
            PARTNERSHIP_TOKEN_SEED,
            supplier_account.key().as_ref(),
            distributor_account.key().as_ref(),
            &[role],
        ],
        bump,
    )]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = distributor_account,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintRetailerPartnership<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Supplier — pubkey for parent PDA seed lookup
    pub supplier_account: AccountInfo<'info>,

    /// CHECK: Distributor — pubkey for parent PDA seed and new PDA seed
    pub distributor_account: AccountInfo<'info>,

    /// CHECK: Retailer — pubkey for new PDA seed and receives token
    pub retailer_account: AccountInfo<'info>,

    #[account(
        seeds = [
            PARTNERSHIP_MINT_SEED,
            supplier_account.key().as_ref(),
            distributor_account.key().as_ref(),
            &[0_u8],
        ],
        bump,
    )]
    pub parent_partnership: Box<Account<'info, PartnershipNFT>>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 33 + 1 + 2 + 1 + 260 + 32 + 8 + 68 + 8 + 9 + 1,
        seeds = [
            PARTNERSHIP_MINT_SEED,
            distributor_account.key().as_ref(),
            retailer_account.key().as_ref(),
            &[2_u8],
        ],
        bump,
    )]
    pub partnership: Box<Account<'info, PartnershipNFT>>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        seeds = [
            PARTNERSHIP_TOKEN_SEED,
            distributor_account.key().as_ref(),
            retailer_account.key().as_ref(),
            &[2_u8],
        ],
        bump,
    )]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = retailer_account,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateTier<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub partnership: Account<'info, PartnershipNFT>,
}

#[derive(Accounts)]
pub struct RevokePartnership<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub partnership: Account<'info, PartnershipNFT>,
}

#[derive(Accounts)]
pub struct VerifyPartnership<'info> {
    pub partnership: Account<'info, PartnershipNFT>,
}

/// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct PartnershipMinted {
    pub authority: Pubkey,
    pub supplier: Pubkey,
    pub distributor: Pubkey,
    pub issued_at: i64,
}

#[event]
pub struct RetailerPartnershipMinted {
    pub authority: Pubkey,
    pub distributor: Pubkey,
    pub retailer: Pubkey,
    pub tier: u8,
    pub issued_at: i64,
}

#[event]
pub struct TierUpdated {
    pub authority: Pubkey,
    pub retailer: Pubkey,
    pub tier: u8,
}

#[event]
pub struct PartnershipRevoked {
    pub authority: Pubkey,
    pub supplier: Pubkey,
    pub distributor: Pubkey,
    pub revoked_at: i64,
}

/// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum PartnershipError {
    #[msg("Terms string must be 256 bytes or less")]
    TermsTooLong,
    #[msg("Distribution region must be 64 bytes or less")]
    RegionTooLong,
    #[msg("Invalid partnership role (0=supplier, 1=distributor, 2=retailer)")]
    InvalidRole,
    #[msg("Invalid tier (0=Bronze, 1=Silver, 2=Gold)")]
    InvalidTier,
    #[msg("Only the authority can perform this action")]
    Unauthorized,
    #[msg("Partnership has already been revoked")]
    AlreadyRevoked,
    #[msg("Partnership is not active")]
    PartnershipNotActive,
    #[msg("Parent supplier→distributor partnership is not active (hierarchy violation)")]
    ParentPartnershipNotActive,
    #[msg("Distributor in parent partnership does not match")]
    DistributorMismatch,
    #[msg("This partnership is not a retailer partnership (no retailer assigned)")]
    NotRetailerPartnership,
}

use anchor_lang::solana_program::clock::Clock;
