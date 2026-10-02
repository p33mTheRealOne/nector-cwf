use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct ConfirmDelivery<'info> {

    #[account(
        mut,
        seeds = [b"order", seller.key().as_ref(), &order_index.to_le_bytes()],
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

    /// CHECK
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,
}

pub fn confirm_delivery_handler(
    ctx: Context<ConfirmDelivery>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;

    // ---------------- security ----------------

    require!(
        order.state == OrderState::MarkShipped as u8,
        ErrorCode::InvalidState
    );

    require!(
        ctx.accounts.buyer.key() == order.buyer_wallet,
        ErrorCode::InvalidBuyer
    );

    require!(
        ctx.accounts.seller.key() == order.seller_wallet,
        ErrorCode::InvalidSeller
    );

    // ---------------- economics ----------------

    let price = order.price_lamports;

    let buyer_bond = price
        .checked_mul(20)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;

    let seller_bond = order.bond_lamports;

    // payouts
    let seller_payment = price;
    let buyer_refund = buyer_bond;
    let seller_refund = seller_bond;

    let total = seller_payment
        .checked_add(buyer_refund)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(seller_refund)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        escrow.amount_locked >= total,
        ErrorCode::InsufficientEscrow
    );

    // ---------------- transfers ----------------

    // seller gets price
    **escrow.to_account_info().try_borrow_mut_lamports()? -= seller_payment;
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_payment;

    // buyer gets bond
    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_refund;
    **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += buyer_refund;

    // seller gets bond back
    **escrow.to_account_info().try_borrow_mut_lamports()? -= seller_refund;
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_refund;

    // ---------------- state update ----------------

    // FIX: escrow.amount_locked was never cleared even though the escrow
    // was fully paid out here.
    escrow.amount_locked = 0;
    order.state = OrderState::Completed as u8;
    Ok(())
}