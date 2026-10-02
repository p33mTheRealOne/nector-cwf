use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct BuyerWin<'info> {
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
    /// CHECK: must match order.buyer_wallet
    pub buyer: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: must match order.seller_wallet
    pub seller: UncheckedAccount<'info>,

    #[account(
        mut,
        address = pubkey!("1nc1nerator11111111111111111111111111111111")
    )]
    /// CHECK: Solana's canonical incinerator address. Nobody holds its
    /// private key, so lamports sent here are permanently unspendable —
    /// this is how the penalty portion is "burned" instead of paid to
    /// the platform, since native SOL has no protocol-level burn instruction.
    pub burn_wallet: SystemAccount<'info>,
}

pub fn buyer_win_handler(
    ctx: Context<BuyerWin>,
    _order_index: u64,
) -> Result<()> {
    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;
    let clock = Clock::get()?;

    require!(
        order.state == OrderState::OpenDispute as u8,
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

    let respond_deadline = order
        .open_dispute_at
        .checked_add(24 * 3600)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        clock.unix_timestamp >= respond_deadline,
        ErrorCode::DisputeDeadlineNotReached
    );

    // Same formulas as before, computed with checked arithmetic.
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
    let seller_deposit = order.bond_lamports;
    let penalty = price
        .checked_mul(20)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;

    let buyer_reward = penalty.checked_div(2).ok_or(ErrorCode::MathOverflow)?;
    let fee_amount = penalty.checked_div(2).ok_or(ErrorCode::MathOverflow)?;

    let seller_refund = seller_deposit.checked_sub(penalty).unwrap_or(0);

    let total = buyer_deposit
        .checked_add(buyer_reward)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(fee_amount)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(seller_refund)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        escrow.amount_locked >= total,
        ErrorCode::InsufficientEscrow
    );

    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_deposit;
    **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += buyer_deposit;

    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_reward;
    **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += buyer_reward;

    // penalty portion is burned, not sent to the platform
    **escrow.to_account_info().try_borrow_mut_lamports()? -= fee_amount;
    **ctx.accounts.burn_wallet.to_account_info().try_borrow_mut_lamports()? += fee_amount;

    if seller_refund > 0 {
        **escrow.to_account_info().try_borrow_mut_lamports()? -= seller_refund;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_refund;
    }

    escrow.amount_locked = 0;
    order.state = OrderState::BuyerWonDispute as u8;

    Ok(())
}