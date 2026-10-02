use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct RefundBuyer<'info> {

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
    pub seller: Signer<'info>,

    /// CHECK
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,
}

pub fn refund_buyer_handler(
    ctx: Context<RefundBuyer>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;

    // ---------- security ----------

    require!(
        order.state == OrderState::OpenDispute as u8,
        ErrorCode::InvalidState
    );

    require!(
        ctx.accounts.seller.key() == order.seller_wallet,
        ErrorCode::InvalidSeller
    );

    require!(
        ctx.accounts.buyer.key() == order.buyer_wallet,
        ErrorCode::InvalidBuyer
    );

    // ---------- economics ----------

    let price = order.price_lamports;

    // buyer deposit = price + 20%
    let buyer_deposit = price
        .checked_add(
            price
                .checked_mul(20)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(100)
                .ok_or(ErrorCode::MathOverflow)?,
        )
        .ok_or(ErrorCode::MathOverflow)?;

    // seller bond saved in order
    let seller_deposit = order.bond_lamports;

    let total = buyer_deposit
        .checked_add(seller_deposit)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        escrow.amount_locked >= total,
        ErrorCode::InsufficientEscrow
    );

    // ---------- transfers ----------

    // refund buyer
    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_deposit;
    **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += buyer_deposit;

    // refund seller
    **escrow.to_account_info().try_borrow_mut_lamports()? -= seller_deposit;
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_deposit;

    // ---------- accounting ----------

    escrow.amount_locked = 0;

    order.state = OrderState::Refunded as u8;

    Ok(())
}