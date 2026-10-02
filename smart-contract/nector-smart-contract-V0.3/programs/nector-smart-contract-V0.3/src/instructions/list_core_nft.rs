use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::{ErrorCode, NftListing, NftListingCounter};

// Metaplex Core assets don't have a mint or associated token accounts —
// the "asset" account itself IS the NFT, and ownership is just a Pubkey
// field on that account. Escrowing one means transferring `owner` to the
// `listing` PDA (via CPI into the mpl-core program), not moving tokens
// between ATAs like list_nft.rs does for classic SPL/Token-2022 NFTs.
//
// This mirrors list_nft.rs's PDA/state layout exactly (same NftListing
// and NftListingCounter accounts, same seeds) — only the "mint" field
// now holds the Core asset's own address instead of an SPL mint address.
// Fully additive: list_nft / buy_nft / cancel_nft_listing are untouched.
pub fn list_core_nft_handler(ctx: Context<ListCoreNft>, price_lamports: u64) -> Result<()> {
    // Sanity check the asset account is actually owned by the mpl-core
    // program before we try to CPI into it.
    require_keys_eq!(
        *ctx.accounts.asset.owner,
        mpl_core::ID,
        ErrorCode::NotACoreAsset
    );

    ctx.accounts.listing_counter.seller = ctx.accounts.seller.key();
    ctx.accounts.listing_counter.mint = ctx.accounts.asset.key();

    // `collection_or_program`: pass the real collection account if this
    // asset belongs to one, or the mpl-core program id itself if it
    // doesn't (this is the exact sentinel mpl-core's own instruction
    // builder substitutes internally for "no collection" — see
    // TransferV1's account list — so this avoids any ambiguity around
    // Anchor's optional-account calling convention).
    let collection_account = if ctx.accounts.collection_or_program.key() == mpl_core::ID {
        None
    } else {
        Some(ctx.accounts.collection_or_program.to_account_info())
    };

    let mpl_core_program_info = ctx.accounts.mpl_core_program.to_account_info();
    let asset_info = ctx.accounts.asset.to_account_info();
    let seller_info = ctx.accounts.seller.to_account_info();
    let listing_info = ctx.accounts.listing.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    TransferV1CpiBuilder::new(&mpl_core_program_info)
        .asset(&asset_info)
        .collection(collection_account.as_ref())
        .payer(&seller_info)
        .authority(Some(&seller_info))
        .new_owner(&listing_info)
        .system_program(Some(&system_program_info))
        .invoke()?;

    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.mint = ctx.accounts.asset.key();
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
pub struct ListCoreNft<'info> {
    #[account(
        init_if_needed,
        payer = seller,
        space = 8 + NftListingCounter::SIZE,
        seeds = [b"nft_listing_counter", seller.key().as_ref(), asset.key().as_ref()],
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
            asset.key().as_ref(),
            &listing_counter.next_nonce.to_le_bytes()
        ],
        bump
    )]
    pub listing: Account<'info, NftListing>,

    /// CHECK: the Metaplex Core asset being listed. Validated against
    /// mpl_core::ID in the handler; ownership transfer is validated by
    /// the mpl-core program itself during the CPI.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: either the asset's real collection account, or the
    /// mpl-core program id as a "no collection" sentinel — see comment
    /// in the handler. Read-only either way.
    pub collection_or_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: must be the real mpl-core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
