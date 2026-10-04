# Nector Keeper

The Keeper is a small Node.js bot that watches Nector orders on Solana Mainnet and submits **timeout transactions** when a deadline has passed. It then updates the order status in Supabase so the app shows the right state.

Smart contracts can't run on a schedule, so something outside the chain has to send the transaction when a deadline expires. That is the Keeper's only job.

> The Keeper does **not** decide outcomes. The Nector program checks every deadline itself and rejects early calls. The Keeper wallet only pays transaction fees and has no authority over escrow funds. Timeouts are permissionless, so anyone can run their own Keeper.

---

## What it does

Every **10 seconds** the Keeper fetches all `Order` accounts of the Nector program once, then checks four timeouts in parallel:

| Timeout | Order state | Deadline | Program call | Supabase `status` | Message action |
| --- | --- | --- | --- | --- | --- |
| Confirm (review) | `MarkShipped` (5) | `markShippedAt` + 24h | `confirmTimeout` | `Completed` | `confirm_timeout` |
| Discussion | `SellerResponded` (10) | `sellerRespondAt` + 24h | `draw` | `Cancelled` | `draw` |
| Respond | `OpenDispute` (7) | `openDisputeAt` + 24h | `buyerWin` | `Completed` | `respond_timeout` |
| Shipping | `SellerFunded` (2) | `sellerFundedAt` + `shippingHours` | `shippingTimeout` | `Cancelled` | `shipping_timeout` |

After a transaction succeeds, the Keeper:

1. updates `escrow_orders.status` for that order (matched by `escrow_pda`, which holds the Order PDA address), and
2. inserts a chat message with `message_type = 'escrow_update'` and body `escrow_update:<orderPda>:<action>`, so the buyer and seller see the update in their conversation.

The transaction signature is printed in the log. It is not stored in Supabase.

If a transaction fails (for example, someone else already submitted it), the Keeper logs the error and moves on. The order is checked again on the next scan.

---

## Requirements

- **Node.js 20 or newer** and npm
- A **Solana Mainnet RPC URL** (for example Helius)
- A **Supabase project** with the Nector schema applied (`supabase/schema.sql`) and its **service-role key**
- A **funded Solana wallet** for the Keeper (it pays transaction fees, so keep a small SOL balance in it)

---

## Folder layout

```text
keeper/
├── package.json
├── tsconfig.json
├── idl/
│   └── nector.json        # Anchor IDL of the Nector program
├── timeout/
│   └── keeper.ts          # the Keeper
├── bot.json               # Keeper wallet keypair (you create this, never commit it)
└── .env.local             # configuration (you create this, never commit it)
```

The script resolves `.env.local`, `bot.json` and `idl/` one folder above `timeout/`, so they must sit in the `keeper/` root as shown.

---

## Setup

## 1. Clone repository

```bash
git clone https://github.com/p33mTheRealOne/nector-cwf
```

### 2. Install dependencies

```bash
cd nector-cwf/keeper
npm install
```

### 3. Create the Keeper wallet

`bot.json` must be a standard Solana keypair file: a JSON array of 64 numbers. Generate one with the Solana CLI:

```bash
solana-keygen new --outfile bot.json --no-bip39-passphrase
solana address -k bot.json     # prints the Keeper's public address
```

Then send a small amount of SOL to that address so it can pay fees. If you already have a keypair file, copy it to `keeper/bot.json` instead.

> The `bot.json` in this repository is only a placeholder. The Keeper will fail to start until you replace it with a real keypair file.

### 4. Create `.env.local`

Create `keeper/.env.local`:

```bash
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service-role key>
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your key>
```

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key. It **bypasses Row Level Security**, so treat it as a secret. |
| `SOLANA_RPC_URL` | HTTP(S) Mainnet RPC. URLs whose hostname contains `devnet` or `testnet` are rejected. |

All three are required.

### 5. Keep secrets out of git

Add this to `.gitignore` before you commit anything:

```gitignore
.env.local
bot.json
node_modules/
dist/
```

---

## Run

```bash
npm run keeper
```

This runs `ts-node timeout/keeper.ts`. On start it prints a banner and keeps scanning until you stop it with `Ctrl+C`:

```text
Program verified: WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb

========================================
       NECTOR UNIFIED KEEPER
========================================
Network: MAINNET
Keeper wallet: <public address>
Program ID: WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb
RPC: https://mainnet.helius-rpc.com/
Scan interval: 10 seconds
Burn wallet: 1nc1nerator11111111111111111111111111111111
========================================
```

Each scan then logs the order counts and a line per checked order, for example `Confirm check: <orderPda> | expired: false`. When a deadline has passed you will see `Trigger ...` followed by the transaction signature and `Supabase updated: ...`.

### Startup safety checks

The Keeper refuses to start unless all of these pass:

1. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SOLANA_RPC_URL` are set.
2. The RPC URL uses `http` or `https` and its hostname does not contain `devnet` or `testnet`.
3. `bot.json` exists.
4. The program ID in `idl/nector.json` equals `WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb`.
5. That program account exists on the RPC's network and is executable.

---

## Running it continuously

For a real deployment, run the Keeper under a process manager so it restarts after crashes and reboots. For example with [pm2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
cd keeper
pm2 start npm --name nector-keeper -- run keeper
pm2 save
pm2 startup          # follow the printed command to start on boot
pm2 logs nector-keeper
```

Tips:

- Run it as a normal user, not `root`.
- Make `bot.json` and `.env.local` readable only by that user (`chmod 600 bot.json .env.local`).
- Watch the Keeper wallet's SOL balance. If it runs out, timeouts stop being submitted.

---

## Troubleshooting

| Message | Cause and fix |
| --- | --- |
| `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local` | `.env.local` is missing, in the wrong folder, or incomplete. It must be in `keeper/`, next to `package.json`. |
| `Missing SOLANA_RPC_URL in .env.local` | Add `SOLANA_RPC_URL`. There is no default RPC. |
| `Invalid SOLANA_RPC_URL: Devnet/Testnet RPC is not allowed` | The RPC hostname contains `devnet` or `testnet`. Use a Mainnet RPC. |
| `Keeper wallet not found: .../bot.json` | Create `keeper/bot.json` (see step 2). |
| `Unexpected token` / JSON parse error when reading `bot.json` | The file is still the placeholder text, or isn't a valid keypair JSON array. Replace it. |
| `WRONG NECTOR PROGRAM ID!` | `idl/nector.json` doesn't match the expected Mainnet program. Use the IDL from this repository. |
| `Program ... is not deployed on this network` | The RPC is not pointing at Mainnet. |
| `Confirm timeout failed` / `Draw failed` / `BuyerWin failed` / `Shipping timeout failed` with `NotExpired` or `NotReached` | The deadline hasn't passed on-chain yet, or the order was already settled by someone else. Usually harmless. |
| `Not found on Supabase: <orderPda>` | The transaction went through, but no `escrow_orders` row matches that order, so Supabase was not updated. |
| `Supabase update failed: ...` | The on-chain transaction succeeded but the database update failed. The Keeper does not retry it, because the order has already left the state it monitors. The on-chain state is correct; fix the row manually. |

---

## Security

- **`SUPABASE_SERVICE_ROLE_KEY`**: full database access that bypasses Row Level Security. Never put it in the frontend or the repository.
- **`bot.json`**: the Keeper's private key. It only needs enough SOL to pay fees, and it has no authority over escrow funds.
- **`SOLANA_RPC_URL`**: contains your RPC API key.
- If any of these were ever committed to git, deleting the file is not enough, because it stays in the history. Rotate the key or credential.

More in [docs/security.md](../docs/security.md).

---

## Running your own Keeper

Because the contract validates every deadline and the timeout instructions need no particular signer, anyone can run this bot, or write their own, against the public program. A second Keeper doesn't conflict with the first. Whichever transaction lands first settles the order, and the other simply fails with a harmless error.

This Keeper also writes to Supabase and requires a service-role key. Anyone outside the project who wants to run only the on-chain part would need to remove the Supabase calls from `timeout/keeper.ts`.
