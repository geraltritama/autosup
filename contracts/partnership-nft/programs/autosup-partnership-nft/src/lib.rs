use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        create_metadata_accounts_v3, mpl_token_metadata::types::DataV2, CreateMetadataAccountsV3,
        Metadata as Metaplex,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use solana_program::pubkey::Pubkey;

declare_id!("5YNmS1R9nNSCDZB5P7F3YTvGRR1Px2JnyM7FQNHpdYSw");

/// ─── Constants ──────────────────────────────────────────────────────────────

const PARTNERSHIP_MINT_SEED: &[u8] = b"partnership-mint";
const PARTNERSHIP_TOKEN_SEED: &[u8] = b"partnership-token";
const METADATA_SEED: &[u8] = b"metadata";

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

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum RetailerTier {
    Bronze,
    Silver,
    Gold,
}

/// ─── Partnership NFT Account (V2 — with tier + metadata) ────────────────────

#[account]
pub struct PartnershipNFT {
    pub authority: Pubkey,
    pub supplier: Pubkey,
    pub distributor: Pubkey,
    pub retailer: Option<Pubkey>,
    pub role: PartnershipRole,
    pub status: PartnershipStatus,
    pub retailer_tier: Option<RetailerTier>,
    pub terms: String,               // max 256 bytes
    pub legal_contract_hash: [u8; 32], // SHA-256 of MoU PDF
    pub valid_until: i64,            // 0 = no expiry
    pub distribution_region: String, // max 64 bytes
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
        supplier: Pubkey,
        distributor: Pubkey,
        retailer: Option<Pubkey>,
        role: u8,
        terms: String,
        legal_contract_hash: [u8; 32],
        valid_until: i64,
        distribution_region: String,
    ) -> Result<()> {
        require!(terms.len() <= 256, PartnershipError::TermsTooLong);
        require!(distribution_region.len() <= 64, PartnershipError::RegionTooLong);

        let role = match role {
            0 => PartnershipRole::Supplier,
            1 => PartnershipRole::Distributor,
            2 => PartnershipRole::Retailer,
            _ => return Err(PartnershipError::InvalidRole.into()),
        };

        let partnership = &mut ctx.accounts.partnership;
        partnership.authority = ctx.accounts.authority.key();
        partnership.supplier = supplier;
        partnership.distributor = distributor;
        partnership.retailer = retailer;
        partnership.role = role;
        partnership.status = PartnershipStatus::Active;
        partnership.retailer_tier = retailer.map(|_| RetailerTier::Bronze); // default tier
        partnership.terms = terms.clone();
        partnership.legal_contract_hash = legal_contract_hash;
        partnership.valid_until = valid_until;
        partnership.distribution_region = distribution_region.clone();
        partnership.issued_at = Clock::get()?.unix_timestamp;
        partnership.revoked_at = None;
        partnership.bump = ctx.bumps.partnership;

        // Mint exactly 1 soulbound token
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        mint_to(cpi_ctx, 1)?;

        // Attach Metaplex metadata
        let metadata_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.authority.to_account_info(),
            payer: ctx.accounts.authority.to_account_info(),
            update_authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        let name = format!("AUTOSUP-PARTNERSHIP-{}", partnership.issued_at);
        let uri = format!(
            "https://autosup.io/partnership-nft/{}",
            hex::encode(legal_contract_hash)
        );

        let data = DataV2 {
            name,
            symbol: "AUTOP".to_string(),
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            metadata_accounts,
        );
        create_metadata_accounts_v3(cpi_ctx, data, true, false, None)?;

        emit!(PartnershipMinted {
            authority: ctx.accounts.authority.key(),
            supplier,
            distributor,
            issued_at: partnership.issued_at,
        });

        Ok(())
    }

    /// Mint distributor→retailer partnership NFT with hierarchy validation.
    /// Requires a PDA proof that the distributor has an ACTIVE supplier partnership.
    pub fn mint_retailer_partnership(
        ctx: Context<MintRetailerPartnership>,
        supplier: Pubkey,
        distributor: Pubkey,
        retailer: Pubkey,
        role: u8,
        terms: String,
        legal_contract_hash: [u8; 32],
        valid_until: i64,
        distribution_region: String,
        tier: u8, // 0=Bronze, 1=Silver, 2=Gold
    ) -> Result<()> {
        // ── Hierarchy validation: distributor must hold an active supplier NFT ──
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

        let partnership = &mut ctx.accounts.partnership;
        partnership.authority = ctx.accounts.authority.key();
        partnership.supplier = supplier;
        partnership.distributor = distributor;
        partnership.retailer = Some(retailer);
        partnership.role = PartnershipRole::Retailer;
        partnership.status = PartnershipStatus::Active;
        partnership.retailer_tier = Some(tier);
        partnership.terms = terms.clone();
        partnership.legal_contract_hash = legal_contract_hash;
        partnership.valid_until = valid_until;
        partnership.distribution_region = distribution_region.clone();
        partnership.issued_at = Clock::get()?.unix_timestamp;
        partnership.revoked_at = None;
        partnership.bump = ctx.bumps.partnership;

        // Mint 1 token
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
        mint_to(cpi_ctx, 1)?;

        // Attach metadata
        let metadata_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.authority.to_account_info(),
            payer: ctx.accounts.authority.to_account_info(),
            update_authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        let tier_name = match tier {
            RetailerTier::Bronze => "Bronze",
            RetailerTier::Silver => "Silver",
            RetailerTier::Gold => "Gold",
        };
        let name = format!("AUTOSUP-RETAILER-{}-{}", tier_name, partnership.issued_at);
        let uri = format!(
            "https://autosup.io/retailer-nft/{}",
            hex::encode(legal_contract_hash)
        );

        let data = DataV2 {
            name,
            symbol: "AUTOR".to_string(),
            uri,
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_metadata_program.to_account_info(),
            metadata_accounts,
        );
        create_metadata_accounts_v3(cpi_ctx, data, true, false, None)?;

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
    /// Only the original issuer can revoke.
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
#[instruction(
    supplier: Pubkey, distributor: Pubkey, retailer: Option<Pubkey>,
    role: u8, terms: String, legal_contract_hash: [u8; 32],
    valid_until: i64, distribution_region: String,
)]
pub struct MintPartnership<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 33 + 1 + 2 + 1 + 260 + 32 + 8 + 68 + 8 + 9 + 1,
        seeds = [
            PARTNERSHIP_MINT_SEED,
            supplier.as_ref(),
            distributor.as_ref(),
            &[role],
        ],
        bump,
    )]
    pub partnership: Account<'info, PartnershipNFT>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        seeds = [
            PARTNERSHIP_TOKEN_SEED,
            supplier.as_ref(),
            distributor.as_ref(),
            &[role],
        ],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = distributor,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [METADATA_SEED, token_metadata_program.key().as_ref(), mint.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Distributor→Retailer minting with hierarchy validation CPI.
#[derive(Accounts)]
#[instruction(
    supplier: Pubkey, distributor: Pubkey, retailer: Pubkey,
    role: u8, terms: String, legal_contract_hash: [u8; 32],
    valid_until: i64, distribution_region: String, tier: u8,
)]
pub struct MintRetailerPartnership<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The parent supplier→distributor partnership PDA (proof of hierarchy).
    /// Must be ACTIVE and distributor must match.
    #[account(
        seeds = [PARTNERSHIP_MINT_SEED, supplier.as_ref(), distributor.as_ref(), &[0_u8]],
        bump,
    )]
    pub parent_partnership: Account<'info, PartnershipNFT>,

    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 33 + 1 + 2 + 1 + 260 + 32 + 8 + 68 + 8 + 9 + 1,
        seeds = [
            PARTNERSHIP_MINT_SEED,
            distributor.as_ref(),
            retailer.as_ref(),
            &[2_u8],
        ],
        bump,
    )]
    pub partnership: Account<'info, PartnershipNFT>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = authority,
        seeds = [
            PARTNERSHIP_TOKEN_SEED,
            distributor.as_ref(),
            retailer.as_ref(),
            &[2_u8],
        ],
        bump,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = retailer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [METADATA_SEED, token_metadata_program.key().as_ref(), mint.key().as_ref()],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
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

/// ─── External crate re-exports ───────────────────────────────────────────────

use anchor_lang::solana_program::clock::Clock;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::Metadata;
