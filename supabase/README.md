# Nector Supabase Backend

This folder holds the database and storage setup for Nector. Everything is in one SQL file, [`schema.sql`](./schema.sql). Running it on a Supabase project creates:

- 6 tables with Row Level Security (RLS): `profiles`, `usernames`, `contacts`, `messages`, `escrow_orders`, `feedbacks`
- 5 storage buckets: `profiles`, `chat-images`, `chat-voice`, `escrow`, `digital-delivery`
- the RLS policies for those tables and buckets
- a trigger that keeps `profiles.updated_at` current
- realtime updates for `messages` and `escrow_orders`

The [web app](../web/Nector/README.md) and the [Keeper](../keeper/README.md) both depend on this setup. Neither works without it.

> Supabase stores the off-chain side of Nector: chat, order metadata and files. Escrow funds and order state live on Solana. See [docs/architecture.md](../docs/architecture.md).

---

## Quick start

### 1. Create a Supabase project

Create a new project at [supabase.com](https://supabase.com) and wait for it to finish provisioning.

### 2. Run the schema

1. Open **SQL Editor** in the Supabase dashboard.
2. Create a new query and paste the whole of [`schema.sql`](./schema.sql).
3. Click **Run**.

The file is wrapped in `BEGIN; ... COMMIT;`, so it is applied as a single unit. If any statement fails, nothing is applied, and you can fix the problem and run it again.

### 3. Verify

Run these in the SQL editor:

```sql
-- 6 tables, all with rowsecurity = true
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 5 buckets
select id, public, file_size_limit
from storage.buckets
order by id;

-- messages and escrow_orders should be listed
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime';

-- policies on the app tables and on storage
select schemaname, tablename, policyname
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

You should see `contacts`, `escrow_orders`, `feedbacks`, `messages`, `profiles` and `usernames`.

### 4. Configure authentication

In **Authentication**:

1. Make sure the **Email** provider is enabled. Phantom sign-in creates a Supabase user for the wallet and signs it in with a magic-link token, which needs this provider.
2. Under **URL Configuration**, set the **Site URL** to where the web app runs (`http://localhost:3000` for local development) and add `<site url>/auth/callback` to the **Redirect URLs**.

### 5. Connect the apps

Open **Project Settings → API** and copy the project URL, the `anon` key and the `service_role` key. Newer dashboards may list the `anon` and `service_role` keys under a "Legacy API keys" tab.

| Value | Web app (`web/Nector/.env.local`) | Keeper (`keeper/.env.local`) |
| --- | --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL` |
| `anon` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | not used |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

> The `service_role` key bypasses Row Level Security. Keep it in server-side environment variables only. Never expose it in the browser or commit it to git.

---

## Running Supabase locally (optional)

If you have Docker, you can run a local copy with the [Supabase CLI](https://supabase.com/docs/guides/local-development):

```bash
cd supabase
supabase init                          # creates config.toml in this folder
supabase start                         # starts the local stack
supabase migration new init_nector     # creates an empty file in supabase/migrations/
```

Copy the contents of `schema.sql` into the new migration file, then apply it:

```bash
supabase db reset
supabase status                        # prints the local API URL and keys
```

Use the printed API URL and keys in your `.env.local` files. The local dashboard (Studio) is also listed in the `supabase status` output.

To push the same migration to a hosted project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## Re-running the schema

The script is written to be run more than once:

- tables and indexes use `CREATE ... IF NOT EXISTS`
- policies and the trigger are dropped and recreated
- buckets are inserted or updated (`ON CONFLICT`)
- the realtime publication only adds tables that are missing

**Existing tables are not modified.** If you change a column or constraint in `schema.sql`, re-running it will not apply the change to a table that already exists. Use an `ALTER TABLE` statement or a migration, or start from a fresh project in development.

---

## What gets created

### Tables

| Table | Purpose | Key points |
| --- | --- | --- |
| `profiles` | One row per user | `bio` (max 160 characters), `avatar_url`, unique `wallet_address` |
| `usernames` | Unique usernames | One per user, 3 to 32 characters, globally unique |
| `contacts` | A user's contact list | Primary key `(owner_id, contact_id)`; a user can't add themselves |
| `messages` | Chat messages | `message_type` is `text`, `escrow` or `escrow_update`; sender and receiver must differ; `read_at` marks read messages |
| `escrow_orders` | Order metadata linked to on-chain orders | See below |
| `feedbacks` | In-app feedback | `type` is `Bug`, `Idea` or `Other` |

All user references point at `auth.users` and are deleted when the user is deleted (`ON DELETE CASCADE`).

### `escrow_orders`

This table ties the app to the blockchain.

- **`escrow_pda` is the primary key and holds the address of the on-chain Order account** (the Order PDA), despite its name. The Keeper finds orders by matching this column.
- `type` is `physical`, `digital` or `nft`. `nft_mint` is only allowed when `type = 'nft'`.
- `dispute_mode` is `BTR`, `STR` or empty.
- `status` is restricted to: `onchain_created`, `BuyerFunded`, `Shipping`, `Shipped`, `Completed`, `Cancelled`, `Dispute`, `Discuss`.
- Transaction signatures are stored per step: `tx_signature`, `funded_tx`, `seller_funded_tx`, `shipped_tx`, `confirm_tx`, `refund_tx`, `seller_refund_tx`, `dispute_tx`, `seller_respond_tx`, `pay_seller_tx`.
- Timestamps used by the interface: `shipping_deadline`, `seller_funded_at_unix`, `shipped_at_unix`, `dispute_opened_at_unix`, `seller_responded_at_unix`.
- Digital delivery file details: `delivery_file_path`, `delivery_file_name`, `delivery_file_size`.

**NFT relisting.** A partial unique index (`escrow_orders_one_active_nft_per_seller_mint`) allows only one active NFT listing per seller and mint, where active means `status = 'onchain_created'`. Cancelled and completed listings don't block listing the same NFT again.

### Storage buckets

| Bucket | Access | Size limit | File types | Path format |
| --- | --- | --- | --- | --- |
| `profiles` | Public read | 5 MB | JPEG, PNG, WebP | `<userId>.jpg` |
| `chat-images` | Private | 10 MB | JPEG, PNG, WebP | `<userA>__<userB>/<timestamp>_<uuid>.jpg` |
| `chat-voice` | Private | 20 MB | WebM, Ogg, MP4, M4A, MP3 audio | `<userA>__<userB>/...` |
| `escrow` | Private | 10 MB | JPEG, PNG, WebP | `<sellerId>/<escrowPda>.jpg` |
| `digital-delivery` | Private | 100 MB | Any | `<escrowPda>/<timestamp>_<fileName>` |

In the chat paths, the folder name is the two user IDs sorted and joined with `__`. The storage policies use that folder name to decide who can access a file.

### Row Level Security

RLS is enabled on every table. All policies apply to signed-in (`authenticated`) users.

| Table | Read | Write |
| --- | --- | --- |
| `profiles` | All signed-in users | Insert and update own row |
| `usernames` | All signed-in users | Insert and update own row |
| `contacts` | Own rows | Insert and delete own rows |
| `messages` | Sender or receiver | Insert as sender; the receiver can update (for example to mark as read) |
| `escrow_orders` | Buyer or seller | Seller inserts; buyer or seller updates |
| `feedbacks` | Nobody (insert-only) | Insert own rows |

Storage policies:

- `profiles`: anyone can read; a user can only write their own `<userId>.jpg`.
- `chat-images`, `chat-voice`: only the two users named in the folder can read or upload.
- `escrow`: a seller uploads into their own folder; the order's buyer and seller can read.
- `digital-delivery`: only the order's seller can upload; the order's buyer and seller can read.

**Limitation.** RLS limits rows, not columns. Either participant of an order can update any column of their own `escrow_orders` row, including `status` and the transaction columns. Treat Supabase values as display data. The on-chain order state is the source of truth for funds. See [docs/security.md](../docs/security.md).

### Realtime

`messages` and `escrow_orders` are added to the `supabase_realtime` publication, so the app updates chat and order status without a manual refresh. Supabase applies the RLS read policies to realtime events, so users only receive rows they are allowed to read.

---

## Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| `must be owner of table objects` or `permission denied` on `storage.objects` | Your role can't create storage policies from the SQL editor. Run the script as the project owner in the dashboard, or create the storage policies from **Storage → Policies**. |
| `publication "supabase_realtime" does not exist` | Realtime isn't set up on the project. Enable it under **Database → Replication**, then re-run the realtime section (section 25). |
| `new row violates row-level security policy` in the app | The user isn't signed in, isn't a participant, or is inserting a row as someone else (for example, a buyer creating an order, which only a seller can insert). |
| `violates check constraint "escrow_orders_status_check"` | The app sent a `status` outside the eight allowed values. |
| `duplicate key value violates unique constraint "escrow_orders_one_active_nft_per_seller_mint"` | The seller already has an active listing (`status = 'onchain_created'`) for that NFT mint. |
| `violates check constraint "messages_not_self_check"` | A message can't be sent to yourself. |
| A new column or constraint doesn't exist after re-running | The script doesn't change existing tables. See [Re-running the schema](#re-running-the-schema). |
| App can't read or write after setup | Check the three environment values in [step 5](#5-connect-the-apps) and restart the app. |

---

## Security notes

- Never commit `SUPABASE_SERVICE_ROLE_KEY`. If it leaks, rotate it in the Supabase dashboard.
- The `anon` key is meant to be public. RLS is what protects the data, so don't disable RLS on any table.
- The `profiles` bucket is public by design (profile pictures). The other four buckets are private.
