use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, CloseAccount, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use crate::{ErrorCode, NftListing, NftListingCounter};

pub fn list_nft_handler(ctx: Context<ListNft>, price_lamports: u64) -> Result<()> {
    ctx.accounts.listing_counter.seller = ctx.accounts.seller.key();
    ctx.accounts.listing_counter.mint = ctx.accounts.mint.key();

    // Basic sanity check that this mint actually looks like an NFT:
    // 0 decimals + a total supply of exactly 1. Works the same for both
    // classic SPL Token and Token-2022 mints — the base Mint layout
    // (decimals/supply) is identical; Token-2022 extensions live in
    // separate TLV data we don't need to inspect here.
    require!(
        ctx.accounts.mint.decimals == 0 && ctx.accounts.mint.supply == 1,
        ErrorCode::NotAnNft
    );

    require!(ctx.accounts.seller_nft_ata.amount == 1, ErrorCode::NotAnNft);

    // Move the NFT out of the seller's wallet into the program-controlled
    // vault ATA. The vault's authority is the `listing` PDA itself, so only
    // this program (via buy_nft / cancel_nft_listing) can move it again.
    // transfer_checked (not the legacy transfer) is required for
    // Token-2022 mints, and works fine for classic SPL Token mints too.
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.seller_nft_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault_nft_ata.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
        ctx.accounts.mint.decimals,
    )?;

    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.mint = ctx.accounts.mint.key();
    listing.price_lamports = price_lamports;
    listing.state = 0; // Listed
    listing.bump = ctx.bumps.listing;
    listing.nonce = ctx.accounts.listing_counter.next_nonce;

    ctx.accounts.listing_counter.next_nonce = ctx.accounts.listing_counter
        .next_nonce
        .checked_add(1)
        .ok_or(ErrorCode::MathOverflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct ListNft<'info> {
    #[account(
        init_if_needed,
        payer = seller,
        space = 8 + NftListingCounter::SIZE,
        seeds = [b"nft_listing_counter", seller.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub listing_counter: Account<'info, NftListingCounter>,

    #[account(
        init,
        payer = seller,
        space = 8 + NftListing::SIZE,
        seeds = [
            b"nft_listing",
            seller.key().as_ref(),
            mint.key().as_ref(),
            &listing_counter.next_nonce.to_le_bytes()
        ],
        bump
    )]
    pub listing: Account<'info, NftListing>,

    /// The NFT mint being listed. Not modified here — only read (decimals,
    /// supply) to sanity-check it's a single-supply NFT. `InterfaceAccount`
    /// accepts a mint owned by either the classic Token program or
    /// Token-2022 — whichever `token_program` below actually owns it.
    pub mint: InterfaceAccount<'info, Mint>,

    /// Seller's existing associated token account holding the NFT.
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller,
        associated_token::token_program = token_program,
    )]
    pub seller_nft_ata: InterfaceAccount<'info, TokenAccount>,

    /// Program-controlled vault ATA, created here. Its authority is the
    /// `listing` PDA, so only this program can move the NFT out again.
    #[account(
        init,
        payer = seller,
        associated_token::mint = mint,
        associated_token::authority = listing,
        associated_token::token_program = token_program,
    )]
    pub vault_nft_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// The token program that actually owns `mint` — either the classic
    /// SPL Token program or Token-2022. Resolved per call, not hardcoded.
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
