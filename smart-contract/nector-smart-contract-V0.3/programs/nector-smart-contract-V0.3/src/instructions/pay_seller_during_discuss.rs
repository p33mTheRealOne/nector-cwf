use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, OrderState, ErrorCode};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct PaySellerDuringDiscuss<'info> {

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
    pub buyer: Signer<'info>,

    #[account(mut)]
    /// CHECK
    pub seller: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn pay_seller_during_discuss_handler(
    ctx: Context<PaySellerDuringDiscuss>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;

    require!(
        order.buyer_wallet == ctx.accounts.buyer.key(),
        ErrorCode::Unauthorized
    );

    require!(
        order.seller_wallet == ctx.accounts.seller.key(),
        ErrorCode::InvalidSeller
    );

    require!(
        order.state == OrderState::SellerResponded as u8,
        ErrorCode::InvalidState
    );

    // Same formulas as before (120% buyer deposit; seller deposit is
    // 20% for BTR or 120% for STR), computed with checked arithmetic.
    let price = order.price_lamports;

    let buyer_deposit = price
        .checked_add(
            price
                .checked_mul(20)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(100)
                .ok_or(ErrorCode::MathOverflow)?,
        )
        .ok_or(ErrorCode::MathOverflow)?;

    let seller_deposit = if order.mode == 0 {
        price
            .checked_mul(20)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?
    } else {
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

    let buyer_bond = buyer_deposit
        .checked_sub(price)
        .ok_or(ErrorCode::MathOverflow)?;

    let seller_receive = price
        .checked_add(seller_deposit)
        .ok_or(ErrorCode::MathOverflow)?;

    let buyer_receive = buyer_bond;

    // FIX: there was no check that escrow actually held enough to cover
    // both payouts before subtracting from its lamports — an undersized
    // escrow would have hit a raw integer-underflow panic instead of a
    // clean, named error.
    let total = seller_receive
        .checked_add(buyer_receive)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        escrow.amount_locked >= total,
        ErrorCode::InsufficientEscrow
    );

    **escrow.to_account_info().try_borrow_mut_lamports()? -= seller_receive;
    **ctx.accounts.seller.try_borrow_mut_lamports()? += seller_receive;

    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_receive;
    **ctx.accounts.buyer.try_borrow_mut_lamports()? += buyer_receive;

    // FIX: amount_locked was never cleared after this full payout.
    escrow.amount_locked = 0;

    order.state = OrderState::Completed as u8;

    Ok(())
}