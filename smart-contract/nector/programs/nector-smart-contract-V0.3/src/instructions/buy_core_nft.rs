use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer as SolTransfer};
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::{ErrorCode, NftListing};

pub fn buy_core_nft_handler(ctx: Context<BuyCoreNft>) -> Result<()> {
    let price = ctx.accounts.listing.price_lamports;

    require!(ctx.accounts.listing.state == 0, ErrorCode::ListingNotActive);
    require!(
        ctx.accounts.seller.key() == ctx.accounts.listing.seller,
        ErrorCode::InvalidListingSeller
    );

    // Same 1% platform fee convention already used by buy_nft.
    let fee = price
        .checked_mul(1)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;
    let seller_receive = price.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;

    // ---------------- SOL leg: buyer -> seller, buyer -> fee_wallet ----------------

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            SolTransfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.seller.to_account_info(),
            },
        ),
        seller_receive,
    )?;

    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            SolTransfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.fee_wallet.to_account_info(),
            },
        ),
        fee,
    )?;

    // ---------------- Asset leg: listing PDA -> buyer, signed by the listing PDA ----------------

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
    let buyer_info = ctx.accounts.buyer.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();

    // Authority is the `listing` PDA itself — it became the asset's owner
    // back in list_core_nft, so it (not the seller, not the buyer) is the
    // one that must sign this transfer, via its PDA seeds.
    TransferV1CpiBuilder::new(&mpl_core_program_info)
        .asset(&asset_info)
        .collection(collection_account.as_ref())
        .payer(&buyer_info)
        .authority(Some(&listing_info))
        .new_owner(&buyer_info)
        .system_program(Some(&system_program_info))
        .invoke_signed(&[signer_seeds])?;

    // `listing` is closed by the `close = seller` constraint below once this
    // handler returns — same permanent "sold" marker as buy_nft.rs.

    Ok(())
}

#[derive(Accounts)]
pub struct BuyCoreNft<'info> {
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

    /// CHECK: the Metaplex Core asset being purchased. Ownership is
    /// validated by the mpl-core program itself during the CPI (only the
    /// current owner/authority — here, the `listing` PDA — can move it).
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: either the asset's real collection account, or the
    /// mpl-core program id as a "no collection" sentinel.
    pub collection_or_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: verified against listing.seller above; only ever receives
    /// lamports here, never read as data.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    #[account(
        mut,
        address = pubkey!("5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR") // same platform fee wallet used elsewhere in this program
    )]
    /// CHECK: platform fee wallet
    pub fee_wallet: SystemAccount<'info>,

    /// CHECK: must be the real mpl-core program.
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
