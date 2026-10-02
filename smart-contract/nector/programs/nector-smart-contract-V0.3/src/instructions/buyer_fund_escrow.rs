use anchor_lang::prelude::*;
use crate::{Order, EscrowAccount, ErrorCode, OrderState};
use anchor_lang::system_program::{transfer, Transfer};

#[derive(Accounts)]
#[instruction(order_index: u64)]
pub struct BuyerFundEscrow<'info> {
    #[account(
        mut,
        seeds = [b"order", seller.key().as_ref(), &order_index.to_le_bytes()],
        bump
    )]
    pub order: Account<'info, Order>,

    #[account(
        init_if_needed,
        payer = buyer,
        space = 8 + EscrowAccount::SIZE,
        seeds = [b"escrow", order.key().as_ref()],
        bump
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: not read or written to in this instruction; only used elsewhere
    /// as a seed to derive/verify the `order` PDA, so no data checks are needed here.
    pub seller: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,

    #[account(
        mut,
        address = pubkey!("5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR")// You can change to your own fee wallet
    )]
    /// CHECK: platform fee wallet
    pub fee_wallet: SystemAccount<'info>,

}

pub fn fund_escrow_handler(
    ctx: Context<BuyerFundEscrow>,
    _order_index: u64,
) -> Result<()> {

    let order = &mut ctx.accounts.order;

    require!(
        ctx.accounts.buyer.key() == order.buyer_wallet,
        ErrorCode::InvalidBuyer
    );

    require!(
        order.state == OrderState::Created as u8,
        ErrorCode::AlreadyFunded
    );

    // Same 20% bond / 1% fee formulas as before, just overflow-checked.
    let price = order.price_lamports;
    let bond = price
        .checked_mul(20)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;
    let fee = price
        .checked_mul(1)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(100)
        .ok_or(ErrorCode::MathOverflow)?;

    let escrow_total = price.checked_add(bond).ok_or(ErrorCode::MathOverflow)?;

    order.bond_lamports = bond;
    order.fee_lamports = fee;
    order.total_lamports = escrow_total
        .checked_add(fee)
        .ok_or(ErrorCode::MathOverflow)?;

    // -----------------------------
    // transfer buyer -> escrow
    // -----------------------------

    let escrow_transfer = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.escrow.to_account_info(),
        },
    );

    transfer(escrow_transfer, escrow_total)?;

    // -----------------------------
    // transfer buyer -> fee wallet
    // -----------------------------

    let fee_transfer = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.fee_wallet.to_account_info(),
        },
    );

    transfer(fee_transfer, fee)?;

    // save escrow
    let escrow = &mut ctx.accounts.escrow;
    escrow.order = order.key();
    escrow.buyer = ctx.accounts.buyer.key();
    escrow.amount_locked = escrow_total;

    order.state = OrderState::BuyerFunded as u8;

    Ok(())
}