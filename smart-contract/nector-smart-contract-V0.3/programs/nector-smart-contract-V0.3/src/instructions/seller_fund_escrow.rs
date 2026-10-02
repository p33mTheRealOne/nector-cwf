use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};
use crate::{Order, EscrowAccount, ErrorCode, OrderState};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct SellerFundEscrow<'info> {

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

    #[account(
        mut,
        address = pubkey!("5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR")// You can change to your own fee wallet
    )]
    /// CHECK: platform fee wallet
    pub fee_wallet: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn seller_fund_escrow_handler(
    ctx: Context<SellerFundEscrow>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;

    // clone account info before taking a mutable borrow
    let escrow_account_info = ctx.accounts.escrow.to_account_info();

    let escrow = &mut ctx.accounts.escrow;

    let clock = Clock::get()?;

    // Only Seller
    require!(
        ctx.accounts.seller.key() == order.seller_wallet,
        ErrorCode::InvalidSeller
    );

    // Only state = BuyerFunded
    require!(
        order.state == OrderState::BuyerFunded as u8,
        ErrorCode::InvalidState
    );

    // read price from order
    let price = order.price_lamports;

    // Same bond formulas as before (20% for BTR, 120% for STR), checked.
    let bond = match order.mode {
        0 => price
            .checked_mul(20)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?, // BTR
        1 => price
            .checked_mul(120)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(100)
            .ok_or(ErrorCode::MathOverflow)?, // STR
        _ => return err!(ErrorCode::InvalidMode),
    };

    // Calculate 1%
    let fee = price
        .checked_mul(1)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;

    // ---------------- TRANSFER BOND -> ESCROW ----------------
    let bond_transfer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.seller.to_account_info(),
            to: escrow_account_info.clone(),
        },
    );

    transfer(bond_transfer_ctx, bond)?;

    // ---------------- TRANSFER FEE -> FEE WALLET ----------------
    let fee_transfer_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.seller.to_account_info(),
            to: ctx.accounts.fee_wallet.to_account_info(),
        },
    );

    transfer(fee_transfer_ctx, fee)?;

    escrow.amount_locked = escrow
        .amount_locked
        .checked_add(bond)
        .ok_or(ErrorCode::MathOverflow)?;

    // save economics to order
    order.bond_lamports = bond;
    order.fee_lamports = order
        .fee_lamports
        .checked_add(fee)
        .ok_or(ErrorCode::MathOverflow)?;
    order.total_lamports = order
        .total_lamports
        .checked_add(bond)
        .ok_or(ErrorCode::MathOverflow)?;
    order.seller_funded_at = clock.unix_timestamp;
    // Change state to SellerFunded
    order.state = OrderState::SellerFunded as u8;

    Ok(())
}