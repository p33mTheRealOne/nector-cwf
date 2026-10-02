use anchor_lang::prelude::*;
use crate::{Order, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct OpenDispute<'info> {

    #[account(
        mut,
        seeds = [b"order", seller.key().as_ref(), &order_index.to_le_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK
    pub seller: UncheckedAccount<'info>,
}

pub fn open_dispute_handler(
    ctx: Context<OpenDispute>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;

    let clock = Clock::get()?;

    // verify buyer
    require!(
        ctx.accounts.buyer.key() == order.buyer_wallet,
        ErrorCode::OnlyBuyerCanOpenDispute
    );

    // verify seller
    require!(
        ctx.accounts.seller.key() == order.seller_wallet,
        ErrorCode::InvalidSeller
    );

    // must be shipped
    require!(
        order.state == OrderState::MarkShipped as u8,
        ErrorCode::InvalidState
    );

    // save time
    order.open_dispute_at = clock.unix_timestamp;

    // change state
    order.state = OrderState::OpenDispute as u8;

    Ok(())
}