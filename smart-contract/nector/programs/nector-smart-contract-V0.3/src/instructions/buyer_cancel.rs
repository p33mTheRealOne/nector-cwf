use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, ErrorCode, OrderState};

pub fn buyer_cancel_handler(
    ctx: Context<BuyerCancel>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;

    require!(
        order.state == OrderState::BuyerFunded as u8,
        ErrorCode::InvalidState
    );

    require!(
        ctx.accounts.buyer.key() == order.buyer_wallet,
        ErrorCode::InvalidBuyer
    );

    let amount = escrow.amount_locked;

    **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += amount;

    // FIX: amount_locked was never cleared after the payout, leaving
    // escrow bookkeeping out of sync with the account's real lamport
    // balance. order.state already gates re-entry, but this keeps the
    // tracked value honest for any off-chain reader / future code path.
    escrow.amount_locked = 0;

    order.state = OrderState::Cancelled as u8;

    Ok(())
}

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct BuyerCancel<'info> {

    #[account(
        mut,
        seeds = [
            b"order",
            seller.key().as_ref(),
            &order_index.to_le_bytes()
        ],
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
    pub seller: UncheckedAccount<'info>,
}