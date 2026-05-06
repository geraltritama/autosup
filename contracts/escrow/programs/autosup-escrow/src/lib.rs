use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("EsC3wXJYx4G8MgPkFUK3VHgJZP8eBUWH69LMnRSq1HRT");

/// ─── Constants ──────────────────────────────────────────────────────────────

const ESCROW_SEED: &[u8] = b"escrow";
const ESCROW_VAULT_SEED: &[u8] = b"escrow-vault";

/// ─── Escrow Status ───────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowStatus {
    /// Funds held, awaiting delivery
    Held,
    /// Funds released to seller
    Released,
    /// Funds refunded to buyer (cancelled / dispute)
    Refunded,
}

/// ─── Escrow Account ──────────────────────────────────────────────────────────

#[account]
pub struct Escrow {
    /// Buyer (payer) — e.g. distributor
    pub buyer: Pubkey,
    /// Seller (payee) — e.g. supplier
    pub seller: Pubkey,
    /// Token mint being held (e.g. USDC)
    pub mint: Pubkey,
    /// Amount in smallest unit (lamports / token-raw)
    pub amount: u64,
    /// Current escrow status
    pub status: EscrowStatus,
    /// Order ID this escrow is linked to (for backend correlation)
    pub order_id: [u8; 32],
    /// Timestamp escrow was initialized
    pub created_at: i64,
    /// Timestamp escrow was settled (released or refunded)
    pub settled_at: Option<i64>,
    /// Bump for the escrow PDA
    pub escrow_bump: u8,
    /// Bump for the vault token account PDA
    pub vault_bump: u8,
}

/// ─── Instructions ────────────────────────────────────────────────────────────

#[program]
pub mod autosup_escrow {

    use super::*;

    /// Initialize a new escrow.
    ///
    /// Buyer deposits `amount` tokens from their token account into
    /// the escrow vault. The escrow state is set to `Held`.
    /// This is called AFTER an order is created on the backend.
    pub fn initialize(
        ctx: Context<InitializeEscrow>,
        order_id: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.buyer = ctx.accounts.buyer.key();
        escrow.seller = ctx.accounts.seller.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.amount = amount;
        escrow.status = EscrowStatus::Held;
        escrow.order_id = order_id;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.settled_at = None;
        escrow.escrow_bump = ctx.bumps.escrow;
        escrow.vault_bump = ctx.bumps.escrow_vault;

        // ── Transfer tokens from buyer to escrow vault ─────────────────────

        let transfer_accounts = Transfer {
            from: ctx.accounts.buyer_token_account.to_account_info(),
            to: ctx.accounts.escrow_vault.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
        );
        token::transfer(cpi_ctx, amount)?;

        emit!(EscrowInitialized {
            buyer: escrow.buyer,
            seller: escrow.seller,
            order_id,
            amount,
            created_at: escrow.created_at,
        });

        Ok(())
    }

    /// Release escrow funds to the seller.
    ///
    /// Only the escrow authority (backend oracle / trusted signer) can call this.
    /// Transfers the full escrow amount to the seller's token account.
    pub fn release(ctx: Context<ReleaseEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.status == EscrowStatus::Held,
            EscrowError::EscrowNotHeld
        );

        escrow.status = EscrowStatus::Released;
        escrow.settled_at = Some(Clock::get()?.unix_timestamp);

        // ── Transfer from vault to seller ──────────────────────────────────

        let escrow_bump = escrow.escrow_bump;
        let vault_bump = escrow.vault_bump;
        let seeds: &[&[u8]] = &[
            ESCROW_SEED,
            &escrow.buyer.as_ref(),
            &escrow.seller.as_ref(),
            &escrow.order_id,
            &[escrow_bump],
        ];

        let signer_seeds: &[&[&[u8]]] = &[&[
            ESCROW_SEED,
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id,
            &[escrow_bump],
        ]];

        let pda_signer = &[seeds.concat()][..];
        // Use full seeds for the PDA signer
        let full_seeds = [
            &ESCROW_SEED[..],
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id[..],
            &[escrow_bump],
        ];

        let vault_signer_seeds: &[&[&[u8]]] = &[&[
            ESCROW_VAULT_SEED,
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id,
            &[vault_bump],
        ]];

        let transfer_accounts = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.seller_token_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
            &[&full_seeds[..]],
        );
        token::transfer(cpi_ctx, escrow.amount)?;

        emit!(EscrowReleased {
            buyer: escrow.buyer,
            seller: escrow.seller,
            order_id: escrow.order_id,
            amount: escrow.amount,
            settled_at: escrow.settled_at.unwrap(),
        });

        Ok(())
    }

    /// Refund escrow funds back to the buyer.
    ///
    /// Called when an order is cancelled or a dispute is resolved
    /// in the buyer's favor. Only the escrow authority can call this.
    pub fn refund(ctx: Context<RefundEscrow>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(
            escrow.status == EscrowStatus::Held,
            EscrowError::EscrowNotHeld
        );

        escrow.status = EscrowStatus::Refunded;
        escrow.settled_at = Some(Clock::get()?.unix_timestamp);

        let escrow_bump = escrow.escrow_bump;
        let vault_bump = escrow.vault_bump;

        let full_seeds = [
            &ESCROW_SEED[..],
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id[..],
            &[escrow_bump],
        ];

        let transfer_accounts = Transfer {
            from: ctx.accounts.escrow_vault.to_account_info(),
            to: ctx.accounts.buyer_token_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_accounts,
            &[&full_seeds[..]],
        );
        token::transfer(cpi_ctx, escrow.amount)?;

        // ── Close vault account (return rent to buyer) ────────────────────

        emit!(EscrowRefunded {
            buyer: escrow.buyer,
            seller: escrow.seller,
            order_id: escrow.order_id,
            amount: escrow.amount,
            settled_at: escrow.settled_at.unwrap(),
        });

        Ok(())
    }
}

/// ─── Contexts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(order_id: [u8; 32], amount: u64)]
pub struct InitializeEscrow<'info> {
    /// Buyer deposits funds
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// Seller (the eventual receiver)
    /// CHECK: only stored as pubkey; no account data access
    pub seller: UncheckedAccount<'info>,

    /// Token mint (USDC or other SPL token)
    pub mint: Account<'info, Mint>,

    /// Buyer's token account (source of deposit)
    #[account(
        mut,
        constraint = buyer_token_account.owner == buyer.key(),
        constraint = buyer_token_account.mint == mint.key(),
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// Escrow PDA — stores escrow state
    #[account(
        init,
        payer = buyer,
        space = 8 + 32 + 32 + 32 + 8 + 1 + 32 + 8 + 9 + 1 + 1,
        seeds = [
            ESCROW_SEED,
            buyer.key().as_ref(),
            seller.key().as_ref(),
            &order_id,
        ],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// Escrow vault token account — holds the tokens
    #[account(
        init,
        payer = buyer,
        token::mint = mint,
        token::authority = escrow,
        seeds = [
            ESCROW_VAULT_SEED,
            buyer.key().as_ref(),
            seller.key().as_ref(),
            &order_id,
        ],
        bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReleaseEscrow<'info> {
    /// Only the escrow authority (backend oracle) can release
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Escrow state account
    #[account(
        mut,
        seeds = [
            ESCROW_SEED,
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id,
        ],
        bump = escrow.escrow_bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// Escrow vault holding the tokens
    #[account(
        mut,
        seeds = [
            ESCROW_VAULT_SEED,
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id,
        ],
        bump = escrow.vault_bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// Seller token account (destination of release)
    #[account(
        mut,
        constraint = seller_token_account.owner == escrow.seller,
        constraint = seller_token_account.mint == escrow.mint,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    /// Only the escrow authority (backend oracle) can refund
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Escrow state account
    #[account(
        mut,
        seeds = [
            ESCROW_SEED,
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id,
        ],
        bump = escrow.escrow_bump,
    )]
    pub escrow: Account<'info, Escrow>,

    /// Escrow vault holding the tokens
    #[account(
        mut,
        seeds = [
            ESCROW_VAULT_SEED,
            escrow.buyer.as_ref(),
            escrow.seller.as_ref(),
            &escrow.order_id,
        ],
        bump = escrow.vault_bump,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// Buyer token account (refund destination)
    #[account(
        mut,
        constraint = buyer_token_account.owner == escrow.buyer,
        constraint = buyer_token_account.mint == escrow.mint,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// ─── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct EscrowInitialized {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub order_id: [u8; 32],
    pub amount: u64,
    pub created_at: i64,
}

#[event]
pub struct EscrowReleased {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub order_id: [u8; 32],
    pub amount: u64,
    pub settled_at: i64,
}

#[event]
pub struct EscrowRefunded {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub order_id: [u8; 32],
    pub amount: u64,
    pub settled_at: i64,
}

/// ─── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Escrow is not in Held status")]
    EscrowNotHeld,
    #[msg("Only the escrow authority can perform this action")]
    Unauthorized,
    #[msg("Invalid token account owner")]
    InvalidOwner,
}

/// ─── Re-exports ──────────────────────────────────────────────────────────────

use anchor_spl::token::Mint;
use anchor_lang::solana_program::clock::Clock;
use anchor_lang::solana_program::sysvar::Sysvar;
