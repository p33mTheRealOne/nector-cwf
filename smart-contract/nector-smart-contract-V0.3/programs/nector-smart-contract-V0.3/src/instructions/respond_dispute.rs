use anchor_lang::prelude::*;
use crate::{Order, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct RespondDispute<'info> {

    #[account(
        mut,
        seeds = [b"order", seller.key().as_ref(), &order_index.to_le_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    #[account(mut)]
    pub seller: Signer<'info>,
}

pub fn respond_dispute_handler(
    ctx: Context<RespondDispute>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;

    let clock = Clock::get()?;

    // verify seller
    require!(
        ctx.accounts.seller.key() == order.seller_wallet,
        ErrorCode::InvalidSeller
    );

    // must be dispute
    require!(
        order.state == OrderState::OpenDispute as u8,
        ErrorCode::InvalidState
    );

    // save respond time
    order.seller_respond_at = clock.unix_timestamp;

    // change state
    order.state = OrderState::SellerResponded as u8;

    Ok(())
}