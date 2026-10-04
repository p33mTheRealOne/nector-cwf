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
2. Open the **SQL editor** and run the whole of [`supabase/schema.sql`](../../supabase/schema.sql). It creates the tables, Row Level Security policies, the five storage buckets and the realtime publication.
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
| `NEXT_PUBLIC_SITE_URL` | Yes | Public URL of the site, used when building auth redirects. If empty, relative URLs are used. |
| `SUPABASE_URL` | No | Optional. The avatar-sync route uses it if set, otherwise `NEXT_PUBLIC_SUPABASE_URL`. |

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

1. The user clicks sign in with Phantom and signs a short message.
2. The browser posts the wallet address, signature and message to `/api/auth/phantom`.
3. The server checks the signature, creates (or finds) a Supabase user for that wallet, and returns a one-time magic-link token.
4. The browser exchanges that token for a Supabase session.

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
| `POST /api/auth/phantom` | Verify a wallet signature and return a sign-in token |
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
│       ├── auth/                # phantom, signup, set-username
│       ├── profile/sync-avatar/
│       ├── solana-rpc/          # allow-listed RPC proxy
│       └── nft-image/
├── components/                  # landing page sections, navbar, docs sidebar
├── lib/
│   ├── anchorClient.ts          # program ID, Anchor client, transaction helpers
│   ├── pda.ts                   # PDA derivation
│   └── supabase/                # browser and server clients
├── idl/nector.json              # Nector program IDL
├── public/                      # static assets, whitepaper PDF
├── package.json
└── next.config.ts
```

---

## Running on devnet

To test without real money you need your own copy of the program on devnet.

1. Build and deploy the program to devnet under your own program ID. See [smart-contract/nector-smart-contract-V0.3/README.md](../../smart-contract/nector-smart-contract-V0.3/README.md).
2. Replace the program ID in **both** `lib/anchorClient.ts` (`PROGRAM_ID`) and the `address` field of `idl/nector.json`.
3. Set `SOLANA_RPC_URL` to a devnet RPC endpoint.
4. Use your own Supabase project.

The Keeper in [`keeper/`](../../keeper/README.md) refuses devnet RPCs and checks for the Mainnet program ID on purpose, so on devnet timeouts are not triggered automatically unless you change those checks. You can submit them by hand with the timeout scripts in the smart-contract project.

---

## Deploying

The app is a standard Next.js project and can be hosted anywhere that runs Next.js 16 (for example Vercel).

1. Set all environment variables from the table above in your host's settings.
2. Set `NEXT_PUBLIC_SITE_URL` to your production URL, and update the Site URL and redirect URLs in Supabase to match.
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
| NFTs don't load, or `Method not found` | Your RPC provider doesn't support the DAS API. Use a DAS-capable provider such as Helius. |
| Transactions fail on a fresh deployment | The wallet has no SOL, or the program ID in `lib/anchorClient.ts` and `idl/nector.json` doesn't match a deployed program. |
| Chat or orders don't update live | Realtime isn't enabled on `messages` and `escrow_orders`. Re-run the realtime section of `supabase/schema.sql`. |

---

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. It must only exist in server-side environment variables. Never prefix it with `NEXT_PUBLIC_`.
- `SOLANA_RPC_URL` contains your RPC API key and is kept on the server by the `/api/solana-rpc` proxy.
- The anon key is meant to be public. Row Level Security on the Supabase tables is what protects the data.
- Add a `.gitignore` that excludes `.env.local`, `.env*.local`, `node_modules/` and `.next/`, and never commit environment files.
- The app never holds user keys. Every escrow transaction is built in the browser and signed by the user in Phantom.

See [docs/security.md](../../docs/security.md) for the full security model.
