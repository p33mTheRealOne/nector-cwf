use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use crate::{ErrorCode, NftListing};

pub fn cancel_nft_listing_handler(ctx: Context<CancelNftListing>) -> Result<()> {
    require!(ctx.accounts.listing.state == 0, ErrorCode::ListingNotActive);
    require!(
        ctx.accounts.seller.key() == ctx.accounts.listing.seller,
        ErrorCode::InvalidListingSeller
    );

    let seller_key = ctx.accounts.listing.seller;
    let mint_key = ctx.accounts.listing.mint;
    let bump = ctx.accounts.listing.bump;
    let signer_seeds: &[&[u8]] = &[
        b"nft_listing",
        seller_key.as_ref(),
        mint_key.as_ref(),
        &ctx.accounts.listing.nonce.to_le_bytes(),
        &[bump],
    ];

    // Return the NFT from the vault back to the seller. transfer_checked
    // (not the legacy transfer) is required for Token-2022 mints, and
    // works fine for classic SPL Token mints too.
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_nft_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.seller_nft_ata.to_account_info(),
                authority: ctx.accounts.listing.to_account_info(),
            },
            &[signer_seeds],
        ),
        1,
        ctx.accounts.mint.decimals,
    )?;

    // Reclaim the vault ATA's rent back to the seller.
    token_interface::close_account(CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        CloseAccount {
            account: ctx.accounts.vault_nft_ata.to_account_info(),
            destination: ctx.accounts.seller.to_account_info(),
            authority: ctx.accounts.listing.to_account_info(),
        },
        &[signer_seeds],
    ))?;

    // `listing` itself is closed by the `close = seller` constraint below.

    Ok(())
}

#[derive(Accounts)]
pub struct CancelNftListing<'info> {
    #[account(
        mut,
        seeds = [
            b"nft_listing",
            listing.seller.as_ref(),
            listing.mint.as_ref(),
            &listing.nonce.to_le_bytes()
        ],
        bump = listing.bump,
        close = seller
    )]
    pub listing: Account<'info, NftListing>,

    /// Accepts either a classic SPL Token or Token-2022 mint.
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = listing,
        associated_token::token_program = token_program,
    )]
    pub vault_nft_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = seller,
        associated_token::token_program = token_program,
    )]
    pub seller_nft_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// The token program that actually owns `mint` — either the classic
    /// SPL Token program or Token-2022. Resolved per call, not hardcoded.
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
