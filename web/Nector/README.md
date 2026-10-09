# Nector Web App

The web front end for Nector: a chat-native, non-custodial escrow app on Solana. It contains the landing page, the documentation site, sign-in, and the chat and escrow interface.

Built with **Next.js 16**, **React 19**, **TypeScript** and **Tailwind CSS 4**. It talks to three things:

| Service | Used for |
| --- | --- |
| **Supabase** | Sign-in, profiles, contacts, chat messages, escrow order metadata, file storage, realtime updates |
| **Solana Mainnet** (through your RPC provider) | Reading chain data and sending transactions to the Nector program |
| **Phantom wallet** | Signing in and signing escrow transactions |

For the full system design see [docs/architecture.md](../../docs/architecture.md).

---

## Read this first

- **The app is wired to Mainnet.** The program ID `WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb` is hard-coded in `lib/anchorClient.ts` and `idl/nector.json`. Running it locally with a Mainnet RPC uses **real SOL**. To try it safely, follow [Running on devnet](#running-on-devnet).
- **You need your own Supabase project.** The app can't run without one. The schema is in [`supabase/schema.sql`](../../supabase/schema.sql).
- **You need an RPC endpoint with DAS support** (for example Helius) for NFT features. A plain public Solana RPC works for escrow orders but can't read NFT assets.
- **Only Phantom is supported** as a wallet.

---

## Requirements

- Node.js **20.9 or newer** (required by Next.js 16) and npm
- A Supabase project
- A Solana RPC URL (Helius recommended)
- The [Phantom](https://phantom.com/) browser extension

---

## Setup

### 1. Clone repository
 
```bash
git clone https://github.com/p33mTheRealOne/nector-cwf
```

### 2. Install dependencies

```bash
cd ~/nector-cwf/web/Nector
npm install
```

### 3. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL editor** and run the whole of [`supabase/schema.sql`](../../supabase/schema.sql). It creates the tables (including `auth_nonces`, which Phantom sign-in needs), Row Level Security policies, the five storage buckets and the realtime publication.
3. Under **Authentication**, make sure the **Email** provider is enabled. Wallet sign-in creates a Supabase user behind the scenes and signs it in with a magic-link token.
4. Under **Authentication → URL Configuration**, set the **Site URL** to where the app runs (for local development, `http://localhost:3000`) and add `<site url>/auth/callback` to the redirect URLs.
5. Copy the project URL, the **anon** key and the **service-role** key from **Project Settings → API**.

### 4. Create `.env.local`

Create `web/Nector/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service-role key>
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<your key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| Variable | Exposed to the browser? | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key. Access is limited by Row Level Security. |
| `SUPABASE_SERVICE_ROLE_KEY` | **No, server only** | Bypasses Row Level Security. Used by the sign-up, wallet sign-in and avatar-sync API routes. |
| `SOLANA_RPC_URL` | **No, server only** | RPC endpoint used by the `/api/solana-rpc` proxy. Keeps your RPC API key out of the browser. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public URL of the site, exactly as users open it, for example `https://www.nector.chat` if the site serves on `www`. Used for auth redirects and as the domain and URI in the wallet sign-in message. The domain is never read from request headers. **Set it in production:** without it, sign-in fails with `SITE_NOT_CONFIGURED`. Locally, keep it equal to the address you open (including the port), or leave it empty. On Vercel preview deployments, `VERCEL_URL` is used when it is empty. |
| `SUPABASE_URL` | No | Optional. The avatar-sync route uses it if set, otherwise `NEXT_PUBLIC_SUPABASE_URL`. |
| `AUTH_IP_HASH_SECRET` | **No, server only** | Optional. Secret key used to hash client IP addresses for the login rate limit. If empty, `SUPABASE_SERVICE_ROLE_KEY` is used. Only the hash is stored. |

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). When you are signed out you see the landing page. After you sign in, the same address shows the chat and escrow app.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (uses Webpack: `next dev --webpack`) |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

---

## How sign-in works

There are two ways in:

**Phantom wallet**

1. The user clicks sign in with Phantom. The browser asks `/api/auth/nonce` for a login message.
2. The server creates a random nonce and a message that names the site's domain, the wallet and a 5-minute expiry. It stores the message in the `auth_nonces` table and returns it.
3. Phantom signs exactly that message.
4. The browser posts the wallet address, the signature and the nonce to `/api/auth/phantom`.
5. The server checks that the nonce exists, is unused and unexpired, and that the wallet, domain and signature match. It marks the nonce as used, so it works only once.
6. The server creates (or finds) a Supabase user for that wallet, saves the wallet on the user's profile, and returns a one-time magic-link token.
7. The browser exchanges that token for a Supabase session.

The nonce route allows each IP address 20 login messages per 5 minutes. This limit is per IP, not per wallet, so nobody can lock another wallet out of login.

**Email and password**

`/api/auth/signup` creates the user and reserves a unique username.

After the first sign-in the user picks a username on `/onboarding/username`.

---

## Pages and API routes

### Pages

| Route | Content |
| --- | --- |
| `/` | Landing page (signed out) or the chat and escrow app (signed in) |
| `/auth`, `/auth/callback` | Sign in, sign up, session callback |
| `/onboarding/username` | Choose a username |
| `/about`, `/privacy-terms` | Information pages |
| `/docs/*` | Documentation: introduction, how it works, dispute, timeout, modes, security, Nector Mini, Nector1k, smart-contract versions |

### API routes

| Route | Purpose |
| --- | --- |
| `POST /api/auth/nonce` | Create a one-time login message for a wallet and store it in `auth_nonces` |
| `POST /api/auth/phantom` | Verify the signed login message (nonce, wallet, domain, expiry, signature) and return a sign-in token |
| `POST /api/auth/signup` | Create an email and password account with a unique username |
| `POST /api/auth/set-username` | Reserve a username for the signed-in user (lowercase letters, digits, `.` and `_`, 3 to 20 characters) |
| `POST /api/profile/sync-avatar` | Sync the profile avatar after sign-in |
| `POST /api/solana-rpc` | Proxy for an allow-listed set of Solana JSON-RPC methods, so the RPC key stays on the server |
| `GET /api/nft-image?url=` | Fetches NFT metadata and images on the server and passes them to the browser, because many NFT hosts block direct browser requests (CORS) |

The browser never connects to your RPC provider directly. All chain reads and `sendTransaction` calls go through `/api/solana-rpc`, and confirmation uses HTTP polling instead of WebSockets.

---

## Project layout

```text
Nector/
├── app/
│   ├── page.tsx                 # landing page or chat app
│   ├── Chat/AppHome.tsx         # chat and escrow interface
│   ├── auth/                    # sign in, sign up, callback
│   ├── onboarding/username/
│   ├── docs/                    # documentation pages
│   ├── about/  privacy-terms/
│   └── api/
│       ├── auth/                # nonce, phantom, signup, set-username
│       ├── profile/sync-avatar/
│       ├── solana-rpc/          # allow-listed RPC proxy
│       └── nft-image/
├── components/                  # landing page sections, navbar, docs sidebar
├── lib/
│   ├── anchorClient.ts          # program ID, Anchor client, transaction helpers
│   ├── pda.ts                   # PDA derivation
│   ├── siws.ts                  # wallet sign-in message helpers
│   ├── clientIp.ts              # client IP and IP hash for the login rate limit
│   └── supabase/                # browser and server clients
├── idl/nector.json              # Nector program IDL
├── public/                      # static assets, whitepaper PDF
├── package.json
└── next.config.ts
```

---

## Using your own Program ID

By default the app uses the IDL in `idl/nector.json`, which belongs to the **Nector Mainnet program** (`WytegETAnkDtkeo5H63QvnRPKgK39ez5MSqSBqwydPb`). To use the app with **your own deployment** of the smart contract, you need to deploy the contract yourself and replace the app's IDL with the IDL produced by your build.

### 1. Deploy your own copy of the smart contract

Follow [smart-contract/nector-smart-contract-V0.3/README.md](../../smart-contract/nector-smart-contract-V0.3/README.md): run `anchor keys sync`, `anchor build` and `anchor deploy`. Note the new **program ID** that `anchor keys sync` gives you.

### 2. Replace the app's IDL

The build writes the IDL to `target/idl/nector.json` inside the smart-contract project. Copy it over the app's IDL:

```bash
cp <path to smart-contract project>/target/idl/nector.json web/Nector/idl/nector.json
```

Check that the `address` field is now your program ID:

```bash
grep -m1 '"address"' web/Nector/idl/nector.json
```

Use the IDL from the same build you deployed. An IDL from different source code can describe accounts and instructions that don't match the deployed program.

### 3. Update `PROGRAM_ID` in `lib/anchorClient.ts`

The program ID is also set as a separate constant in `lib/anchorClient.ts`:

```ts
export const PROGRAM_ID = new PublicKey(
  "<your program ID>"
);
```

This is required even after you replace the IDL. The Anchor client takes the program ID from the IDL, but `lib/pda.ts` derives the seller, order and escrow addresses from `PROGRAM_ID`. If the two differ, the app derives addresses for the wrong program and transactions fail.

If you changed the platform fee wallet in your copy of the contract, also update `NFT_FEE_WALLET` near the top of `app/Chat/AppHome.tsx` to match.

### 4. Restart the app

Restart `npm run dev` (or rebuild with `npm run build`) so the new IDL and constant are picked up.

### 5. Use your own Supabase project and RPC

Use a Supabase project that holds orders created through **your** deployment ([supabase/README.md](../../supabase/README.md)), and set `SOLANA_RPC_URL` to an RPC URL for the network you deployed to.

### Keep every component on the same program

The smart contract, the web app and the Keeper must all use the same program ID and the same IDL:

| Component | What to change |
| --- | --- |
| Smart contract | Deployed under your program ID |
| Web app | `idl/nector.json` and `PROGRAM_ID` in `lib/anchorClient.ts` |
| Keeper | `idl/nector.json` and `EXPECTED_PROGRAM_ID` in `timeout/keeper.ts` (see [keeper/README.md](../../keeper/README.md#using-your-own-program-id)) |

---

## Running on devnet

To test without real money you need your own copy of the program on devnet.

1. Build and deploy the program to devnet under your own program ID. See [smart-contract/nector-smart-contract-V0.3/README.md](../../smart-contract/nector-smart-contract-V0.3/README.md).
2. Replace the program ID in **both** `lib/anchorClient.ts` (`PROGRAM_ID`) and the `address` field of `idl/nector.json`. See [Using your own Program ID](#using-your-own-program-id) for the full steps.
3. Set `SOLANA_RPC_URL` to a devnet RPC endpoint.
4. Use your own Supabase project.

The Keeper in [`keeper/`](../../keeper/README.md) refuses devnet RPCs and checks for the Mainnet program ID on purpose, so on devnet timeouts are not triggered automatically unless you change those checks. You can submit them by hand with the timeout scripts in the smart-contract project.

---

## Deploying

The app is a standard Next.js project and can be hosted anywhere that runs Next.js 16 (for example Vercel).

1. Set all environment variables from the table above in your host's settings.
2. Set `NEXT_PUBLIC_SITE_URL` to the exact address users open, for example `https://nector.chat` (or `https://www.nector.chat` if the site serves on `www`). Sign-in fails without it. If the site is reachable on two hosts, redirect one to the other, because Phantom refuses to sign a message whose URI differs from the page. Also update the Site URL and redirect URLs in Supabase to match. Your host must send the visitor's IP in `x-vercel-forwarded-for`, `x-real-ip` or `x-forwarded-for` and overwrite those headers (Vercel does), because the login rate limit depends on it.
3. Build and start:

```bash
npm run build
npm run start
```

---

## Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| `Solana RPC is not configured on the server.` | `SOLANA_RPC_URL` is missing from `.env.local`. Add it and restart the dev server. |
| Missing Supabase URL or key errors, or sign-in fails immediately | Check `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Restart after changing `.env.local`. |
| Queries fail with "relation does not exist" | `supabase/schema.sql` hasn't been run in this Supabase project. |
| Redirected away after sign-in, or the callback loops back to `/auth` | The Site URL or redirect URL in Supabase doesn't match the address you are using. |
| Phantom does not appear or sign-in does nothing | Install the Phantom extension and unlock it. Only Phantom is supported. |
| Phantom sign-in fails with `INVALID_OR_EXPIRED_NONCE` | The login message expired (5 minutes), was already used, or was issued for a different site. Sign in again. If it keeps failing, check that `NEXT_PUBLIC_SITE_URL` matches the address you use. |
| Phantom sign-in fails with `NONCE_FAILED` or `relation "auth_nonces" does not exist` | Either the `auth_nonces` table or its `ip_hash` column is missing (re-run `supabase/schema.sql`, section 26), or, in production, the host sent no client IP header, so the rate limit can't run. Check that your host sets `x-vercel-forwarded-for`, `x-real-ip` or `x-forwarded-for`. |
| Phantom sign-in fails with `TOO_MANY_REQUESTS` or `SITE_NOT_CONFIGURED` | `TOO_MANY_REQUESTS`: this IP asked for more than 20 login messages in 5 minutes. Wait a few minutes. `SITE_NOT_CONFIGURED`: set `NEXT_PUBLIC_SITE_URL` to a valid `http` or `https` URL. |
| Phantom says the URI in the sign-in message does not match the requesting app's origin | `NEXT_PUBLIC_SITE_URL` is not the address in the browser bar. Compare the protocol, the host (`www` or not, `localhost` or `127.0.0.1`) and the port, and set it to exactly what you open, or leave it empty in development. In production, redirect the other host to the main one. |
| NFTs don't load, or `Method not found` | Your RPC provider doesn't support the DAS API. Use a DAS-capable provider such as Helius. |
| Transactions fail on a fresh deployment | The wallet has no SOL, or the program ID in `lib/anchorClient.ts` and `idl/nector.json` doesn't match a deployed program. See [Using your own Program ID](#using-your-own-program-id). |
| Chat or orders don't update live | Realtime isn't enabled on `messages` and `escrow_orders`. Re-run the realtime section of `supabase/schema.sql`. |

---

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It must only exist in server-side environment variables. Never prefix it with `NEXT_PUBLIC_`.
- `SOLANA_RPC_URL` contains your RPC API key and is kept on the server by the `/api/solana-rpc` proxy.
- The anon key is meant to be public. Row Level Security on the Supabase tables is what protects the data.
- Add a `.gitignore` that excludes `.env.local`, `.env*.local`, `node_modules/` and `.next/`, and never commit environment files.
- The app never holds user keys. Every escrow transaction is built in the browser and signed by the user in Phantom.
- Phantom sign-in uses a one-time message issued by the server (`/api/auth/nonce`), stored in `auth_nonces` and valid for 5 minutes, so an old signature can't be replayed to log in. The domain in that message always comes from `NEXT_PUBLIC_SITE_URL` (or `VERCEL_URL` on Vercel previews), never from request headers. The nonce route allows 20 messages per IP per 5 minutes, and only a keyed hash of the IP is stored.

See [docs/security.md](../../docs/security.md) for the full security model.
