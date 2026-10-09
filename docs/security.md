# Nector Security

This document describes Nector's security model, what users and reviewers are trusting, the controls built into each component, and the known limitations of the current release.

It is based on the source code in this repository. See [architecture.md](./architecture.md) for the system overview and [smart-contract.md](./smart-contract.md) for the on-chain program.

---

## 1. Status at a Glance

| Item | Status |
| --- | --- |
| Network | Solana **Mainnet** |
| Program ID | `WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb` |
| Contract version | V0.3 (Anchor 0.32.1) |
| External security audit | **None.** The contract has never been audited. |
| Program upgrade authority | **A single wallet.** The program is upgradeable (see [section 3](#3-upgrade-authority)). |
| Custody of escrow funds | Program-derived accounts (PDAs). No Nector-held private key can release escrow funds directly. |
| Tests | Manual devnet test scripts, one per instruction, in `smart-contract/nector-smart-contract-V0.3/tests/`. There is no automated assertion suite. |

**Use Nector only with funds you can afford to lose.**

---

## 2. Trust Model

| Component | What it is trusted for | What it is not trusted for |
| --- | --- | --- |
| **Smart contract** | Everything financial: escrow custody, state transitions, deadlines, dispute outcomes, NFT swaps | Nothing outside its own code |
| **Upgrade authority holder** | Not deploying malicious or buggy upgrades | n/a (see section 3) |
| **Keeper Bot** | Liveness: submitting timeout transactions on time | Deciding outcomes. The contract validates every deadline. |
| **Supabase** | Chat, metadata, files, display status | Financial truth. Rows are editable by order participants. |
| **Web frontend** | Building the transaction the user signs | Moving funds without a Phantom signature |
| **Phantom wallet** | Key custody and transaction signing by the user | n/a |
| **RPC provider (Helius)** | Serving chain data and NFT (DAS) queries | Funds. A bad RPC can mislead the UI but cannot sign for users. |
| **CoinGecko** | Display-only SOL/USD price | Anything in the contract. The contract does not use prices. |

The central rule is:

> Financial state lives on-chain. Anything off-chain is a convenience layer and must not be used as proof of who owns what.

---

## 3. Upgrade Authority

The Nector program is deployed as an **upgradeable** Solana program, and its upgrade authority is held by **a single wallet**.

This matters for the non-custodial claim:

- With the **current deployed code**, no administrator function exists that releases or redirects escrow funds. Payouts follow the rules in the instructions.
- The holder of the upgrade authority key can deploy **new program code**. Escrow accounts are PDAs of this program, so new code could in principle change how those funds are handled.
- Users are therefore trusting the holder of that key not to ship a malicious or faulty upgrade. This trust is in addition to trusting that the current code is correct, which has not been independently audited.

Anyone can check the current authority on-chain, for example:

```bash
solana program show WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb --url mainnet-beta
```

or on the program's Explorer page:
https://explorer.solana.com/address/WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb

See [section 9](#9-known-limitations-and-hardening-opportunities) for ways to reduce this trust.

---

## 4. Smart Contract Controls

### 4.1 State machine

Every order has a numeric state, and each instruction requires specific states and rejects all others with `InvalidState`. Instructions cannot skip phases. The full list of states and transitions is in [smart-contract.md](./smart-contract.md#4-order-states).

### 4.2 Role checks

Each instruction checks the signer or account against the wallets stored in the order:

- buyer-only: `buyer_fund_escrow`, `buyer_cancel`, `confirm_delivery`, `open_dispute`, `pay_seller_during_discuss`
- seller-only: `seller_fund_escrow`, `seller_cancel`, `mark_shipped`, `refund_buyer`, `respond_dispute`, `refund_during_discuss`
- listing seller only: `cancel_nft_listing`, `cancel_core_nft`

The buyer and seller accounts passed to payout instructions are checked against `order.buyer_wallet` and `order.seller_wallet`, so funds cannot be redirected to a different account.

### 4.3 PDA integrity

| Account | Seeds |
| --- | --- |
| `SellerAccount` | `["seller", seller]` |
| `Order` | `["order", seller, order_index]` |
| `EscrowAccount` | `["escrow", order]` |
| `NftListing` | `["nft_listing", seller, mint, nonce]` |
| `NftListingCounter` | `["nft_listing_counter", seller, mint]` |

Anchor re-derives these seeds on every instruction, so an escrow account cannot be paired with a different order. `create_order` also requires `order_index` to equal the seller's on-chain counter, which prevents index reuse.

### 4.4 Arithmetic and accounting

- All amount calculations use checked arithmetic (`checked_add`, `checked_mul`, `checked_div`, `checked_sub`), failing with `MathOverflow` instead of wrapping.
- Before every payout the program requires `escrow.amount_locked` to cover the total payout, failing with `InsufficientEscrow`.
- `escrow.amount_locked` is reset to `0` after full payouts.

### 4.5 Fixed addresses

The fee wallet and the burn address are hard-coded in the program and enforced with an `address =` constraint, so a caller cannot substitute a different recipient:

| Purpose | Address |
| --- | --- |
| Fee wallet | `5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR` |
| Burn (incinerator) | `1nc1nerator11111111111111111111111111111111` |

Changing either requires a program upgrade.

### 4.6 Deadlines and timeouts

The four timeout instructions (`confirm_timeout`, `shipping_timeout`, `buyer_win`, `draw`) check the on-chain clock themselves and reject early calls (`ConfirmNotExpired`, `ShippingNotExpired`, `DisputeDeadlineNotReached`, `DiscussionNotReached`). They require no signature from either party, so anyone can submit them. The Keeper is a convenience, not a gate.

### 4.7 NFT escrow

- `list_nft` only accepts mints with 0 decimals and a supply of 1, and requires the seller to hold exactly 1 token (`NotAnNft`).
- The NFT moves into a vault token account whose authority is the listing PDA, so only the program can move it again.
- `buy_nft` is an atomic swap: payment, NFT transfer and account closing happen in one transaction.
- Metaplex Core assets use a separate CPI-based path and are validated against the Core program (`NotACoreAsset`).
- Each listing gets a new PDA through a per-(seller, mint) nonce, so old listings can never collide with new ones.

---

## 5. Threat Model

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| **Skipping or replaying a state** | Per-instruction state checks; one state change per instruction | Depends on the code being correct. Not audited. |
| **Redirecting a payout** | Buyer, seller, fee and burn accounts are all checked against stored or hard-coded addresses | None known |
| **Fake escrow or order accounts** | PDA seed constraints re-derived by Anchor | None known |
| **Arithmetic overflow or underflow** | Checked math; `InsufficientEscrow` guard | None known |
| **Early timeout call** | Contract checks the clock; rejects early calls | Timing is limited to the Solana clock's resolution |
| **Keeper offline** | Timeouts are permissionless; anyone can submit them | Orders may stay unsettled until someone submits the transaction |
| **Keeper wallet compromised** | The Keeper wallet only pays fees and has no authority over escrow funds | Loss of the fee balance in that wallet |
| **Keeper credentials leaked** | See [section 7](#7-operational-security) | The Supabase service-role key bypasses Row Level Security (see 6.1) |
| **Stalling a dispute** | Every phase has a 24-hour limit, and `draw` burns the whole escrow | See griefing in section 9 |
| **Seller does not ship** | `shipping_timeout` refunds the buyer in full and charges the seller a 20% penalty (half to the buyer, half burned) | Fees paid at funding are not refunded |
| **Seller does not answer a dispute** | `buyer_win`: same penalty path | None beyond timing, see 9.2 |
| **Fake NFT or wrong asset** | Supply, decimals and balance checks; Core program owner check | The buyer still has to verify what the NFT represents |
| **Replaying a login signature** | One-time, server-issued message bound to the site, the wallet and a 5-minute expiry; nonce is consumed atomically | None known. Login fails with `SITE_NOT_CONFIGURED` if `NEXT_PUBLIC_SITE_URL` is not set |
| **Malicious frontend** | Users sign each transaction in Phantom | A compromised site could request harmful transactions. Users should review what they sign. |
| **Manipulated price display** | The contract never uses prices | The USD figure in the UI is informational only |

---

## 6. Off-Chain Security

### 6.1 Supabase

- Row Level Security is enabled on all application tables.
- Messages and escrow orders are visible only to their participants.
- Profiles and usernames are readable by authenticated users; users can write only their own.
- Feedback is insert-only for users.
- `auth_nonces` (one-time login messages) has Row Level Security enabled, no policies and no grants for users, so only the server's service-role key can read or write it.
- Storage buckets use separate policies. Private buckets (`chat-images`, `chat-voice`, `escrow`, `digital-delivery`) are limited to the relevant participants, and `digital-delivery` uploads are limited to the order's seller.

**Limitation:** RLS restricts rows, not columns. An order participant can edit any column of their own order row, including `status` and the transaction fields. Supabase values are therefore display data, and the on-chain order state is the source of truth.

The Keeper writes to Supabase with the service-role key, which bypasses RLS. That key must never reach the frontend or the repository.

### 6.2 Frontend and wallet sign-in

- Only Phantom is supported.
- The frontend builds transactions; the user approves and signs each one in the wallet.
- The frontend does not hold keys and cannot move funds without a signature.

**Wallet sign-in** uses a one-time message issued by the server:

1. The browser asks `/api/auth/nonce` for a message for the user's wallet.
2. The server creates a random nonce and a message that names the site's domain, the wallet and a 5-minute expiry. It stores the message in `auth_nonces`.
3. Phantom signs exactly that message.
4. `/api/auth/phantom` accepts the login only if the nonce exists, is unused and unexpired, the wallet and domain match, and the signature is valid for the stored message.
5. The nonce is marked used in a single atomic update, so it works once, even if two requests arrive at the same time.

A signature collected on another site, or from an earlier login, can't be replayed, because it is not bound to a nonce the server issued for this login.

The domain in the message is never taken from client-controlled request headers. In production it comes from `NEXT_PUBLIC_SITE_URL`, which must match the address users open (for example `https://www.nector.chat` if the site serves on `www`). On Vercel preview deployments it comes from `VERCEL_URL`. In local development the `Host` header is accepted only for `localhost` and `127.0.0.1`. If none of these applies, login fails with `SITE_NOT_CONFIGURED`. A phishing site therefore can't obtain a message that names its own domain.

### 6.3 Keeper

The Keeper checks, at startup, that:

1. the RPC URL uses HTTP or HTTPS,
2. the RPC hostname does not contain `devnet` or `testnet`,
3. the loaded program ID equals the expected mainnet program,
4. the program account exists, and
5. the program account is executable.

The hostname check is a heuristic. The program ID and executable checks are what confirm it is talking to the real program.

---

## 7. Operational Security

Secrets that must **never** be committed to the repository:

| Secret | Used by |
| --- | --- |
| Keeper wallet keypair (`bot.json`) | Keeper |
| `.env.local` (`SUPABASE_SERVICE_ROLE_KEY`, `SOLANA_RPC_URL` with API key) | Keeper |
| Program upgrade authority keypair | Deployment |
| Any deploy or authority keypair under `target/deploy/` | Deployment |

Recommended checks before the repository is public:

```bash
# make sure secrets are ignored
cat .gitignore

# scan the full git history for leaked secrets
gitleaks detect --source . --log-opts="--all"
```

If a secret was ever committed, deleting the file is not enough, because it remains in git history. Rotate the key or credential.

---

## 8. Economic Security

Security in Nector depends on state validation, time limits and bonds. The protocol does not try to determine real-world truth, for example whether a physical item was really delivered. It creates financial consequences instead.

| Situation | Outcome |
| --- | --- |
| Normal completion | Seller gets the price and their bond back; buyer gets the buyer bond back |
| Seller never ships, or never answers a dispute | Buyer is made whole and gets half of a 20% penalty; the other half is burned |
| Dispute not resolved within the discussion window | The whole escrow is burned (`draw`) |

Bond sizes, fees and exact payouts are in [smart-contract.md](./smart-contract.md#7-economic-model).

A platform fee of 1% of the price is paid by each side when funding, and is not refunded on cancellation, refund or dispute.

---

## 9. Known Limitations and Hardening Opportunities

### 9.1 Not audited

The contract has not been reviewed by an external security firm. Bugs may exist.

### 9.2 Dispute windows are not enforced by `open_dispute` / `respond_dispute`

These two instructions do not check a deadline themselves. The deadlines are enforced by the matching timeout instructions (`confirm_timeout`, `buyer_win`).

If nobody has yet submitted the timeout transaction, a buyer can still open a dispute after the 24-hour review window, and a seller can still respond after the 24-hour response window. The first valid transaction to land decides the outcome. The Keeper's 10-second scan keeps this window short in practice.

### 9.3 Single-wallet upgrade authority

See [section 3](#3-upgrade-authority). Options that reduce this trust include moving the authority to a multisig, adding a timelock, or revoking it to make the program immutable. Revoking prevents future fixes.

### 9.4 Dispute griefing and draws

`draw` burns the entire escrow, including both parties' own funds. A party who is willing to lose their own bond can force a stalemate that costs the other party as well. This is the intended deterrent against stalling, but it also means a draw is a loss for both sides.

### 9.5 Input validation gaps

- `create_order` does not reject a price of `0`. The `InvalidPrice` error exists but is not used.
- The 1% fee uses integer division, so prices below 100 lamports produce a fee of `0`.

### 9.6 Off-chain data is editable by participants

See [section 6.1](#61-supabase). Moving status updates behind a database trigger or a server-side function would stop participants from editing `status` directly.

### 9.7 Keeper is operated by Nector

Timeouts are permissionless, but Nector currently runs the Keeper that submits them. The Keeper scans all order accounts every cycle, which will become slower as the number of orders grows.

### 9.8 If the Supabase update fails after a timeout

If a timeout transaction succeeds on-chain but the following Supabase update fails, the Keeper does not retry the update. The on-chain state is correct; the displayed status may be stale until corrected.

### 9.9 Wallet sign-in limits

- The nonce route allows each client IP 20 login messages per 5 minutes. The limit is per IP, not per wallet, so nobody can lock another wallet out of login. The IP is read from `x-vercel-forwarded-for`, `x-real-ip` or `x-forwarded-for` (in that order), which can be trusted only on a host that sets them itself, such as Vercel. If no IP can be determined in production, the route fails with `NONCE_FAILED` instead of skipping the limit. Only a keyed hash of the IP is stored (key: `AUTH_IP_HASH_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` if it is empty). If you deploy behind another proxy, make sure it overwrites these headers, and also rate limit at the host or CDN.
- For users who sign up with email, the wallet saved by the Connect Phantom button is sent by the browser without a signature. Users who sign in with Phantom are not affected, because their wallet is proven at sign-in.

---

## 10. Reporting a Vulnerability

If you find a security issue, please report it privately before disclosing it publicly.

Contact us through one of these channels:

- Discord: https://discord.gg/2djtd6a47
- Telegram: @P33M_real
- X: https://x.com/p33mTheRealOne/

Please include:

- a description of the issue and its impact,
- the instruction, account or file involved,
- steps or a transaction that reproduces it, preferably on a local validator or devnet.

Please do not:

- test against other users' funds or accounts,
- publicly disclose the issue before we have had a chance to respond,
- run denial-of-service tests against the production Keeper, database or RPC.
