use anchor_lang::prelude::*;
pub mod instructions;
use instructions::*;

declare_id!("WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb");

#[program]
pub mod nector {
    use super::*;

    pub fn init_seller(ctx: Context<InitSeller>) -> Result<()> {
        let seller_account = &mut ctx.accounts.seller_account;
        seller_account.owner = ctx.accounts.seller.key();
        seller_account.order_count = 0;
        Ok(())
    }

    pub fn buyer_fund_escrow(
        ctx: Context<BuyerFundEscrow>,
        order_index: u64,
    ) -> Result<()> {
        fund_escrow_handler(ctx, order_index)
    }

    pub fn buyer_cancel(
        ctx: Context<BuyerCancel>,
        order_index: u64,
    ) -> Result<()> {
        buyer_cancel_handler(ctx, order_index)
    }

    pub fn seller_fund_escrow(
        ctx: Context<SellerFundEscrow>,
        order_index: u64,
    ) -> Result<()> {
        seller_fund_escrow_handler(ctx, order_index)
    }

    pub fn shipping_timeout(
        ctx: Context<ShippingTimeout>,
        order_index: u64,
    ) -> Result<()> {
        shipping_timeout_handler(ctx, order_index)
    }

    pub fn mark_shipped(
        ctx: Context<MarkShipped>,
        order_index: u64,
    ) -> Result<()> {
        mark_shipped_handler(ctx, order_index)
    }

    pub fn confirm_delivery(
        ctx: Context<ConfirmDelivery>,
        order_index: u64,
    ) -> Result<()> {
        confirm_delivery_handler(ctx, order_index)
    }

    pub fn confirm_timeout(
        ctx: Context<ConfirmTimeout>,
        order_index: u64,
    ) -> Result<()> {
        confirm_timeout_handler(ctx, order_index)
    }

    pub fn open_dispute(
        ctx: Context<OpenDispute>,
        order_index: u64,
    ) -> Result<()> {
        open_dispute_handler(ctx, order_index)
    }

    pub fn refund_buyer(
        ctx: Context<RefundBuyer>,
        order_index: u64,
    ) -> Result<()> {
        refund_buyer_handler(ctx, order_index)
    }

    pub fn respond_dispute(
        ctx: Context<RespondDispute>,
        order_index: u64,
    ) -> Result<()> {
        respond_dispute_handler(ctx, order_index)
    }

    pub fn buyer_win(
        ctx: Context<BuyerWin>,
        order_index: u64,
    ) -> Result<()> {
        buyer_win_handler(ctx, order_index)
    }

    pub fn draw(
        ctx: Context<Draw>,
        order_index: u64,
    ) -> Result<()> {
        draw_handler(ctx, order_index)
    }

    pub fn seller_cancel(
        ctx: Context<SellerCancel>,
        order_index: u64,
    ) -> Result<()> {
        seller_cancel_handler(ctx, order_index)
    }

    pub fn refund_during_discuss(
        ctx: Context<RefundDuringDiscuss>,
        order_index: u64,
    ) -> Result<()> {
        refund_during_discuss_handler(ctx, order_index)
    }

    pub fn pay_seller_during_discuss(
        ctx: Context<PaySellerDuringDiscuss>,
        order_index: u64,
    ) -> Result<()> {
        pay_seller_during_discuss_handler(ctx, order_index)
    }

    pub fn create_order(
        ctx: Context<CreateOrder>,
        order_index: u64,
        mode: u8,
        product_type: u8,
        order_name: String,
        buyer_wallet: Pubkey,
        price_lamports: u64,
        shipping_hours: u32,
    ) -> Result<()> {
        // ---------------- validate enums ----------------
        match mode {
            0 | 1 => {}
            _ => return err!(ErrorCode::InvalidMode),
        };

        if product_type == ProductType::Physical as u8 {
            require!(
                shipping_hours > 0 && shipping_hours <= 720,
                ErrorCode::InvalidShippingTime
            );
        }

        if product_type == ProductType::Digital as u8 {
            // NOTE: this block used to be duplicated (same check ran twice).
            // Removed the redundant copy — behavior/values unchanged.
            require!(
                shipping_hours > 0 && shipping_hours <= 48,
                ErrorCode::InvalidShippingTime
            );

            require!(mode == Mode::BTR as u8, ErrorCode::InvalidModeForDigital);
        }

        match product_type {
            0 | 1 => {}
            _ => return err!(ErrorCode::InvalidProductType),
        };

        let seller_account = &mut ctx.accounts.seller_account;

        // Change Index
        require!(
            order_index == seller_account.order_count,
            ErrorCode::InvalidOrderIndex
        );

        // ---------------- create order ----------------
        let order = &mut ctx.accounts.order;
        order.order_index = order_index;
        order.mode = mode;
        order.product_type = product_type;
        order.state = 0; // CREATED
        order.order_name = order_name;
        order.buyer_wallet = buyer_wallet;
        order.seller_wallet = ctx.accounts.seller.key();
        order.price_lamports = price_lamports;
        order.shipping_hours = shipping_hours;

        // ---------------- increment counter ----------------
        seller_account.order_count = seller_account
            .order_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;

        Ok(())
    }

    // ==================== NFT sale (atomic swap) ====================
    // Fully additive — none of the instructions above are touched.

    pub fn list_nft(
        ctx: Context<ListNft>,
        price_lamports: u64,
    ) -> Result<()> {
        list_nft_handler(ctx, price_lamports)
    }

    pub fn buy_nft(ctx: Context<BuyNft>) -> Result<()> {
        buy_nft_handler(ctx)
    }

    pub fn cancel_nft_listing(ctx: Context<CancelNftListing>) -> Result<()> {
        cancel_nft_listing_handler(ctx)
    }

    // ==================== Metaplex Core NFT sale (atomic swap) ====================
    // Fully additive — none of the classic SPL/Token-2022 instructions
    // above are touched. Core assets have no mint/ATA, so these use a
    // separate CPI-based escrow path (see list_core_nft.rs).

    pub fn list_core_nft(
        ctx: Context<ListCoreNft>,
        price_lamports: u64,
    ) -> Result<()> {
        list_core_nft_handler(ctx, price_lamports)
    }

    pub fn buy_core_nft(ctx: Context<BuyCoreNft>) -> Result<()> {
        buy_core_nft_handler(ctx)
    }

    pub fn cancel_core_nft(ctx: Context<CancelCoreNft>) -> Result<()> {
        cancel_core_nft_handler(ctx)
    }
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Mode {
    BTR = 0,
    STR = 1,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ProductType {
    Physical = 0,
    Digital = 1,
}

#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderState {
    Created = 0,
    BuyerFunded = 1,
    SellerFunded = 2,
    Cancelled = 3,
    ShippingTimedOut = 4,
    MarkShipped = 5,
    Completed = 6,
    OpenDispute = 7,
    Refunded = 8,
    BuyerWonDispute = 9,
    SellerResponded = 10,
    Draw = 11,
}

#[account]
pub struct SellerAccount {
    pub owner: Pubkey,
    pub order_count: u64,
}

impl SellerAccount {
    pub const SIZE: usize = 32 + 8;
}

#[account]
pub struct Order {
    pub mode: u8,
    pub product_type: u8,
    pub order_name: String,
    pub buyer_wallet: Pubkey,
    pub seller_wallet: Pubkey,
    pub price_lamports: u64,
    pub shipping_hours: u32,
    pub state: u8,
    pub order_index: u64,
    pub bond_lamports: u64,
    pub fee_lamports: u64,
    pub total_lamports: u64,
    pub seller_funded_at: i64,
    pub mark_shipped_at: i64,
    pub open_dispute_at: i64,
    pub seller_respond_at: i64,
}

impl Order {
    pub const MAX_NAME: usize = 100;

    // FIX: the previous SIZE only summed 15 terms for 16 fields — it was
    // short by 8 bytes (one i64 timestamp field was never accounted for).
    // That under-allocated the account, which would eventually fail to
    // serialize once seller_respond_at got written. Every field is now
    // listed explicitly so this can't silently drift again.
    pub const SIZE: usize =
        1 +                     // mode
        1 +                     // product_type
        4 + Self::MAX_NAME +    // order_name (4-byte Borsh length prefix + max bytes)
        32 +                    // buyer_wallet
        32 +                    // seller_wallet
        8 +                     // price_lamports
        4 +                     // shipping_hours
        1 +                     // state
        8 +                     // order_index
        8 +                     // bond_lamports
        8 +                     // fee_lamports
        8 +                     // total_lamports
        8 +                     // seller_funded_at
        8 +                     // mark_shipped_at
        8 +                     // open_dispute_at
        8;                      // seller_respond_at
}

#[account]
pub struct EscrowAccount {
    pub order: Pubkey,
    pub buyer: Pubkey,
    pub amount_locked: u64,
}

impl EscrowAccount {
    pub const SIZE: usize = 32 + 32 + 8;
}

// ==================== NFT sale (atomic swap) ====================
// Additive only — nothing above this is touched.

#[account]
pub struct NftListing {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub price_lamports: u64,
    pub state: u8, // 0 = Listed, 1 = Sold (account is closed on sale/cancel anyway)
    pub bump: u8,
    pub nonce: u64,
}

impl NftListing {
    pub const SIZE: usize =
        32 + // seller
        32 + // mint
        8  + // price_lamports
        1  + // state
        1  + // bump
        8;   // nonce
}

#[account]
pub struct NftListingCounter {
    pub seller: Pubkey,
    pub mint: Pubkey,
    pub next_nonce: u64,
}

impl NftListingCounter {
    pub const SIZE: usize = 32 + 32 + 8;
}

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct CreateOrder<'info> {

    #[account(
        mut,
        seeds = [b"seller", seller.key().as_ref()],
        bump
    )]
    pub seller_account: Account<'info, SellerAccount>,

    #[account(
        init,
        payer = seller,
        space = 8 + Order::SIZE,
        seeds = [
            b"order",
            seller.key().as_ref(),
            &order_index.to_le_bytes()
        ],
        bump
    )]
    pub order: Account<'info, Order>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitSeller<'info> {
    #[account(
        init,
        payer = seller,
        seeds = [b"seller", seller.key().as_ref()],
        bump,
        space = 8 + SellerAccount::SIZE
    )]
    pub seller_account: Account<'info, SellerAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid mode")]
    InvalidMode,
    #[msg("Invalid product type")]
    InvalidProductType,
    #[msg("Only Seller can trigger")]
    InvalidSeller,
    #[msg("Invalid order index")]
    InvalidOrderIndex,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Digital product must use BTR mode")]
    InvalidModeForDigital,
    #[msg("Invalid shipping time")]
    InvalidShippingTime,
    #[msg("Digital product cannot have shipping time")]
    DigitalNoShipping,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Only Buyer can trigger")]
    InvalidBuyer,
    #[msg("Order already funded")]
    AlreadyFunded,
    #[msg("Invalid State")]
    InvalidState,
    #[msg("Shipping deadline not reached")]
    ShippingNotExpired,
    #[msg("Insufficient Escrow")]
    InsufficientEscrow,
    #[msg("Confirm deadline not reached")]
    ConfirmNotExpired,
    #[msg("Only buyer can open dispute")]
    OnlyBuyerCanOpenDispute,
    #[msg("Dispute deadline not reached")]
    DisputeDeadlineNotReached,
    #[msg("Discussion deadline not reached")]
    DiscussionNotReached,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Mint is not a valid single-supply NFT (must have 0 decimals and supply of 1)")]
    NotAnNft,
    #[msg("NFT listing is not active")]
    ListingNotActive,
    #[msg("Only the seller who created this listing can trigger this")]
    InvalidListingSeller,
    #[msg("Account is not owned by the Metaplex Core program")]
    NotACoreAsset,
}