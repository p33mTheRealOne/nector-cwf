use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct Draw<'info> {

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

    /// CHECK
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,

    /// CHECK
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,

    #[account(
        mut,
        address = pubkey!("1nc1nerator11111111111111111111111111111111")
    )]
    /// CHECK: Solana's canonical incinerator address. Nobody holds its
    /// private key, so lamports sent here are permanently unspendable —
    /// this is how the draw payout is "burned" instead of paid to
    /// the platform, since native SOL has no protocol-level burn instruction.
    pub burn_wallet: SystemAccount<'info>,
}

pub fn draw_handler(
    ctx: Context<Draw>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;

    let clock = Clock::get()?;

    // ---------------- state ----------------

    require!(
        order.state == OrderState::SellerResponded as u8,
        ErrorCode::InvalidState
    );

    // verify buyer / seller
    require!(
        ctx.accounts.buyer.key() == order.buyer_wallet,
        ErrorCode::InvalidBuyer
    );

    require!(
        ctx.accounts.seller.key() == order.seller_wallet,
        ErrorCode::InvalidSeller
    );

    // ---------------- deadline ----------------

    let discussion_deadline = order
        .seller_respond_at
        .checked_add(24 * 3600)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        clock.unix_timestamp >= discussion_deadline,
        ErrorCode::DiscussionNotReached
    );

    // ---------------- economics ----------------

    let amount = escrow.amount_locked;

    require!(
        amount > 0,
        ErrorCode::InsufficientEscrow
    );

    // ---------------- transfer ----------------

    // on a draw, the pot is burned rather than paid to the platform
    **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.burn_wallet.to_account_info().try_borrow_mut_lamports()? += amount;

    // ---------------- accounting ----------------

    escrow.amount_locked = 0;

    order.state = OrderState::Draw as u8;

    Ok(())
}