# Nector Smart Contract (V0.3)

Nector's on-chain program is a Solana program written with **Anchor 0.32.1**. It is the source of truth for escrow funds, order state, deadlines, dispute outcomes and NFT listings. The web app, Supabase and the Keeper Bot never decide financial outcomes; they only submit transactions that the program validates.

See [architecture.md](./architecture.md) for the full system picture and [security.md](./security.md) for the threat model.

---

## 1. Program / Deployment

| Item | Value |
| --- | --- |
| Network | Solana **Mainnet** |
| Framework | Anchor 0.32.1 (`anchor-spl` with `token`, `associated_token`, `token_2022`; `mpl-core` 0.11.1) |
| Version | V0.3 |
| Program ID | `WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb` |
| Program on Explorer | https://explorer.solana.com/address/WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb |
| Deploy transaction | https://explorer.solana.com/tx/35rU9AjJcvBg68WVYhQhZnzJAAy3j7N5RwCX1BHVWfsBKDT7ZcdK4ygxXuumjCnq8Xg4eDtHiSXeENVFg8WmvFp1 |
| Fee wallet | `5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR` (hard-coded in the program) |
| Burn address | `1nc1nerator11111111111111111111111111111111` (Solana incinerator) |
| Audit status | **Not audited** (see [Security status](#10-security-status)) |

Source layout:

```text
nector-smart-contract-V0.3/
├── Anchor.toml
├── programs/nector-smart-contract-V0.3/src/
│   ├── lib.rs                  # program entrypoints, accounts, enums, errors, create_order
│   └── instructions/           # one file per instruction
└── tests/                      # one test per instruction + how_to_use/ walkthroughs
```

---

## 2. Design Summary

- **Non-custodial.** Escrow SOL is held in a program-derived account (PDA). No admin key can release it.
- **Explicit state machine.** Every order has a numeric state; each instruction checks the current state and rejects anything else.
- **Deterministic disputes.** No human arbitrator. Outcomes follow from state, deadlines and bonds.
- **Economic incentives.** Both sides lock bonds. Missing a deadline costs the late party money, and an unresolved dispute burns the whole escrow.
- **Permissionless timeouts.** The timeout instructions (`confirm_timeout`, `shipping_timeout`, `buyer_win`, `draw`) require no signer from either party. The program checks the deadline itself, so anyone can submit them, not only Nector's Keeper.
- **Two sale types.** Physical and digital products use the escrow flow. NFTs use a separate atomic-swap listing flow.

---

## 3. Accounts and PDAs

| Account | Seeds | Purpose |
| --- | --- | --- |
| `SellerAccount` | `["seller", seller]` | Per-seller order counter (`order_count`). Created once by `init_seller`. |
| `Order` | `["order", seller, order_index (u64 LE)]` | State and terms of one order. |
| `EscrowAccount` | `["escrow", order]` | Holds the locked SOL for one order. |
| `NftListingCounter` | `["nft_listing_counter", seller, mint]` | Next listing nonce for a (seller, mint) pair. |
| `NftListing` | `["nft_listing", seller, mint, nonce (u64 LE)]` | One NFT listing. The vault token account is owned by this PDA. |

For Metaplex Core assets, the asset address takes the place of `mint` in the NFT seeds.

### `Order` fields

| Field | Type | Notes |
| --- | --- | --- |
| `mode` | `u8` | `0` = BTR, `1` = STR |
| `product_type` | `u8` | `0` = Physical, `1` = Digital |
| `order_name` | `String` | Max 100 bytes reserved |
| `buyer_wallet`, `seller_wallet` | `Pubkey` | |
| `price_lamports` | `u64` | Product price |
| `shipping_hours` | `u32` | Physical: 1 to 720. Digital: 1 to 48 |
| `state` | `u8` | See [Order States](#4-order-states) |
| `order_index` | `u64` | Must equal the seller's `order_count` at creation |
| `bond_lamports`, `fee_lamports`, `total_lamports` | `u64` | Written during funding |
| `seller_funded_at`, `mark_shipped_at`, `open_dispute_at`, `seller_respond_at` | `i64` | Unix timestamps used for deadlines |

---

## 4. Order States

| Value | State | Set by |
| --- | --- | --- |
| 0 | `Created` | `create_order` |
| 1 | `BuyerFunded` | `buyer_fund_escrow` |
| 2 | `SellerFunded` | `seller_fund_escrow` |
| 3 | `Cancelled` | `buyer_cancel`, `seller_cancel` |
| 4 | `ShippingTimedOut` | `shipping_timeout` |
| 5 | `MarkShipped` | `mark_shipped` |
| 6 | `Completed` | `confirm_delivery`, `confirm_timeout`, `pay_seller_during_discuss` |
| 7 | `OpenDispute` | `open_dispute` |
| 8 | `Refunded` | `refund_buyer`, `refund_during_discuss` |
| 9 | `BuyerWonDispute` | `buyer_win` |
| 10 | `SellerResponded` | `respond_dispute` |
| 11 | `Draw` | `draw` |

```text
Created ──► BuyerFunded ──► SellerFunded ──► MarkShipped ──► Completed
   │             │               │               │
   │             ▼               ├──► Cancelled  └──► OpenDispute ──► BuyerWonDispute
   │         Cancelled           │                        │
   │                             └──► ShippingTimedOut    ├──► Refunded
   │                                                      └──► SellerResponded ──► Completed
   │                                                                     ├──► Refunded
   │                                                                     └──► Draw
```

The Supabase `escrow_orders.status` values are an application-level mirror and do not use these exact names.

---

## 5. Instructions

### 5.1 Setup

| Instruction | Signer | Description |
| --- | --- | --- |
| `init_seller` | Seller | Creates the seller's `SellerAccount` with `order_count = 0`. |
| `create_order` | Seller | Creates an `Order` in state `Created`. Validates mode (0 or 1), product type (0 or 1), shipping hours (physical 1 to 720, digital 1 to 48) and that digital orders use BTR. `order_index` must equal the seller's `order_count`, which then increments. |

### 5.2 Funding and cancellation

| Instruction | Signer | Required state | Description |
| --- | --- | --- | --- |
| `buyer_fund_escrow` | Buyer (must match `order.buyer_wallet`) | `Created` | Buyer sends `price + 20%` to the escrow PDA and a `1%` fee to the fee wallet. |
| `buyer_cancel` | Buyer | `BuyerFunded` | Full escrow returned to the buyer. The 1% fee is **not** refunded. |
| `seller_fund_escrow` | Seller | `BuyerFunded` | Seller sends their bond to escrow (`20%` BTR, `120%` STR) and a `1%` fee to the fee wallet. Records `seller_funded_at`. |
| `seller_cancel` | Seller | `SellerFunded` | Both sides refunded in full (buyer `120%` of price, seller their bond). Fees are **not** refunded. |

### 5.3 Delivery

| Instruction | Signer | Required state | Description |
| --- | --- | --- | --- |
| `mark_shipped` | Seller | `SellerFunded` | Records `mark_shipped_at`; starts the 24-hour buyer review window. |
| `confirm_delivery` | Buyer | `MarkShipped` | Seller receives `price` plus their bond back; buyer receives their 20% bond back. Order becomes `Completed`. |
| `confirm_timeout` | None required | `MarkShipped` | Same payout as `confirm_delivery`, allowed once `mark_shipped_at + 24h` has passed. |
| `shipping_timeout` | None required | `SellerFunded` | Allowed once `seller_funded_at + shipping_hours` has passed. See [Penalty outcome](#72-payout-table). |

### 5.4 Dispute

| Instruction | Signer | Required state | Description |
| --- | --- | --- | --- |
| `open_dispute` | Buyer | `MarkShipped` | Records `open_dispute_at`. |
| `refund_buyer` | Seller | `OpenDispute` | Seller refunds immediately: buyer gets `120%` of price back, seller gets their bond back. Order becomes `Refunded`. |
| `respond_dispute` | Seller | `OpenDispute` | Records `seller_respond_at`; starts the 24-hour discussion window. |
| `buyer_win` | None required | `OpenDispute` | Allowed once `open_dispute_at + 24h` has passed with no response. Penalty outcome. |
| `refund_during_discuss` | Seller | `SellerResponded` | Same payout as `refund_buyer`. |
| `pay_seller_during_discuss` | Buyer | `SellerResponded` | Same payout as `confirm_delivery`. Order becomes `Completed`. |
| `draw` | None required | `SellerResponded` | Allowed once `seller_respond_at + 24h` has passed. The entire escrow is burned. |

### 5.5 NFT sales

| Instruction | Signer | Description |
| --- | --- | --- |
| `list_nft` | Seller | Checks the mint has 0 decimals and supply 1, moves the NFT into a vault token account owned by the listing PDA, and creates the listing. Works with classic SPL Token and Token-2022 mints. |
| `buy_nft` | Buyer | Atomic swap: buyer pays the price in SOL, the NFT moves from the vault to the buyer, the listing and vault are closed. |
| `cancel_nft_listing` | Seller | Returns the NFT to the seller and closes the listing and vault. |
| `list_core_nft` / `buy_core_nft` / `cancel_core_nft` | Seller / Buyer / Seller | Same flow for Metaplex Core assets, using a CPI-based escrow because Core assets have no mint or token account. |

---

## 6. Dispute Flow

```text
MarkShipped (24h review window)
   │
   ├── Buyer confirms ─────────────► Completed
   ├── Buyer silent, 24h passes ───► confirm_timeout ──► Completed
   └── Buyer opens dispute ──► OpenDispute (24h response window)
                                   │
                                   ├── Seller refunds ─────────► Refunded
                                   ├── No response, 24h passes ─► buyer_win ──► BuyerWonDispute
                                   └── Seller responds ──► SellerResponded (24h discussion window)
                                                              │
                                                              ├── Buyer pays seller ──► Completed
                                                              ├── Seller refunds ─────► Refunded
                                                              └── 24h passes ─────────► draw ──► Draw
```

---

## 7. Economic Model

Let `P` be the product price.

### 7.1 Deposits

| Mode | Buyer escrow deposit | Seller bond | Applies to |
| --- | --- | --- | --- |
| **BTR** (Buyer Take Risk) | `P + 20% P` | `20% P` | Physical and digital |
| **STR** (Seller Take Risk) | `P + 20% P` | `120% P` | Physical only |

Digital products must use BTR; `create_order` rejects STR for digital.

### 7.2 Payout table

`S` is the seller bond (`0.2 P` for BTR, `1.2 P` for STR). The buyer's escrow deposit is `1.2 P`.

| Outcome | Buyer receives | Seller receives | Burned |
| --- | --- | --- | --- |
| `confirm_delivery`, `confirm_timeout`, `pay_seller_during_discuss` | `0.2 P` | `P + S` | 0 |
| `buyer_cancel` | `1.2 P` | n/a (not funded) | 0 |
| `seller_cancel` | `1.2 P` | `S` | 0 |
| `refund_buyer`, `refund_during_discuss` | `1.2 P` | `S` | 0 |
| `shipping_timeout`, `buyer_win` (penalty) | `1.2 P + 0.1 P` | `S − 0.2 P` (BTR: `0`, STR: `P`) | `0.1 P` |
| `draw` | 0 | 0 | `1.2 P + S` (everything) |

In the penalty outcome the seller is charged `20% P`: half goes to the buyer as compensation and half is burned.

### 7.3 Fees

- The platform fee is **1% of the price**, sent straight to the fee wallet `5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR` at funding time.
- For escrow orders it is charged **to each side**: the buyer pays 1% in `buyer_fund_escrow` and the seller pays 1% in `seller_fund_escrow`, so the platform receives 2% of the price in total once both sides have funded.
- The fee is paid when funding, so it is **not refunded** on cancellation, refund or dispute outcomes.
- For NFT sales, the fee is **1% of the sale price**, deducted from the seller's proceeds: the buyer pays the listed price, the seller receives 99%, and the fee wallet receives 1%.

### 7.4 Burning

Native SOL has no burn instruction, so "burn" means sending lamports to Solana's incinerator address `1nc1nerator11111111111111111111111111111111`, which nobody controls. Burned amounts are not paid to the platform.

---

## 8. Timeouts and the Keeper

A Solana program cannot wake itself at a future time, so something must submit a transaction after a deadline. Nector runs a Keeper Bot that scans orders every 10 seconds, but the program validates every deadline.

| Condition | Deadline | Instruction | Resulting state |
| --- | --- | --- | --- |
| Seller did not ship | `seller_funded_at + shipping_hours` | `shipping_timeout` | `ShippingTimedOut` |
| Buyer did not confirm | `mark_shipped_at + 24h` | `confirm_timeout` | `Completed` |
| Seller did not respond to dispute | `open_dispute_at + 24h` | `buyer_win` | `BuyerWonDispute` |
| Discussion unresolved | `seller_respond_at + 24h` | `draw` | `Draw` |

- The Keeper does **not** decide outcomes. A transaction submitted before the deadline fails with `ShippingNotExpired`, `ConfirmNotExpired`, `DisputeDeadlineNotReached` or `DiscussionNotReached`.
- These instructions need no party's signature, so anyone can submit them. Protocol correctness does not depend on the Nector Keeper staying online.
- Deadlines use the Solana `Clock` unix timestamp.

---

## 9. NFT Listing Behavior and Relisting

- Listing moves the NFT into a vault token account whose authority is the listing PDA, so only this program can move it.
- A listing ends when it is **bought** (NFT to the buyer) or **cancelled** (NFT back to the seller). In both cases the vault and the listing account are closed, and the rent goes back to the seller.
- **Relisting is immediate and unconditional.** Each (seller, mint) pair has an `NftListingCounter` whose `next_nonce` increases with every listing, and the nonce is part of the listing PDA seeds. A new listing therefore gets a new address and never collides with an earlier one.
- At the application layer, Supabase enforces uniqueness only for active listings (`type = 'nft' AND nft_mint IS NOT NULL AND status = 'onchain_created'`).

---

## 10. Security Status

- **This contract has not been audited.** V0.3 is deployed on mainnet and has not been reviewed by an external security firm. Use it only with funds you can afford to lose.
- Built-in controls: per-instruction state checks, role checks against `order.buyer_wallet` / `order.seller_wallet`, PDA seed constraints on every order and escrow account, hard-coded fee and burn addresses, checked arithmetic (`checked_add`, `checked_mul`, ...), and an `InsufficientEscrow` check before every payout.
- Known behaviors worth reviewers' attention:
  - `open_dispute` and `respond_dispute` do not check a deadline themselves. A buyer can open a dispute, or a seller can respond, after the 24-hour window if no one has yet submitted the matching timeout transaction (`confirm_timeout` or `buyer_win`).
  - `create_order` does not reject a price of `0`.
  - Fee amounts use integer division, so very small prices round the 1% fee down (to `0` below 100 lamports).
- See [security.md](./security.md) for the wider threat model.

---

## 11. Errors

| Error | Meaning |
| --- | --- |
| `InvalidMode`, `InvalidProductType`, `InvalidModeForDigital`, `InvalidShippingTime` | Bad `create_order` inputs |
| `InvalidOrderIndex` | `order_index` does not equal the seller's `order_count` |
| `InvalidSeller`, `InvalidBuyer`, `Unauthorized`, `OnlyBuyerCanOpenDispute`, `InvalidListingSeller` | Wrong signer or account |
| `AlreadyFunded`, `InvalidState`, `ListingNotActive` | Instruction not allowed in the current state |
| `ShippingNotExpired`, `ConfirmNotExpired`, `DisputeDeadlineNotReached`, `DiscussionNotReached` | Timeout called too early |
| `InsufficientEscrow`, `MathOverflow` | Accounting guards |
| `NotAnNft`, `NotACoreAsset` | NFT validation failed |

---

## 12. Testing

Tests live in `tests/` (one file per instruction, plus `create_order.ts`). Step-by-step walkthroughs are in `tests/how_to_use/`.

```bash
yarn install
anchor test
```

The test script in `Anchor.toml` runs `ts-mocha` over `tests/**/*.ts`.

---

## 13. Integrating

Derive the main PDAs with `@solana/web3.js`:

```ts
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

const PROGRAM_ID = new PublicKey("WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb");

const [sellerPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("seller"), seller.toBuffer()],
  PROGRAM_ID
);

const [orderPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("order"), seller.toBuffer(), new BN(orderIndex).toArrayLike(Buffer, "le", 8)],
  PROGRAM_ID
);

const [escrowPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("escrow"), orderPda.toBuffer()],
  PROGRAM_ID
);
```

Every instruction that moves funds takes `order_index` as an argument, and the escrow instructions that pay the fee wallet or the burn address require those exact addresses as accounts.
