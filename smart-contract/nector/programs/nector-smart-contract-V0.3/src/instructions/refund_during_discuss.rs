use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, OrderState, ErrorCode};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct RefundDuringDiscuss<'info> {

    #[account(
        mut,
        seeds = [b"order", order.seller_wallet.as_ref(), &order_index.to_le_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    #[account(
        mut,
        seeds = [b"escrow", order.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(mut)]
    /// CHECK
    pub buyer: UncheckedAccount<'info>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn refund_during_discuss_handler(
    ctx: Context<RefundDuringDiscuss>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;

    // Only Seller
    require!(
        order.seller_wallet == ctx.accounts.seller.key(),
        ErrorCode::Unauthorized
    );

    // Only state = SellerResponded
    require!(
        order.state == OrderState::SellerResponded as u8,
        ErrorCode::InvalidState
    );

    require!(
        order.buyer_wallet == ctx.accounts.buyer.key(),
        ErrorCode::InvalidBuyer
    );

    // Same formulas as before, checked arithmetic.
    let price = order.price_lamports;

    // buyer deposit = 120%
    let buyer_deposit = price
        .checked_add(
            price
                .checked_mul(20)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(100)
                .ok_or(ErrorCode::MathOverflow)?,
        )
        .ok_or(ErrorCode::MathOverflow)?;

    // seller deposit
    let seller_deposit = if order.mode == 0 {
        // BTR
        price
            .checked_mul(20)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?
    } else {
        // STR
        price
            .checked_add(
                price
                    .checked_mul(20)
                    .ok_or(ErrorCode::MathOverflow)?
                    .checked_div(100)
                    .ok_or(ErrorCode::MathOverflow)?,
            )
            .ok_or(ErrorCode::MathOverflow)?
    };

    // FIX: no check previously that escrow held enough for both refunds
    // before subtracting — an undersized escrow would panic with a raw
    // integer underflow instead of returning a clean error.
    let total = buyer_deposit
        .checked_add(seller_deposit)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        escrow.amount_locked >= total,
        ErrorCode::InsufficientEscrow
    );

    // return buyer
    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_deposit;
    **ctx.accounts.buyer.try_borrow_mut_lamports()? += buyer_deposit;

    // return seller
    **escrow.to_account_info().try_borrow_mut_lamports()? -= seller_deposit;
    **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_deposit;

    // FIX: amount_locked was never cleared after this full payout.
    escrow.amount_locked = 0;

    // Change state to Refunded
    order.state = OrderState::Refunded as u8;

    Ok(())
}