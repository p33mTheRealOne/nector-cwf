use anchor_lang::prelude::*;
use crate::{Order, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct MarkShipped<'info> {

    #[account(
        mut,
        seeds = [b"order", seller.key().as_ref(), &order_index.to_le_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

pub fn mark_shipped_handler(
    ctx: Context<MarkShipped>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;

    let clock = Clock::get()?;

    // verify seller
    require!(
        ctx.accounts.seller.key() == order.seller_wallet,
        ErrorCode::InvalidSeller
    );

    // must be seller funded
    require!(
        order.state == OrderState::SellerFunded as u8,
        ErrorCode::InvalidState
    );

    // save timestamp
    order.mark_shipped_at = clock.unix_timestamp;

    // change state
    order.state = OrderState::MarkShipped as u8;

    Ok(())
}