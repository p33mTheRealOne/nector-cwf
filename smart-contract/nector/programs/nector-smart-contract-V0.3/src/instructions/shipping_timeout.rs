use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct ShippingTimeout<'info> {

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
    /// this is how the penalty portion is "burned" instead of paid to
    /// the platform, since native SOL has no protocol-level burn instruction.
    pub burn_wallet: SystemAccount<'info>,
}

pub fn shipping_timeout_handler(
    ctx: Context<ShippingTimeout>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;
    let escrow = &mut ctx.accounts.escrow;

    let clock = Clock::get()?;

    require!(
        order.state == OrderState::SellerFunded as u8,
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

    // ---------------- check shipping deadline ----------------

    let deadline = order
        .seller_funded_at
        .checked_add((order.shipping_hours as i64).checked_mul(3600).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        clock.unix_timestamp >= deadline,
        ErrorCode::ShippingNotExpired
    );

    // ---------------- economics ----------------
    // Same formulas as before, checked arithmetic.

    let price = order.price_lamports;
    let penalty = price
        .checked_mul(20)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;

    let buyer_bonus = penalty.checked_div(2).ok_or(ErrorCode::MathOverflow)?;
    let fee_amount = penalty.checked_div(2).ok_or(ErrorCode::MathOverflow)?;

    let buyer_deposit = price
        .checked_add(
            price
                .checked_mul(20)
                .ok_or(ErrorCode::MathOverflow)?
                .checked_div(100)
                .ok_or(ErrorCode::MathOverflow)?,
        )
        .ok_or(ErrorCode::MathOverflow)?;

    let seller_bond = order.bond_lamports;

    let seller_refund = seller_bond.checked_sub(penalty).unwrap_or(0);

    let total_needed = buyer_deposit
        .checked_add(buyer_bonus)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(fee_amount)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(seller_refund)
        .ok_or(ErrorCode::MathOverflow)?;

    require!(
        escrow.amount_locked >= total_needed,
        ErrorCode::InsufficientEscrow
    );

    // ---------------- transfer lamports ----------------

    // buyer refund
    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_deposit;
    **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += buyer_deposit;

    // buyer penalty reward
    **escrow.to_account_info().try_borrow_mut_lamports()? -= buyer_bonus;
    **ctx.accounts.buyer.to_account_info().try_borrow_mut_lamports()? += buyer_bonus;

    // penalty portion is burned, not sent to the platform
    **escrow.to_account_info().try_borrow_mut_lamports()? -= fee_amount;
    **ctx.accounts.burn_wallet.to_account_info().try_borrow_mut_lamports()? += fee_amount;

    // seller refund (STR case)
    if seller_refund > 0 {
        **escrow.to_account_info().try_borrow_mut_lamports()? -= seller_refund;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += seller_refund;
    }

    // FIX: escrow.amount_locked was never cleared here even though the
    // escrow was fully paid out across the branches above.
    escrow.amount_locked = 0;

    order.state = OrderState::ShippingTimedOut as u8;

    Ok(())
}