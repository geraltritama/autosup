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

/// ─── Partnership NFT Account ─────────────────────────────────────────────────

#[account]
pub struct PartnershipNFT {
    /// The authority that minted this partnership
    pub authority: Pubkey,
    /// The supplier party
    pub supplier: Pubkey,
    /// The distributor party
    pub distributor: Pubkey,
    /// Optional: the retailer party (for dist→retail partnerships)
    pub retailer: Option<Pubkey>,
    /// The partnership role being certified
    pub role: PartnershipRole,
    /// Current status
    pub status: PartnershipStatus,
    /// Terms summary (max 256 bytes)
    pub terms: String,
    /// Timestamp of issuance
    pub issued_at: i64,
    /// Optional: timestamp of revocation
    pub revoked_at: Option<i64>,
    /// Bump seed
    pub bump: u8,
}

/// ─── Instructions ────────────────────────────────────────────────────────────

#[program]
pub mod autosup_partnership_nft {

    use super::*;

    /// Mint a new soulbound partnership NFT.
    ///
    /// Creates a token mint with 0 decimals (non-divisible, quantity = 1),
    /// mints exactly 1 token to the distributor's token account,
    /// and attaches Metaplex metadata with partnership details.
    /// The token is **soulbound** — the token account has no close authority
    /// and the program does not expose a transfer instruction.
    pub fn mint_partnership(
        ctx: Context<MintPartnership>,
        supplier: Pubkey,
        distributor: Pubkey,
        retailer: Option<Pubkey>,
        role: u8,
        terms: String,
    ) -> Result<()> {
        require!(terms.len() <= 256, PartnershipError::TermsTooLong);

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
        partnership.terms = terms.clone();
        partnership.issued_at = Clock::get()?.unix_timestamp;
        partnership.revoked_at = None;
        partnership.bump = ctx.bumps.partnership;

        // ── Mint exactly 1 soulbound token ─────────────────────────────────

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        mint_to(cpi_ctx, 1)?;

        // ── Attach Metaplex metadata (on-chain URI is optional for MVP) ─────

        let metadata_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            mint_authority: ctx.accounts.authority.to_account_info(),
            payer: ctx.accounts.authority.to_account_info(),
            update_authority: ctx.accounts.authority.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        let partnership_name = format!("AUTOSUP-PARTNERSHIP-{}", partnership.issued_at);
        let partnership_symbol = "AUTOP".to_string();
        let partnership_uri = "https://autosup.io/partnership-nft".to_string();

        let data = DataV2 {
            name: partnership_name,
            symbol: partnership_symbol,
            uri: partnership_uri,
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

        // ── Emit event ─────────────────────────────────────────────────────

        emit!(PartnershipMinted {
            authority: ctx.accounts.authority.key(),
            supplier,
            distributor,
            issued_at: partnership.issued_at,
        });

        Ok(())
    }

    /// Revoke an active partnership NFT (soulbound keep, status changed).
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

    /// Verify a partnership is active (read-only; used by client-side checks).
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
#[instruction(supplier: Pubkey, distributor: Pubkey, retailer: Option<Pubkey>, role: u8, terms: String)]
pub struct MintPartnership<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// The partnership PDA — stores all on-chain partnership data
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 33 + 1 + 1 + 260 + 8 + 9 + 1,
        seeds = [
            PARTNERSHIP_MINT_SEED,
            supplier.as_ref(),
            distributor.as_ref(),
            &[role],
        ],
        bump,
    )]
    pub partnership: Account<'info, PartnershipNFT>,

    /// SPL token mint (decimals = 0, quantity = 1)
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

    /// Token account for the distributor (ATA)
    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = distributor,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// Metaplex metadata account (PDA)
    #[account(
        mut,
        seeds = [
            METADATA_SEED,
            token_metadata_program.key().as_ref(),
            mint.key().as_ref(),
        ],
        bump,
        seeds::program = token_metadata_program.key(),
    )]
    pub metadata: AccountInfo<'info>,

    // Programs
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
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
    #[msg("Invalid partnership role (0=supplier, 1=distributor, 2=retailer)")]
    InvalidRole,
    #[msg("Only the authority can perform this action")]
    Unauthorized,
    #[msg("Partnership has already been revoked")]
    AlreadyRevoked,
    #[msg("Partnership is not active")]
    PartnershipNotActive,
}

/// ─── External crate re-exports ───────────────────────────────────────────────

use anchor_lang::solana_program::clock::Clock;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::Metadata;
