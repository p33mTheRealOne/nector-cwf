use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::{ErrorCode, NftListing};

pub fn cancel_core_nft_handler(ctx: Context<CancelCoreNft>) -> Result<()> {
    require!(ctx.accounts.listing.state == 0, ErrorCode::ListingNotActive);
    require!(
        ctx.accounts.seller.key() == ctx.accounts.listing.seller,
        ErrorCode::InvalidListingSeller
    );

    let seller_key = ctx.accounts.listing.seller;
    let mint_key = ctx.accounts.listing.mint; // Core asset's own address
    let bump = ctx.accounts.listing.bump;
    let signer_seeds: &[&[u8]] = &[
        b"nft_listing",
        seller_key.as_ref(),
        mint_key.as_ref(),
        &ctx.accounts.listing.nonce.to_le_bytes(),
        &[bump],
    ];

    // See list_core_nft.rs for why this sentinel pattern is used instead
    // of an Anchor Option<Account>.
    let collection_account = if ctx.accounts.collection_or_program.key() == mpl_core::ID {
        None
    } else {
        Some(ctx.accounts.collection_or_program.to_account_info())
    };

    let mpl_core_program_info = ctx.accounts.mpl_core_program.to_account_info();
    let asset_info = ctx.accounts.asset.to_account_info();
    let listing_info = ctx.accounts.listing.to_account_info();
    let seller_info = ctx.accounts.seller.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    // Authority is the `listing` PDA itself — same as buy_core_nft, just
    // returning the asset to the seller instead of handing it to a buyer.
    TransferV1CpiBuilder::new(&mpl_core_program_info)
        .asset(&asset_info)
        .collection(collection_account.as_ref())
        .payer(&seller_info)
        .authority(Some(&listing_info))
        .new_owner(&seller_info)
        .system_program(Some(&system_program_info))
        .invoke_signed(&[signer_seeds])?;

    // `listing` itself is closed by the `close = seller` constraint below.

    Ok(())
}

#[derive(Accounts)]
pub struct CancelCoreNft<'info> {
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

    /// CHECK: the Metaplex Core asset being returned. Ownership is
    /// validated by the mpl-core program itself during the CPI.
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: either the asset's real collection account, or the
    /// mpl-core program id as a "no collection" sentinel.
    pub collection_or_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: must be the real mpl-core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
