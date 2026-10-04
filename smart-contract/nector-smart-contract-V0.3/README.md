# Nector Smart Contract (V0.3)

The on-chain program behind Nector: a non-custodial escrow for physical products, digital products and NFTs, written with **Anchor 0.32.1**.

| | |
| --- | --- |
| Program ID (Mainnet) | [`WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb`](https://explorer.solana.com/address/WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb) |
| Framework | Anchor 0.32.1, Rust 2021 edition |
| Dependencies | `anchor-spl` (Token, Associated Token, Token-2022), `mpl-core` 0.11.1 |
| Audit | **Not audited** |

For how the program works (accounts, states, payouts, fees), see [docs/smart-contract.md](../docs/smart-contract.md). This file explains how to **build it and try it yourself**.

---

## Read this first

- **The repository is configured for Mainnet.** `Anchor.toml` has `cluster = "mainnet"`. Running `anchor deploy` or other Anchor commands with this config would use real SOL. Switch to devnet first (see [step 2](#2-point-the-project-at-devnet)).
- **The scripts in `tests/` are not an automated test suite.** Each file is a standalone command-line script that sends one real transaction and takes arguments. They are hard-coded to **devnet** (`https://api.devnet.solana.com`).
- **Don't run `anchor test`.** `Anchor.toml` points its `test` command at `tests/**/*.ts` with `ts-mocha`, which would load every script at once without any arguments.
- **You can't redeploy to the Mainnet program ID.** That address is controlled by its upgrade authority. To experiment, deploy your own copy under a new program ID, as described below.

---

## Requirements

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://solana.com/docs/intro/installation)
- [Anchor 0.32.1](https://www.anchor-lang.com/docs/installation) (install with `avm install 0.32.1 && avm use 0.32.1`)
- Node.js 20 or newer, with npm or yarn

---

## 1. Install and build

```bash
cd nector-smart-contract-V0.3
npm install
anchor build
```

The build produces:

```text
target/deploy/nector_smart_contract_v0_3.so      # the program binary
target/idl/nector.json                           # the IDL used by every script in tests/
```

You must build before running any script, because they import `../target/idl/nector.json`.

> `Cargo.toml` pins a few crates (`base64ct`, `wincode`, `wincode-derive`, `signature`) to exact versions. These pins are intentional. Keep them so the build resolves.

---

## 2. Point the project at devnet

Create a devnet wallet and fund it:

```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url https://api.devnet.solana.com
solana airdrop 2
```

Edit `Anchor.toml` to use devnet instead of mainnet:

```toml
[programs.devnet]
nector_smart_contract_v0_3 = "<your program id>"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

(and remove the `[programs.mainnet]` section.)

---

## 3. Deploy your own copy to devnet

The source declares the Mainnet program ID in `declare_id!`. Give your copy its own ID and deploy it:

```bash
anchor keys sync     # creates a program keypair and updates declare_id! and Anchor.toml
anchor build         # rebuild with the new ID
anchor deploy
```

The scripts take the program address from the IDL, so after you rebuild they talk to **your** deployment.

> Keep `target/deploy/*-keypair.json` private. It is the program's keypair. Never commit it.

---

## 4. Create test wallets

You need at least a **seller** and a **buyer**, each with some devnet SOL:

```bash
solana-keygen new --outfile seller.json --no-bip39-passphrase
solana-keygen new --outfile buyer.json  --no-bip39-passphrase

solana address -k seller.json
solana address -k buyer.json

solana airdrop 2 $(solana address -k seller.json) --url devnet
solana airdrop 2 $(solana address -k buyer.json)  --url devnet
```

Every script signs with the wallet in the `ANCHOR_WALLET` environment variable, so switch wallets by changing it:

```bash
export ANCHOR_WALLET=$PWD/seller.json    # act as the seller
export ANCHOR_WALLET=$PWD/buyer.json     # act as the buyer
```

Use the full path (`$PWD/...`). A leading `~` is not expanded inside Node.

> Add `seller.json`, `buyer.json`, `target/` and `node_modules/` to `.gitignore`. Never commit keypair files.

---

## 5. Run an escrow order end to end

Run the commands from the project folder. Replace `<SELLER>` and `<BUYER>` with the addresses printed in step 4, and `N` with the **order index** printed by `create_order`.

```bash
# 1. Seller creates the order (also creates the seller account the first time)
export ANCHOR_WALLET=$PWD/seller.json
npx ts-node -T tests/create_order.ts BTR physical "Test item" <BUYER> 0.05 24
#   prints: Order index: N

# 2. Buyer funds: price + 20% bond + 1% fee
export ANCHOR_WALLET=$PWD/buyer.json
npx ts-node -T tests/buyer_fund_escrow.ts N <SELLER>

# 3. Seller funds the bond (BTR 20%, STR 120%) + 1% fee, then marks the order shipped
export ANCHOR_WALLET=$PWD/seller.json
npx ts-node -T tests/seller_fund_escrow.ts N
npx ts-node -T tests/mark_shipped.ts N

# 4. Buyer confirms delivery. Seller is paid and bonds are returned
export ANCHOR_WALLET=$PWD/buyer.json
npx ts-node -T tests/confirm_delivery.ts N <SELLER>
```

`-T` (transpile-only) skips type checking so the scripts start faster.

### Dispute path

```bash
# Buyer opens a dispute (after step 3 above, instead of confirming)
export ANCHOR_WALLET=$PWD/buyer.json
npx ts-node -T tests/open_dispute.ts N <SELLER>

# Seller chooses one:
export ANCHOR_WALLET=$PWD/seller.json
npx ts-node -T tests/refund_buyer.ts N <BUYER>          # refund, no penalty
npx ts-node -T tests/respond_dispute.ts N               # or: enter the 24h discussion

# During discussion, either:
npx ts-node -T tests/refund_during_discuss.ts N <BUYER>               # seller refunds
export ANCHOR_WALLET=$PWD/buyer.json
npx ts-node -T tests/pay_seller_during_discuss.ts N <SELLER>          # buyer pays seller
```

---

## 6. Script reference

`N` is the order index. All paths are in `tests/`.

### Escrow orders

| Script | Signer | Arguments | Program instruction |
| --- | --- | --- | --- |
| `create_order.ts` | Seller | `<BTR\|STR> <physical\|digital> "<name>" <buyer address> <price in SOL> <shipping hours>` | `init_seller` (first time), `create_order` |
| `buyer_fund_escrow.ts` | Buyer | `N <seller address>` | `buyer_fund_escrow` |
| `buyer_cancel.ts` | Buyer | `N <seller address>` | `buyer_cancel` |
| `seller_fund_escrow.ts` | Seller | `N` | `seller_fund_escrow` |
| `seller_cancel.ts` | Seller | `N <buyer address>` | `seller_cancel` |
| `mark_shipped.ts` | Seller | `N` | `mark_shipped` |
| `confirm_delivery.ts` | Buyer | `N <seller address>` | `confirm_delivery` |
| `open_dispute.ts` | Buyer | `N <seller address>` | `open_dispute` |
| `respond_dispute.ts` | Seller | `N` | `respond_dispute` |
| `refund_buyer.ts` | Seller | `N <buyer address>` | `refund_buyer` |
| `refund_during_discuss.ts` | Seller | `N <buyer address>` | `refund_during_discuss` |
| `pay_seller_during_discuss.ts` | Buyer | `N <seller address>` | `pay_seller_during_discuss` |

`create_order.ts` limits: shipping hours 1 to 720 for physical, 1 to 48 for digital. Digital orders must use `BTR`.

### Timeouts (any wallet can run these)

These instructions need no particular signer. Use any wallet that has a little SOL for the fee. The contract rejects the call until the deadline has passed.

| Script | Arguments | Allowed after | Program instruction |
| --- | --- | --- | --- |
| `shipping_timeout.ts` | `N <seller address>` | seller funded + shipping hours | `shipping_timeout` |
| `confirm_timeout.ts` | `N <seller address>` | marked shipped + 24h | `confirm_timeout` |
| `buyer_win.ts` | `N <seller address>` | dispute opened + 24h | `buyer_win` |
| `draw.ts` | `N <seller address>` | seller responded + 24h | `draw` |

Because the shortest shipping window is 1 hour and the other deadlines are 24 hours, testing a timeout means waiting for real time to pass.

### NFTs

| Script | Signer | Arguments | Program instruction |
| --- | --- | --- | --- |
| `list_nft.ts` | Seller | `<mint> <price in SOL>` | `list_nft` |
| `buy_nft.ts` | Buyer | `<seller address> <mint>` | `buy_nft` |
| `cancel_nft_listing.ts` | Seller | `<mint>` | `cancel_nft_listing` |
| `list_core_nft.ts` | Seller | `<asset> <price in SOL> [collection]` | `list_core_nft` |
| `buy_core_nft.ts` | Buyer | `<seller address> <asset> [collection]` | `buy_core_nft` |
| `cancel_core_nft.ts` | Seller | `<asset> [collection]` | `cancel_core_nft` |

The NFT scripts need an NFT you already own on devnet: a classic SPL / Token-2022 mint (decimals 0, supply 1) or a Metaplex Core asset.

The `tests/how_to_use/` folder holds short per-script notes, plus `workflow.txt`, an outline of the escrow flow.

---

## Project layout

```text
nector-smart-contract-V0.3/
├── Anchor.toml                         # cluster and wallet (set to mainnet, change for devnet)
├── Cargo.toml                          # workspace and release profile
├── package.json
├── programs/nector-smart-contract-V0.3/
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs                      # entrypoints, accounts, enums, errors, create_order
│       └── instructions/               # one file per instruction
└── tests/
    ├── *.ts                            # one command-line script per instruction
    └── how_to_use/                     # usage notes
```

---

## Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| `Cannot find module '../target/idl/nector.json'` | Run `anchor build` first. |
| `ANCHOR_WALLET is not set` or a file-not-found error | Export `ANCHOR_WALLET` with the full path to a keypair file. |
| `Attempt to debit an account but found no record of a prior credit` | The wallet has no devnet SOL. Airdrop some. |
| `AccountNotInitialized` or "program does not exist" | The program isn't deployed to devnet under the ID in your IDL. Re-run steps 3 and `anchor build`. |
| `InvalidState` | The order isn't in the state the instruction needs. Check the order flow in [docs/smart-contract.md](../docs/smart-contract.md). |
| `ShippingNotExpired`, `ConfirmNotExpired`, `DisputeDeadlineNotReached` or `DiscussionNotReached` | A timeout script was run before its deadline. This is expected. Wait and retry. |
| Wrong order index | Use the `Order index` printed by `create_order.ts`, not a number from the examples in `how_to_use/`. |
| `anchor deploy` tries to use Mainnet | `Anchor.toml` still says `cluster = "mainnet"`. Change it to devnet (step 2). |

Some scripts, such as `create_order.ts`, still contain a hard-coded program ID from an earlier devnet deployment (`9buv2W...`). The scripts build the program from the IDL, so this constant has no effect, but it can be removed.

---

## Security notes

- The program has **not been audited**.
- The program is upgradeable and its upgrade authority is held by a single wallet. See [docs/security.md](../docs/security.md).
- Never commit wallet keypairs (`seller.json`, `buyer.json`, `target/deploy/*-keypair.json`) or any file that contains a private key.
