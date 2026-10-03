'use client';

import * as React from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { createPortal } from 'react-dom';
import { getProgram } from "@/lib/anchorClient"
import * as anchor from "@coral-xyz/anchor"
import { getSellerPDA, getOrderPDA } from "@/lib/pda"
import { PublicKey } from "@solana/web3.js"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey as umiPk } from "@metaplex-foundation/umi";
import { fetchDigitalAsset, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { fetchAssetV1, mplCore } from "@metaplex-foundation/mpl-core";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token"

// Same platform fee wallet the on-chain buy_nft handler expects.
const NFT_FEE_WALLET = new PublicKey(
  "5f36iMWNehH9TcVuf19GFYcKsv9JrXDH1TVHvBGCmFvR"
);

// Verified against the mpl-core crate's own generated::programs::MPL_CORE_ID
// (not from memory — it was double-checked against the real published
// crate source before use).
const MPL_CORE_PROGRAM_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);

function getNftListingPDA(seller: PublicKey, mint: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nft_listing"), seller.toBuffer(), mint.toBuffer()],
    programId
  );
}

async function getAnchorWallet() {
  const provider = (window as any).solana;

  if (!provider?.isPhantom) throw new Error("Phantom not found")

  // Phantom's background service worker can go idle/disconnect (e.g. after the
  // tab sits in the background). When that happens the *next* signTransaction
  // call fails with a generic "User rejected the request" even though the
  // user never clicked reject — the request never reached the popup.
  // Re-establishing the connection here (silently, if already trusted) makes
  // sure we have a live port before we ever ask for a signature.
  try {
    await provider.connect({ onlyIfTrusted: true });
  } catch {
    // Not previously trusted / user hasn't connected yet — fall through and
    // let the normal connect/signing flow surface a real error if needed.
  }

  if (!provider.publicKey) {
    throw new Error("Wallet not connected. Please connect Phantom and try again.")
  }

  return {
    publicKey: provider.publicKey,
    signTransaction: provider.signTransaction,
    signAllTransactions: provider.signAllTransactions,
  };
}

// ---------- Global toast notifications (replaces window.alert everywhere) ----------
//
// Any component in this file can call `pushToast(...)` or `reportError(...)`
// without needing the toast state threaded through props — they write to a
// tiny module-level store, and the single <ToastContainer /> mounted once in
// <AppHome /> subscribes to it and renders the pop-down banners.

type ToastKind = "error" | "info";
type ToastItem = { id: number; message: string; kind: ToastKind };

let toastQueue: ToastItem[] = [];
let toastListeners: Array<(items: ToastItem[]) => void> = [];
let toastIdSeq = 0;

function emitToastQueue() {
  toastListeners.forEach((listener) => listener(toastQueue));
}

function pushToast(message: string, kind: ToastKind = "error") {
  const id = ++toastIdSeq;
  toastQueue = [...toastQueue, { id, message, kind }];
  emitToastQueue();

  window.setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id);
    emitToastQueue();
  }, 4500);
}

function dismissToast(id: number) {
  toastQueue = toastQueue.filter((t) => t.id !== id);
  emitToastQueue();
}

function useToastQueue(): ToastItem[] {
  const [items, setItems] = React.useState<ToastItem[]>(toastQueue);

  React.useEffect(() => {
    toastListeners.push(setItems);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setItems);
    };
  }, []);

  return items;
}

function ToastContainer() {
  const toasts = useToastQueue();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[999] flex flex-col items-center gap-2 px-4 pt-4 sm:pt-5"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl ${
              t.kind === "error"
                ? "border-red-500/20 bg-[#1a0e0e]/95 text-red-100"
                : "border-white/10 bg-[#0e0e0e]/95 text-white/90"
            }`}
            role="alert"
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === "error" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              )}
            </span>
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 text-white/40 transition-colors hover:text-white/80"
              aria-label="Dismiss"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}


const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function retryAsync<T>(fn: () => Promise<T>, tries = 6, delayMs = 600): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(delayMs);
    }
  }
  throw lastErr;
}

// Anchor BN / number / string -> number
function bnToNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v.toNumber === "function") {
    try {
      return v.toNumber();
    } catch {
      return Number(v.toString()) || 0;
    }
  }
  return Number(v) || 0;
}

// "InvalidState", "AlreadyFunded", ... (works for AnchorError objects and for
// the text we build in anchorClient for transactions that failed after landing)
function getContractErrorName(err: any): string | null {
  const fromObj = err?.error?.errorCode?.code;
  if (typeof fromObj === "string") return fromObj;

  const text = [
    err?.message,
    err?.transactionMessage,
    ...(Array.isArray(err?.logs) ? err.logs : []),
  ]
    .filter(Boolean)
    .join(" ");

  const m = text.match(/Error Code:\s*([A-Za-z0-9_]+)/);
  return m ? m[1] : null;
}

// The step has (probably) already happened on-chain: the previous attempt
// went through but the app never recorded it.
function isAlreadyDoneError(err: any): boolean {
  const code = getContractErrorName(err);
  return code === "InvalidState" || code === "AlreadyFunded";
}

// Only used when the on-chain `shippingHours` can't be read.
function fallbackShippingHours(order: any, fundedAt: number): number {
  if (order?.type === "digital") return Number(order?.ship_time_hours ?? 0) || 0;
  if (order?.ship_date) {
    const d = new Date(order.ship_date);
    d.setHours(23, 59, 59, 999);
    return Math.max(1, Math.ceil((d.getTime() - fundedAt * 1000) / 3_600_000));
  }
  return Number(order?.ship_time_hours ?? 0) || 0;
}

// Sorts any thrown error into:
//  - "simple": something the user caused/understands (e.g. they rejected the
//    wallet popup) — safe and useful to show verbatim.
//  - everything else ("advanced"): system / backend / blockchain errors —
//    these are never shown to the user in detail, only a generic message.
function classifyError(err: any): { message: string; isSimple: boolean } {
  const raw = ((err && err.message) || (typeof err === "string" ? err : "") || "").toLowerCase();

  if (raw.includes("user rejected") || raw.includes("rejected the request") || raw.includes("user denied")) {
    return { message: "You cancelled the request in your wallet.", isSimple: true };
  }

  if (raw.includes("disconnected port") || raw.includes("service worker")) {
    return { message: "Wallet connection dropped (this happens after it's been idle). Please try again.", isSimple: true };
  }

  if (raw.includes("phantom not found") || raw.includes("install phantom")) {
    return { message: "Phantom Wallet not found. Please install it to continue.", isSimple: true };
  }

  if (raw.includes("wallet not connected")) {
    return { message: "Please connect your wallet and try again.", isSimple: true };
  }

  if (raw.includes("sol price is unavailable")) {
    return {
      message: "SOL price is unavailable right now (an ad blocker may be blocking the price feed). Please disable it for this site and try again.",
      isSimple: true,
    };
  }

  if (raw.includes("enter a valid price")) {
    return { message: "Enter a valid price before creating the listing.", isSimple: true };
  }

  if (raw.includes("can't be listed for escrow yet")) {
    return {
      message: "This NFT type isn't supported yet (it looks like a compressed NFT). Classic SPL/Token-2022 NFTs and Metaplex Core assets are supported.",
      isSimple: true,
    };
  }

  if (raw.includes("collection info")) {
    return {
      message: "Couldn't read this NFT's collection info from the chain. Please try again in a moment.",
      isSimple: true,
    };
  }

  // ----- transaction / network problems -----
  if (
    raw.includes("blockhash not found") ||
    raw.includes("blockhash expired") ||
    raw.includes("before its blockhash expired")
  ) {
    return {
      message: "The transaction expired before it reached the network, so nothing was changed. Please try again.",
      isSimple: true,
    };
  }

  if (raw.includes("confirmation timed out")) {
    return {
      message: "The network is slow to confirm your transaction. Check your wallet's activity before trying again — it may still go through.",
      isSimple: true,
    };
  }

  if (
    raw.includes("insufficient lamports") ||
    raw.includes("insufficient funds") ||
    /custom program error: 0x1\b/.test(raw)
  ) {
    return {
      message: "Your wallet doesn't have enough SOL for this transaction (including network fees).",
      isSimple: true,
    };
  }

  // ----- smart-contract errors the user can actually act on -----
  switch (getContractErrorName(err)) {
    case "InvalidState":
      return {
        message: "This step isn't available right now — the escrow has already moved on or isn't ready yet. The status is being refreshed.",
        isSimple: true,
      };
    case "AlreadyFunded":
      return { message: "This escrow is already funded.", isSimple: true };
    case "InvalidBuyer":
    case "InvalidSeller":
    case "Unauthorized":
    case "InvalidListingSeller":
      return {
        message: "This wallet isn't allowed to do this. Make sure you're connected with the wallet linked to your account.",
        isSimple: true,
      };
    case "InsufficientEscrow":
      return { message: "The escrow doesn't hold enough funds for this action.", isSimple: true };
    case "ShippingNotExpired":
    case "ConfirmNotExpired":
    case "DisputeDeadlineNotReached":
    case "DiscussionNotReached":
      return { message: "The deadline for this step hasn't been reached yet. Please try again later.", isSimple: true };
    case "ListingNotActive":
      return { message: "This listing is no longer active.", isSimple: true };
  }

  // Anything unrecognized is treated as an advanced/system/backend/blockchain
  // error: full detail goes to the console only, the user gets a generic message.
  return { message: "Something went wrong. Please try again.", isSimple: false };
}

// Single entry point every catch(err) block should call instead of
// `alert(...)`. Simple, user-caused errors are shown as-is; everything else
// is logged to the console (for devs) and shown to the user as a generic
// "Something went wrong" toast.
function reportError(err: any, context: string) {
  const { message, isSimple } = classifyError(err);

  if (!isSimple) {
    console.error(`[${context}]`, err);
  }

  pushToast(message, "error");
}

// ---------- NFT metadata helpers (Metaplex Token Metadata, read-only) ----------

const clean = (s?: string) => (s || "").replace(/\u0000/g, "").trim();

async function fetchNftOnChainMetadata(
  connection: anchor.web3.Connection,
  mint: anchor.web3.PublicKey
) {
  const umi = createUmi(connection.rpcEndpoint)
    .use(mplTokenMetadata())
    .use(mplCore())
    .use(dasApi());

  const id = umiPk(mint.toBase58());

  let name = "";
  let uri = "";
  let fallbackImage = "";

  // 1) NFT ปกติ / pNFT / Token-2022 (Token Metadata program)
  try {
    const asset = await fetchDigitalAsset(umi, id);
    name = clean(asset.metadata.name);
    uri = clean(asset.metadata.uri);
  } catch { /* ไม่ใช่ประเภทนี้ ลองต่อ */ }

  // 2) Metaplex Core asset
  if (!uri) {
    try {
      const core = await fetchAssetV1(umi, id);
      name = clean(core.name);
      uri = clean(core.uri);
    } catch { /* ไม่ใช่ Core ลองต่อ */ }
  }

  // 3) DAS — รองรับ compressed NFT และที่เหลือทั้งหมด
  //    ต้องใช้ RPC ที่เปิด DAS (Helius / Triton / QuickNode DAS add-on)
  if (!uri) {
    try {
      const das: any = await (umi.rpc as any).getAsset(id);
      name = clean(das?.content?.metadata?.name) || name;
      uri = clean(das?.content?.json_uri);
      fallbackImage =
        das?.content?.links?.image ||
        das?.content?.files?.find((f: any) => f?.mime?.startsWith("image/"))?.uri ||
        "";
    } catch { /* ไม่เจอจริง ๆ */ }
  }

  if (!uri && !fallbackImage) {
    throw new Error("No metadata found for this mint address. Make sure it's an NFT.");
  }

  // โหลด off-chain JSON ผ่าน proxy เดิม (กัน CORS ของ Arweave/IPFS)
  let json: any = {};
  if (uri) {
    try {
      const res = await fetch(`/api/nft-image?url=${encodeURIComponent(uri)}`);
      if (res.ok) json = await res.json();
    } catch { /* ใช้ข้อมูล on-chain อย่างเดียว */ }
  }

  return {
    name: clean(json?.name) || name,
    description: clean(json?.description),
    image: clean(json?.image) || fallbackImage,
  };
}

// The on-chain program has two separate instruction sets:
//   - listNft / buyNft / cancelNftListing         → classic SPL Token / Token-2022 NFTs (mint + ATA)
//   - listCoreNft / buyCoreNft / cancelCoreNft     → Metaplex Core assets (no mint/ATA — a single
//                                                     account whose `owner` field is transferred via CPI)
// Compressed NFTs (cNFTs) aren't supported by either — they have no
// per-token account at all, just a leaf in a Merkle tree, and require a
// different (proof-based) integration this program doesn't have.
//
// This resolves which one a given address is, so callers can pick the
// right instruction and build the right accounts instead of assuming.
type NftKind =
  | { kind: "spl"; tokenProgram: anchor.web3.PublicKey }
  | { kind: "core"; collection: anchor.web3.PublicKey | null };

async function resolveNftKind(
  connection: anchor.web3.Connection,
  mint: anchor.web3.PublicKey
): Promise<NftKind> {
  const accountInfo = await connection.getAccountInfo(mint);

  if (!accountInfo) {
    throw new Error("No metadata found for this mint address. Make sure it's an NFT.");
  }

  const ownerStr = accountInfo.owner.toBase58();

  if (ownerStr === TOKEN_PROGRAM_ID.toBase58() || ownerStr === TOKEN_2022_PROGRAM_ID.toBase58()) {
    return { kind: "spl", tokenProgram: accountInfo.owner };
  }

  if (ownerStr === MPL_CORE_PROGRAM_ID.toBase58()) {
    // Figure out whether this asset belongs to a Collection — the
    // on-chain list_core_nft/buy_core_nft/cancel_core_nft instructions
    // need to pass that collection account into the mpl-core CPI (or
    // the mpl-core program id itself as a "no collection" sentinel if
    // there isn't one). Getting this wrong makes the CPI fail, so if we
    // can't determine it confidently, fail loudly here instead of
    // guessing "no collection" and hitting a confusing on-chain error.
    const umi = createUmi(connection.rpcEndpoint).use(mplCore());
    try {
      const asset = await fetchAssetV1(umi, umiPk(mint.toBase58()));
      const updateAuthority: any = asset.updateAuthority;
      const collection =
        updateAuthority?.type === "Collection" && updateAuthority.address
          ? new PublicKey(updateAuthority.address.toString())
          : null;
      return { kind: "core", collection };
    } catch (e) {
      throw new Error(
        "Couldn't read this Metaplex Core asset's collection info from the chain. Please try again in a moment."
      );
    }
  }

  throw new Error(
    "This NFT isn't a standard SPL/Token-2022 NFT or a Metaplex Core asset (it looks like a compressed NFT or another unsupported type), so it can't be listed for escrow yet."
  );
}

async function urlToFile(url: string, filename: string): Promise<File> {
  // Same CORS issue as the metadata fetch above — go through our proxy
  // instead of hitting the image host directly from the browser.
  const res = await fetch(`/api/nft-image?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error || "";
    } catch {
      // response wasn't JSON — ignore, we'll just show the generic message
    }
    throw new Error(
      `Couldn't load the NFT image${detail ? ` (${detail})` : ""}. The image host may be down or blocking requests — try again in a moment.`
    );
  }
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

function useSolPrice() {
  const [solPrice, setSolPrice] = React.useState<number | null>(null);

  React.useEffect(() => {
    let alive = true;

    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );

        if (!res.ok) throw new Error('SOL_PRICE_REQUEST_FAILED');

        const data = await res.json();
        const nextPrice = Number(data?.solana?.usd ?? 0);

        if (alive) setSolPrice(nextPrice > 0 ? nextPrice : null);
      } catch (err) {
        if (alive) setSolPrice(null);
      }
    }

    loadPrice();

    return () => {
      alive = false;
    };
  }, []);

  return solPrice;
}

function usdToSolText(numStr: string, solPrice: number | null) {
  const usd = Number(numStr || 0);

  if (!Number.isFinite(usd) || usd <= 0) return '0.00 SOL';
  if (!solPrice || solPrice <= 0) return '— SOL';

  return `${(usd / solPrice).toFixed(2)} SOL`;
}

// Converts a USD price string into a lamports anchor.BN, with real
// validation. anchor.BN (bn.js) throws an opaque "Assertion failed" if
// handed Infinity/NaN — which happens silently if solPrice is null
// (e.g. the CoinGecko price feed got blocked by an ad blocker) or if
// the user's price input is empty/invalid. Fail loudly and clearly
// here instead, before it ever reaches BN.
function usdToLamportsBN(usdStr: string, solPrice: number | null): anchor.BN {
  if (!solPrice || !Number.isFinite(solPrice) || solPrice <= 0) {
    throw new Error(
      "SOL price is unavailable right now (the price feed may be blocked by an ad blocker or extension). Please disable ad blockers for this site and try again."
    );
  }

  const usd = Number(usdStr);
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error("Enter a valid price before creating the listing.");
  }

  const lamports = Math.round((usd / solPrice) * 1e9);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error("Enter a valid price before creating the listing.");
  }

  return new anchor.BN(lamports);
}

function formatUsdShort(numStr: string) {
  const n = Number(numStr || 0);

  if (n >= 1_000_000_000)
    return `$${(n / 1_000_000_000).toFixed(1)}B`;

  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(1)}M`;

  if (n >= 1_000)
    return `$${(n / 1_000).toFixed(1)}K`;

  return `$${n.toFixed(1)}`;
}

function extractEscrowId(body:string){
  const parts = body.split(":")
  return parts[1]
}

const UI = {
  topBar:
    'h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-[clamp(1rem,3vw,1.5rem)] min-w-0',
  iconButton:
    'size-11 sm:size-10 rounded-full hover:bg-white/5 active:bg-white/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center text-white/80 transition-[background-color,transform,box-shadow] duration-200 shrink-0 touch-manipulation',
  panel:
    'rounded-[clamp(1rem,2vw,1.25rem)] bg-[#0e0e0e]/95 border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-300 hover:border-white/15 hover:shadow-[0_22px_70px_rgba(0,0,0,0.52)]',
  input:
    'h-[46px] rounded-[10px] bg-[#222222] text-white/90 outline-none border border-white/5 focus:border-[#2FE4E4]/50 focus:ring-2 focus:ring-[#2FE4E4]/20 transition-all duration-200 placeholder:text-white/30',
  primaryButton:
    'h-[46px] rounded-[10px] bg-[#26D9D9] text-black font-semibold hover:brightness-110 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_10px_30px_rgba(47,228,228,0.12)] touch-manipulation',
  mutedButton:
    'min-h-11 sm:min-h-10 rounded-xl bg-[#7b7b7b] text-black font-medium flex items-center justify-center gap-2 transition-[transform,filter] duration-200 active:scale-[0.985] touch-manipulation',
  whiteButton:
    'min-h-11 sm:min-h-10 rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-[transform,filter,box-shadow] duration-200 touch-manipulation',
  dangerButton:
    'h-[40px] rounded-xl bg-[#510000] text-[#FF0000] font-medium flex items-center justify-center gap-2 hover:bg-[#650000] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 transition-all duration-200 touch-manipulation',
} as const;

const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

const revealMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
} as const;

function Skeleton({
  className = '',
  shimmer = false,
}: {
  className?: string;
  shimmer?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative isolate overflow-hidden bg-white/[0.065] animate-pulse ${className}`}
    >
      {shimmer && (
        <motion.span
          className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent will-change-transform"
          initial={{ x: '-110%' }}
          animate={{ x: '260%' }}
          transition={{ duration: 1.25, repeat: Infinity, repeatDelay: 0.12, ease: 'linear' }}
        />
      )}
    </div>
  );
}

function InlineSkeleton({ className = 'h-5 w-20' }: { className?: string }) {
  return <Skeleton className={`inline-block align-middle rounded-md ${className}`} shimmer />;
}

function ButtonLoadingLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span
        aria-hidden="true"
        className="size-4 rounded-full border-2 border-current/25 border-t-current animate-spin"
      />
      <span>{label}</span>
    </span>
  );
}

function Spinner({
  size = 20,
  thickness = 2,
  className = '',
}: {
  size?: number;
  thickness?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderWidth: thickness }}
      className={`inline-block shrink-0 rounded-full border-current/25 border-t-current animate-spin ${className}`}
    />
  );
}

type AsyncButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => unknown;
  spinnerSize?: number;
};

// A button whose click handler may be async. While the handler's promise is
// pending (wallet popup, transaction being confirmed, file uploading ...) the
// label is replaced by a spinning ring, the button can't be clicked again and
// it keeps its exact size. Handlers that return nothing (plain navigation)
// behave like a normal button.
function AsyncButton({
  onClick,
  disabled,
  className = '',
  children,
  spinnerSize = 22,
  type = 'button',
  ...rest
}: AsyncButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const busyRef = React.useRef(false);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (busyRef.current || !onClick) return;

    const result: any = onClick(e);
    if (!result || typeof result.then !== 'function') return;

    busyRef.current = true;
    setBusy(true);
    try {
      await result;
    } catch (err) {
      console.error(err);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  };

  return (
    <button
      {...rest}
      type={type}
      onClick={handleClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`relative ${className} ${busy ? 'cursor-wait' : ''}`}
    >
      {/* `contents` keeps the children in the button's own flex layout;
          `invisible` hides them without changing the button's size */}
      <span className={busy ? 'contents invisible' : 'contents'}>{children}</span>
      {busy && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={spinnerSize} />
        </span>
      )}
    </button>
  );
}

function AvatarSkeleton() {
  return <Skeleton className="size-12 rounded-full shrink-0" shimmer />;
}

function EscrowCardSkeleton() {
  return (
    <div className={`w-full min-w-[300px] max-w-[min(100%,22.5rem)] ${UI.panel} p-4`} aria-label="Loading order">
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-6 w-20 rounded-full" shimmer />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="size-16 md:size-20 rounded-xl shrink-0" shimmer />
        <div className="min-w-0 flex-1 space-y-2 pt-1">
          <Skeleton className="h-5 w-3/5 rounded-md" />
          <Skeleton className="h-7 w-2/5 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
        </div>
      </div>
      <Skeleton className="mt-4 h-10 w-full rounded-xl" shimmer />
    </div>
  );
}

function EscrowOrderListSkeleton() {
  return (
    <div className="w-full space-y-5" aria-label="Loading escrow orders">
      {[0, 1].map((item) => (
        <div key={item} className="w-full flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
          <div className="hidden md:flex w-[200px] flex-col items-center gap-3">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-7 w-28 rounded-full" shimmer />
            <Skeleton className="h-4 w-20 rounded-md mt-2" />
          </div>
          <EscrowCardSkeleton />
          <div className="hidden md:flex items-start gap-6">
            <AvatarSkeleton />
            <AvatarSkeleton />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactListSkeleton() {
  return (
    <div className="divide-y divide-white/10" aria-label="Loading contacts">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-[91px] w-full flex items-center gap-4 px-4 py-4">
          <AvatarSkeleton />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-[42%] rounded-md" shimmer={item === 0} />
            <Skeleton className="h-4 w-[72%] rounded-md" />
          </div>
          <Skeleton className="h-4 w-10 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-5 pt-2" aria-label="Loading messages">
      {[false, true, false, true].map((mine, item) => (
        <div key={item} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className={`space-y-2 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
            <Skeleton
              className={`h-[52px] rounded-2xl ${item % 2 ? 'w-[min(68vw,260px)]' : 'w-[min(58vw,220px)]'}`}
              shimmer={item === 0}
            />
            <Skeleton className="h-3 w-12 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ImageSkeleton({ className = '' }: { className?: string }) {
  return <Skeleton className={`min-h-28 min-w-28 rounded-2xl ${className}`} shimmer />;
}


function EscrowSuccess({
  tx,
  onClose,
}: {
  tx: string
  onClose: () => void
}) {
  return (
    <div className="h-full flex flex-col bg-black">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">
          Create Escrow order
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Order created
          </div>
          <div className="text-white/45 text-[14px]">
            Your escrow order is now live on-chain
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function BuyerFundedScreen({
  tx,
  onClose,
}: {
  tx: string
  onClose: () => void
}) {
  return (
    <div className="h-full flex flex-col bg-black">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">
          Buyer Fund Escrow
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Escrow funded
          </div>
          <div className="text-white/45 text-[14px]">
            Funds are locked on-chain until delivery is confirmed
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function PaidSellerScreen({
  tx,
  onClose,
}: {
  tx: string
  onClose: () => void
}) {
  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">
          Pay Seller During Discuss
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Paid seller
          </div>
          <div className="text-white/45 text-[14px]">
            The seller has been paid directly from discussion
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Close
        </button>
      </div>
    </div>
  )
}

function OpenedDispute({
  tx,
  onClose,
}: {
  tx: string
  onClose: () => void
}) {
  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">
          Review
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        {/* Amber, not green — a dispute being opened is neutral/attention-
            needed, not a celebratory outcome, even though the on-chain
            action itself succeeded. */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#F5A524]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#FFC85C] to-[#F0A020] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(245,165,36,0.4)]">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8v5" stroke="#1A1000" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="16.2" r="1.15" fill="#1A1000" />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Dispute opened
          </div>
          <div className="text-white/45 text-[14px]">
            Both parties have been notified. Review will follow
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Close
        </button>
      </div>
    </div>
  )
}

function ConfirmSuccess({
  tx,
  onClose,
}: {
  tx: string
  onClose: () => void
}) {
  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">
          Review
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Confirmed
          </div>
          <div className="text-white/45 text-[14px]">
            Your confirmation has been recorded on-chain
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function getProfileUrl(supabase:any, uid:string){

  const { data } = supabase
    .storage
    .from("profiles")
    .getPublicUrl(`${uid}.jpg`)

  return data.publicUrl
}

function statusColor(status:string){

  if(status === "BuyerFunded")
    return "bg-[#033617] text-[#1FC431]"

  if(status === "onchain_created")
    return "bg-[#3b3b00] text-yellow-400"

  if(status === "Shipping")
    return "bg-[#113f3f] text-[#26D9D9]"

  if(status === "Cancelled")
    return "bg-[#510000] text-[#FF0000]"

  if(status === "Completed")
    return "bg-[#033617] text-[#1FC431]"

  return "bg-[#262626] text-white"
}

function EscrowOrders({
  onClose,
  conversationId,
  supabase,
  loadEscrow,
  viewerId,
  onBuy,
  onSellerFund,
  onMarkShipped,
  onReview,
  onRefund,
  onCancel,
  onRespond,
  onDisputeRefund,
  onRefundDiscuss,
  onPaySeller,
  onSendDigitalFile,
  onProfileClick,
}:any){
  const [PaySellerOrder, setPaySellerOrder] = React.useState<any | null>(null)

  const [uploadOrder, setUploadOrder] = React.useState<any | null>(null)

  const [refundDiscussOrder, setRefundDiscussOrder] = React.useState<any | null>(null)

  const [refundDisputeOrder, setRefundDisputeOrder] = React.useState<any | null>(null)

  const [orders,setOrders] = React.useState<any[]>([])
  const [loading,setLoading] = React.useState(true)

  const [downloadOrder, setDownloadOrder] = React.useState<any | null>(null)

  React.useEffect(()=>{

    async function load(){

      const {data,error} = await supabase
        .from("escrow_orders")
        .select(`
          escrow_pda,
          seller_id,
          buyer_id,
          seller_name,
          buyer_name,
          status,
          created_at
        `)
        .eq("conversation_id",conversationId)
        .order("created_at",{ascending:false})

      if(error){
        console.error(error)
        return
      }

      setOrders(data ?? [])
      setLoading(false)
    }

    load()

  },[conversationId])

  const [refundOrder, setRefundOrder] = React.useState<any>(null)

  const [cancelOrder, setCancelOrder] = React.useState<any>(null)

  if (refundOrder) {
    return (
      <BuyerRefundScreen
        order={refundOrder}
        supabase={supabase}
        onClose={() => setRefundOrder(null)}
        onRefund={() => onRefund(refundOrder)}
      />
    )
  }

  if (cancelOrder) {
    return (
      <SellerCancelScreen
        order={cancelOrder}
        supabase={supabase}
        onClose={()=>setCancelOrder(null)}
        onRefund={() => onCancel(cancelOrder)}
      />
    )
  }

  if (refundDisputeOrder) {
    return (
      <RefundScreen
        order={refundDisputeOrder}
        supabase={supabase}
        onClose={() => setRefundDisputeOrder(null)}
        onNext={() => {
          onDisputeRefund(refundDisputeOrder)
          setRefundDisputeOrder(null)
        }}
      />
    )
  }

  if (refundDiscussOrder) {
    return (
      <RefundBuyerDiscussScreen
        order={refundDiscussOrder}
        supabase={supabase}
        onClose={() => setRefundDiscussOrder(null)}
        onNext={() => onRefundDiscuss(refundDiscussOrder)}
      />
    )
  }

  if (PaySellerOrder) {
    return (
      <PaySellerDiscussScreen
        order={PaySellerOrder}
        supabase={supabase}
        onClose={() => setPaySellerOrder(null)}
        onNext={() => onPaySeller(PaySellerOrder)}
      />
    )
  }

  if (uploadOrder) {
    return (
      <UploadFileScreen
        order={uploadOrder}
        supabase={supabase}
        onClose={()=>setUploadOrder(null)}
        onSendFile={async (order, file) => {
          await onSendDigitalFile(order, file);
          setUploadOrder(null);
        }}
      />
    )
  }

  if (downloadOrder) {
    return (
      <DownloadScreen
        order={downloadOrder}
        supabase={supabase}
        onClose={() => setDownloadOrder(null)}
      />
    )
  }

  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[80px] md:h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">

        <div className="text-white md:text-[18px] text-[16px] font-medium">
          All Escrow Order
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X"/>
        </button>

      </div>

      {/* list */}

      <div className="mt-4 flex-1 overflow-y-auto px-4 md:px-6 pb-6 space-y-4 flex flex-col items-center scrollbar-hide overscroll-contain">

        {loading && <EscrowOrderListSkeleton />}

        {!loading && orders.map((o:any)=>(
          <div key={o.escrow_pda} className="w-full">
            {/* ================= MOBILE ONLY ================= */}
            <div className="md:hidden flex flex-col items-center gap-4">
              {/* top objects above card */}
              <div className="w-full max-w-[320px] flex items-start justify-between">
                {/* status */}
                <div className="w-[110px] flex flex-col items-center text-center">
                  <div className="text-white text-[15px] font-medium">
                    Status
                  </div>

                  <div
                    className={`mt-2 px-4 py-1 rounded-full text-[13px] font-medium w-full max-w-[110px] ${statusColor(o.status)}`}
                  >
                    {o.status}
                  </div>

                  <div className="text-white text-[15px] font-medium mt-3">
                    Created at
                  </div>

                  <div className="text-white/40 text-[13px] mt-1">
                    {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* seller / buyer */}
                <div className="flex flex-row gap-5">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onProfileClick?.(o.seller_id)}
                      className="group h-12 w-12 rounded-full bg-[#0a2626] flex items-center justify-center overflow-hidden transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
                      aria-label={`Open ${o.seller_name || 'seller'} profile`}
                    >
                      <img
                        src={getProfileUrl(supabase, o.seller_id)}
                        alt="Seller avatar"
                        className="h-12 w-12 rounded-full object-cover transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#2FE4E4]"
                        onError={(e) => { e.currentTarget.src = "/cat.png"; }}
                      />
                    </button>
                    <div className="text-white text-sm font-medium">Seller</div>
                    <div className="px-4 py-1 rounded-full bg-[#3d0a0a] text-[#ff4d4d] text-xs font-medium">
                      {o.seller_name}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onProfileClick?.(o.buyer_id)}
                      className="group h-12 w-12 rounded-full bg-[#0a2626] flex items-center justify-center overflow-hidden transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
                      aria-label={`Open ${o.buyer_name || 'buyer'} profile`}
                    >
                      <img
                        src={getProfileUrl(supabase, o.buyer_id)}
                        alt="Buyer avatar"
                        className="h-12 w-12 rounded-full object-cover transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#2FE4E4]"
                        onError={(e) => { e.currentTarget.src = "/cat.png"; }}
                      />
                    </button>
                    <div className="text-white text-sm font-medium">Buyer</div>
                    <div className="bg-[#033617] text-[#1FC431] px-4 py-1 rounded-full text-xs font-medium">
                      {o.buyer_name}
                    </div>
                  </div>
                </div>
              </div>

              {/* card stays below */}
              <EscrowCard
                orderId={o.escrow_pda}
                loadEscrow={loadEscrow}
                supabase={supabase}
                viewerId={viewerId}
                onBuy={onBuy}
                onFundEscrow={onSellerFund}
                onMarkShipped={onMarkShipped}
                onReview={onReview}
                onRefund={(order)=>setRefundOrder(order)}
                onCancel={(order)=>setCancelOrder(order)}
                onRespond={onRespond}
                onDisputeRefund={(order)=>setRefundDisputeOrder(order)}
                onRefundDiscuss={(order)=>setRefundDiscussOrder(order)}
                onPaySeller={(order)=>setPaySellerOrder(order)}
                onUploadFile={(order)=>setUploadOrder(order)}
                onDownload={(order)=>setDownloadOrder(order)}
              />
            </div>

            {/* ================= DESKTOP ONLY ================= */}
            <div className="flex flex-1 justify-center items-center hidden md:flex gap-6 items-start">
              {/* status column */}
              <div className="mt-8 w-[150px] flex flex-col items-center text-center">
                <div className="text-white text-[17px] font-medium">
                  Status
                </div>

                <div className={`mt-2 px-5 py-1 rounded-full text-[15px] font-medium w-full max-w-[140px] ${statusColor(o.status)}`}>
                  {o.status}
                </div>

                <div className="text-white text-[17px] font-medium mt-4">
                  Created at
                </div>

                <div className="text-white/40 text-[15px] mt-1">
                  {new Date(o.created_at).toLocaleDateString()}
                </div>
              </div>

              {/* card */}
              <EscrowCard
                orderId={o.escrow_pda}
                loadEscrow={loadEscrow}
                supabase={supabase}
                viewerId={viewerId}
                onBuy={onBuy}
                onFundEscrow={onSellerFund}
                onMarkShipped={onMarkShipped}
                onReview={onReview}
                onRefund={(order)=>setRefundOrder(order)}
                onCancel={(order)=>setCancelOrder(order)}
                onRespond={onRespond}
                onDisputeRefund={(order)=>setRefundDisputeOrder(order)}
                onRefundDiscuss={(order)=>setRefundDiscussOrder(order)}
                onPaySeller={(order)=>setPaySellerOrder(order)}
                onUploadFile={(order)=>setUploadOrder(order)}
                onDownload={(order)=>setDownloadOrder(order)}
              />

              {/* seller buyer column */}
              <div className="mt-10 flex flex-row gap-8">
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onProfileClick?.(o.seller_id)}
                    className="group h-12 w-12 rounded-full bg-[#0a2626] flex items-center justify-center overflow-hidden transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
                    aria-label={`Open ${o.seller_name || 'seller'} profile`}
                  >
                    <img
                      src={getProfileUrl(supabase, o.seller_id)}
                      alt="Seller avatar"
                      className="h-12 w-12 rounded-full object-cover transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#2FE4E4]"
                      onError={(e) => { e.currentTarget.src = "/cat.png"; }}
                    />
                  </button>
                  <div className="text-white text-sm font-medium">Seller</div>
                  <div className="px-4 py-1 rounded-full bg-[#3d0a0a] text-[#ff4d4d] text-xs font-medium">
                    {o.seller_name}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onProfileClick?.(o.buyer_id)}
                    className="group h-12 w-12 rounded-full bg-[#0a2626] flex items-center justify-center overflow-hidden transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
                    aria-label={`Open ${o.buyer_name || 'buyer'} profile`}
                  >
                    <img
                      src={getProfileUrl(supabase, o.buyer_id)}
                      alt="Buyer avatar"
                      className="h-12 w-12 rounded-full object-cover transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#2FE4E4]"
                      onError={(e) => { e.currentTarget.src = "/cat.png"; }}
                    />
                  </button>
                  <div className="text-white text-sm font-medium">Buyer</div>
                  <div className="bg-[#033617] text-[#1FC431] px-4 py-1 rounded-full text-xs font-medium">
                    {o.buyer_name}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

      </div>

    </div>
  )
}

function EscrowItemInfo({
  type,
  mode,
  draft,
  setDraft,
  onNext,
  onBack,
  onClose,
}: {
  mode: any;
  type: 'physical' | 'digital';
  draft: any;
  setDraft: React.Dispatch<React.SetStateAction<any>>;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  // track preview URL we created so we can revoke the old one when replacing
  const lastPreviewRef = React.useRef<string | null>(null);

  function onPickFile(f?: File) {
    if (!f) return;

    // revoke previous preview we created (if any)
    if (lastPreviewRef.current) {
      try { URL.revokeObjectURL(lastPreviewRef.current); } catch {}
      lastPreviewRef.current = null;
    }

    const url = URL.createObjectURL(f);
    lastPreviewRef.current = url;

    setDraft((d:any) => ({
      ...d,
      imageFile: f,
      imagePreview: url,
    }));
  }

  const canNext =
    draft.imagePreview &&
    draft.description?.trim() &&
    draft.price &&
    (type === 'physical'
      ? !!draft.shipDate
      : draft.shipTime > 0);

  const today = new Date();
  const minDate = today.toISOString().split("T")[0];

  const max = new Date();
  max.setMonth(max.getMonth() + 1);
  const maxDate = max.toISOString().split("T")[0];

  const dateRef = React.useRef<HTMLInputElement | null>(null);

  const [showInfo, setShowInfo] = React.useState(false);
  const infoRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) {
        setShowInfo(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (type === "digital") {
      setDraft((d:any) => ({
        ...d,
        disputeMode: "BTR",
      }))
    }
  }, [type])

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
      {/* body */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-[720px]">
          {/* title */}
          <div className="text-center text-white text-[24px] md:text-[27px] font-semibold tracking-[-0.02em] mb-1 md:mb-8">
            Insert item info
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-8 md:gap-10 items-start">
            {/* left: picture */}
            <div className="mt-5 flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] hover:bg-[#303030] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 transition-all duration-200 overflow-hidden border border-white/5 hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                title="Upload"
              >
                {draft.imagePreview ? (
                  <img
                    src={draft.imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center">
                    <Image
                      src="/image-square-svgrepo-com.svg"
                      width={50}
                      height={50}
                      alt="Item’s Picture"
                    />
                  </div>
                )}
              </button>

              {/* hidden input */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />

              <div className="mt-3 text-[#A6A6A6] text-[14px]">Item’s Picture</div>
            </div>

            {/* right: inputs */}
            <div>
              <label className="block text-white text-[14px] font-medium mb-2">
                Item’s Description
              </label>

              <div className="relative">
                <Image
                  src="/document-ui-description-svgrepo-com.svg"
                  width={17}
                  height={17}
                  alt="document"
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                />

                <input
                  value={draft.description}
                  maxLength={50} // Stops the user from typing more
                  onChange={(e) => {
                    const value = e.target.value;

                    if (value.length <= 50) {
                      setDraft((d: any) => ({ ...d, description: value }));
                    }
                  }}
                  placeholder="Describe your Item..."
                  className="w-full h-[46px] rounded-[10px] bg-[#222222] border border-white/5
                            text-white/90 outline-none placeholder:text-white/30 transition-all duration-200
                            pl-11 pr-4
                            focus:ring-2 focus:ring-[#2FE4E4]/40"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-6">
                <div>
                  {type === "physical" ? (
                    // ================= PHYSICAL =================
                    <div>
                      <div className="flex items-center gap-2 mb-2 relative">
                        <label className="text-white text-[14px] font-medium">
                          Shipping date
                        </label>

                        <div
                          ref={infoRef}
                          className="relative"
                          onMouseEnter={() => setShowInfo(true)}
                          onMouseLeave={() => setShowInfo(false)}
                        >
                          <Image
                            src="/question-circle-svgrepo-com.svg"
                            width={18}
                            height={18}
                            alt="info"
                            onClick={() => setShowInfo((prev) => !prev)}
                            className="cursor-pointer opacity-70 hover:opacity-100"
                          />

                          {showInfo && (
                            <div
                              className="absolute z-50
                                        left-1/2 -translate-x-1/2
                                        top-7
                                        w-[260px] p-3
                                        rounded-[8px]
                                        bg-[#1A1A1A]
                                        text-white text-[12px]
                                        shadow-xl
                                        border border-white/10"
                            >
                              You must ship the item before this date. Otherwise, the buyer will be refunded and you will lose your bond.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="relative">
                        <Image
                          src="/calender-svgrepo-com.svg"
                          width={18}
                          height={18}
                          alt="calendar"
                          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                        />

                        <input
                          ref={dateRef}
                          type="date"
                          min={minDate}
                          max={maxDate}
                          value={draft.shipDate}
                          onChange={(e)=>
                            setDraft((d:any)=>({...d, shipDate:e.target.value}))
                          }
                          onKeyDown={(e) => e.preventDefault()}
                          onPaste={(e) => e.preventDefault()}
                          onClick={() => dateRef.current?.showPicker?.()}
                          className="w-full h-[46px] rounded-[10px] bg-[#222222] border border-white/5
                                    text-white/90 outline-none transition-all duration-200
                                    pl-11 pr-4
                                    focus:ring-2 focus:ring-[#2FE4E4]/40
                                    appearance-none"
                        />
                      </div>
                    </div>
                  ) : (
                    // ================= DIGITAL =================
                    <div>
                      <div className="flex items-center gap-2 mb-2 relative">
                        <label className="text-white text-[14px] font-medium">
                          Shipping time (hours)
                        </label>

                        <div
                          ref={infoRef}
                          className="relative"
                          onMouseEnter={() => setShowInfo(true)}
                          onMouseLeave={() => setShowInfo(false)}
                        >
                          <Image
                            src="/question-circle-svgrepo-com.svg"
                            width={18}
                            height={18}
                            alt="info"
                            onClick={() => setShowInfo((prev) => !prev)}
                            className="cursor-pointer opacity-70 hover:opacity-100"
                          />

                          {showInfo && (
                            <div
                              className="absolute z-50
                                        left-1/2 -translate-x-1/2
                                        top-7
                                        w-[260px] p-3
                                        rounded-[8px]
                                        bg-[#1A1A1A]
                                        text-white text-[12px]
                                        shadow-xl
                                        border border-white/10"
                            >
                              You must deliver the item within this many hours.
                              If not, the buyer will be refunded automatically and you will lose your bond
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="relative flex items-center">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d: any) => {
                              const current = Number(d.shipTime || 1);
                              const next = Math.max(1, current - 1);
                              return { ...d, shipTime: String(next) };
                            })
                          }
                          className="absolute left-2 text-white text-lg px-2"
                        >
                          −
                        </button>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={draft.shipTime}
                          onChange={(e)=>{
                            let v = e.target.value.replace(/\D/g,"");
                            if(!v){ setDraft((d:any)=>({...d, shipTime:''})); return;}
                            let n = Math.max(1, Math.min(48, Number(v)));
                            setDraft((d:any)=>({...d, shipTime:String(n)}));
                          }}
                          onKeyDown={(e) => {
                            if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
                              e.preventDefault();
                            }
                          }}
                          className="w-full h-[46px] rounded-[10px] bg-[#222222] border border-white/5
                                    text-white/90 outline-none transition-all duration-200
                                    text-center
                                    pl-10 pr-10
                                    focus:ring-2 focus:ring-[#2FE4E4]/40"
                          placeholder="1-48"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d: any) => {
                              const current = Number(d.shipTime || 0);
                              const next = Math.min(48, current + 1);
                              return { ...d, shipTime: String(next) };
                            })
                          }
                          className="absolute right-2 text-white text-lg px-2"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-white text-[14px] font-medium mb-2">
                    Item’s Price
                  </label>

                  <div className="relative">
                    {/* dollar icon */}
                    <Image
                      src="/dollar-svgrepo-com.svg"
                      width={24}
                      height={24}
                      alt="dollar"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />

                    <input
                      type="text"
                      inputMode="numeric"
                      value={draft.price}
                      onChange={(e)=>{
                        const onlyNumbers = e.target.value.replace(/\D/g,"");
                        setDraft((d:any)=>({...d, price:onlyNumbers}))
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key.length === 1 &&
                          !/[0-9]/.test(e.key)
                        ) {
                          e.preventDefault();
                        }
                      }}
                      className="w-full h-[46px] rounded-[10px] bg-[#222222] border border-white/5
                                text-white/90 outline-none transition-all duration-200
                                pl-11 pr-4
                                focus:ring-2 focus:ring-[#2FE4E4]/40"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* next button */}
          <button
            disabled={!canNext}
            onClick={onNext}
            className={`mt-8 w-full h-[46px] rounded-[10px] font-semibold
            ${canNext ? "bg-[#2FE4E4] text-black" : "bg-[#136262] text-black cursor-not-allowed"}`}
          >
            Next
          </button>

          {type === "physical" && (
            <div className="mt-3 text-center text-white/30 text-[12px]">Type: {type}, Mode: {mode}</div>
          )}

          {type === "digital" && (
            <div className="mt-3 text-center text-white/30 text-[12px]">Type: {type}</div>
          )}

        </div>
      </div>
    </div>
  );
}

function EscrowNftInfo({
  draft,
  setDraft,
  onNext,
  onBack,
  onClose,
}: {
  draft: any;
  setDraft: React.Dispatch<React.SetStateAction<any>>;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [mintInput, setMintInput] = React.useState(draft.nftMint || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fetched, setFetched] = React.useState(!!draft.imagePreview && !!draft.nftMint);

  React.useEffect(() => {
    setDraft((d: any) => ({ ...d, disputeMode: 'BTR' }));
  }, []);

  async function handleFetchNft() {
    const trimmed = mintInput.trim();
    if (!trimmed) return;

    setError('');
    setLoading(true);
    setFetched(false);

    try {
      const mint = new PublicKey(trimmed);
      const wallet = await getAnchorWallet();
      const program = getProgram(wallet);
      const connection = program.provider.connection;

      // Fail fast with a clear message if this mint isn't a type the
      // on-chain listNft instruction can actually handle, rather than
      // letting the user get all the way to signing a tx that reverts
      // with a cryptic AccountOwnedByWrongProgram error.
      await resolveNftKind(connection, mint);

      const meta = await fetchNftOnChainMetadata(connection, mint);

      if (!meta.image) {
        throw new Error("This NFT doesn't have an image in its metadata.");
      }

      const file = await urlToFile(meta.image, `${trimmed}.png`);
      const preview = URL.createObjectURL(file);

      setDraft((d: any) => ({
        ...d,
        nftMint: trimmed,
        imageFile: file,
        imagePreview: preview,
        description: (meta.description || meta.name || '').slice(0, 200),
        orderName: (meta.name || '').slice(0, 20),
        shipTime: d.shipTime || '1',
        disputeMode: 'BTR',
      }));

      setFetched(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Couldn't load that NFT. Check the mint address and try again.");
    } finally {
      setLoading(false);
    }
  }

  const canNext = fetched && !!draft.imagePreview && !!draft.price;

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* body */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-[720px]">
          <div className="text-center text-white text-[24px] md:text-[27px] font-semibold tracking-[-0.02em] mb-1 md:mb-8">
            Insert NFT info
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-8 md:gap-10 items-start">
            {/* left: NFT preview */}
            <div className="mt-5 flex flex-col items-center">
              <div className="relative size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] overflow-hidden border border-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] grid place-items-center">
                {draft.imagePreview ? (
                  <img
                    src={draft.imagePreview}
                    alt="NFT preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Image
                    src="/image-square-svgrepo-com.svg"
                    width={50}
                    height={50}
                    alt="NFT's Picture"
                  />
                )}
              </div>

              <div className="mt-3 text-[#A6A6A6] text-[14px]">NFT's Picture</div>
            </div>

            {/* right: inputs */}
            <div>
              <label className="block text-white text-[14px] font-medium mb-2">
                Mint Address
              </label>

              <div className="flex gap-3">
                <input
                  value={mintInput}
                  onChange={(e) => setMintInput(e.target.value.trim())}
                  placeholder="Paste the NFT mint address..."
                  className="flex-1 h-[46px] rounded-[10px] bg-[#222222] border border-white/5
                            text-white/90 outline-none placeholder:text-white/30 transition-all duration-200
                            px-4
                            focus:ring-2 focus:ring-[#2FE4E4]/40"
                />

                <button
                  type="button"
                  disabled={!mintInput.trim() || loading}
                  onClick={handleFetchNft}
                  className={`h-[46px] px-5 rounded-[10px] font-semibold shrink-0
                    ${!mintInput.trim() || loading
                      ? "bg-[#136262] text-black cursor-not-allowed"
                      : "bg-[#2FE4E4] text-black hover:brightness-110"}`}
                >
                  {loading ? "Loading..." : "Load NFT"}
                </button>
              </div>

              {error && (
                <div className="mt-2 text-[#FF6B6B] text-[13px]">{error}</div>
              )}

              {fetched && (
                <div className="mt-3">
                  <div className="text-white text-[15px] font-medium">
                    {draft.orderName || "Untitled NFT"}
                  </div>
                  {draft.description && (
                    <div className="mt-1 text-white/50 text-[13px] line-clamp-2">
                      {draft.description}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5">
                <label className="block text-white text-[14px] font-medium mb-2">
                  Item's Price
                </label>

                <div className="relative">
                  <Image
                    src="/dollar-svgrepo-com.svg"
                    width={24}
                    height={24}
                    alt="dollar"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />

                  <input
                    type="text"
                    inputMode="numeric"
                    value={draft.price}
                    onChange={(e) => {
                      const onlyNumbers = e.target.value.replace(/\D/g, "");
                      setDraft((d: any) => ({ ...d, price: onlyNumbers }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    className="w-full h-[46px] rounded-[10px] bg-[#222222] border border-white/5
                              text-white/90 outline-none transition-all duration-200
                              pl-11 pr-4
                              focus:ring-2 focus:ring-[#2FE4E4]/40"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* next button */}
          <button
            disabled={!canNext}
            onClick={onNext}
            className={`mt-8 w-full h-[46px] rounded-[10px] font-semibold
            ${canNext ? "bg-[#2FE4E4] text-black" : "bg-[#136262] text-black cursor-not-allowed"}`}
          >
            Next
          </button>

          <div className="mt-3 text-center text-white/30 text-[12px]">Type: digital (NFT)</div>
        </div>
      </div>
    </div>
  );
}

function EscrowNameOrder({
  draft,
  setDraft,
  onBack,
  onClose,
  onNext,
}: any) {
  const canNext = draft.orderName?.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-black">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">
        <div className="relative">
          <img
            src={draft.imagePreview || "/image-square-svgrepo-com.svg"}
            alt="Order item preview"
            className={`w-[clamp(6.5rem,20vw,9.375rem)] h-[clamp(6.5rem,20vw,9.375rem)] rounded-2xl object-cover border border-white/[0.08] shadow-[0_16px_40px_-16px_rgba(0,0,0,0.6)]`}
          />
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">Name this order</div>
          <div className="text-white/45 text-[14px]">This is how it'll appear to the buyer</div>
        </div>

        <input
          value={draft.orderName}
          placeholder="e.g. Vintage camera lens"
          maxLength={20} // This prevents further typing at 20 chars
          onChange={(e) => {
            const val = e.target.value;
            // Safety check: only update state if length is <= 20
            if (val.length <= 20) {
              setDraft((d: any) => ({ ...d, orderName: val }));
            }
          }}
          className={`w-full max-w-[420px] px-4 ${UI.input}`}
        />

        <button
          disabled={!canNext}
          onClick={onNext}
          className={`w-full max-w-[420px] ${UI.primaryButton}`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function EscrowPreview({
  draft,
  type,
  mode,
  time,
  date,
  onBack,
  onClose,
  onCreate,
}: any) {
  const isPhysical = type === 'physical';
  const isDigital = type === 'digital';
  const isNft = !!draft?.nftMint;
  const solPrice = useSolPrice();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCreate = async () => {
    if (isSubmitting) return; // guard against double-clicks firing two txs at once
    setIsSubmitting(true);
    try {
      await onCreate();
    } finally {
      // Always re-enable, whether onCreate succeeded, failed, or the
      // wallet signature was rejected — otherwise a failed/cancelled
      // attempt would leave the button stuck and unclickable.
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8 px-6 mb-20 md:mb-0">
        <div className="text-white text-[clamp(1.45rem,4vw,1.875rem)] font-semibold tracking-[-0.02em]">Preview</div>
        {/* CARD */}
        <div className={`w-full max-w-xl ${UI.panel} p-4 sm:p-5 md:p-6`}>

          {/* TAG ROW */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Image src={isNft ? "/image-square-svgrepo-com.svg" : "/cpu-svgrepo-com.svg"} width={20} height={20} alt={isNft ? "NFT" : "Digital"} />

            <div className="px-2 sm:px-3 py-1 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {isNft ? 'NFT' : type === 'digital' ? 'Digital product' : 'Physical product'}
            </div>

            {isPhysical && mode &&(
              <div className="px-2 sm:px-3 py-1 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {mode === 'BTR' ? 'BTR' : 'STR'}
              </div>
            )}

            {isPhysical && date &&(
              <div className="px-2 sm:px-3 py-1 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {date}
              </div>
            )}

            {isDigital && !isNft && time && (
              <div className="px-2 sm:px-3 py-1 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {time} hours
              </div>
            )}
          </div>

          {/* CONTENT */}
          <div className="flex gap-3 sm:gap-4">

            <img
              src={draft.imagePreview}
              alt="Order item preview"
              className="w-20 h-20 sm:w-24 sm:h-24 md:w-[110px] md:h-[110px] rounded-xl object-cover"
            />

            <div className="flex flex-col justify-center min-w-0">

              {/* Order Name */}
              <div className="text-[#26D9D9] text-lg sm:text-xl md:text-2xl font-bold truncate">
                {draft.orderName}
              </div>

              {/* USD + SOL */}
              <div className="text-white text-xl sm:text-2xl md:text-3xl font-medium">
                {formatUsdShort(draft.price)}
                <span className="text-white/50 text-sm sm:text-base ml-2">
                  {usdToSolText(draft.price, solPrice)}
                </span>
              </div>

              {/* Description */}
              <div className="text-white/50 mt-1 sm:mt-2 text-sm sm:text-base line-clamp-2">
                {draft.description}
              </div>

            </div>
          </div>

          {/* STATUS BUTTON */}
          <div className="mt-4 sm:mt-6 w-full h-10 sm:h-11 md:h-[46px] rounded-xl bg-[#7b7b7b] flex items-center justify-center text-black text-sm sm:text-base font-medium gap-2">
            <Image src="/dollar-sign-svgrepo-black-com.svg" width={18} height={18} alt="Dollar" />
            Waiting for buyer to fund...
          </div>

        </div>
        <div className="w-full max-w-xl">
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className={`w-full ${UI.primaryButton} text-base md:text-lg ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? <span className="inline-flex items-center justify-center"><Spinner size={24} /></span> : 'Create Escrow Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EscrowScreen({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (type: 'physical' | 'digital') => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Create Escrow order</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* body */}
      <div className="mb-5 flex-1 flex items-center justify-center">
        <div className="w-full max-w-[720px] px-6 text-center">
          <div className="text-white text-[24px] md:text-[27px] font-semibold tracking-[-0.02em] mb-10">
            Is your item Physical or Digital?
          </div>
          <div className="grid grid-cols-2 sm:flex items-center justify-center gap-5 sm:gap-10">
            {/* Physical */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  onPick("physical")
                }}
                className="size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] hover:bg-[#303030] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 transition-all duration-200 grid place-items-center border border-white/5 hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <Image src="/box-1-svgrepo-com.svg" width={65} height={65} alt="Physical" />
              </button>

              <div className="text-[#A6A6A6] text-[18px]">Physical</div>
            </div>

            {/* Digital */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  onPick("digital")
                }}
                className="size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] hover:bg-[#303030] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 transition-all duration-200 grid place-items-center border border-white/5 hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <Image src="/cpu-svgrepo-com.svg" width={50} height={50} alt="Digital" />
              </button>

              <div className="text-[#A6A6A6] text-[18px]">Digital</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EscrowDigitalKind({
  onClose,
  onBack,
  onPick,
}: {
  onClose: () => void;
  onBack: () => void;
  onPick: (kind: 'nft' | 'other') => void;
}) {
  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium">Create Escrow order</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* body */}
      <div className="mb-5 flex-1 flex items-center justify-center">
        <div className="w-full max-w-[720px] px-6 text-center">
          <div className="text-white text-[24px] md:text-[27px] font-semibold tracking-[-0.02em] mb-10">
            Is your item an NFT or Other Digital goods?
          </div>
          <div className="grid grid-cols-2 sm:flex items-center justify-center gap-5 sm:gap-10">
            {/* NFT */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => onPick("nft")}
                className="size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] hover:bg-[#303030] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 transition-all duration-200 grid place-items-center border border-white/5 hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <Image src="/image-square-svgrepo-com.svg" width={50} height={50} alt="NFT" />
              </button>

              <div className="text-[#A6A6A6] text-[18px]">NFT</div>
            </div>

            {/* Other Digital goods */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => onPick("other")}
                className="size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] hover:bg-[#303030] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 transition-all duration-200 grid place-items-center border border-white/5 hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <Image src="/cpu-svgrepo-com.svg" width={50} height={50} alt="Other Digital goods" />
              </button>

              <div className="text-[#A6A6A6] text-[18px]">Other Digital goods</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatImage({
  path,
  getUrl,
  className = '',
  onLoaded,
  placeholderSrc,
}: {
  path: string;
  getUrl: (p: string) => Promise<string>;
  className?: string;
  onLoaded?: () => void;
  /** local preview shown until the real (signed) URL has loaded */
  placeholderSrc?: string;
}) {
  const [url, setUrl] = React.useState('');

  React.useEffect(() => {
    let alive = true;
    getUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path, getUrl]);

  if (!url) {
    return placeholderSrc ? (
      <img src={placeholderSrc} alt="sent" className={`block ${className}`} onLoad={() => onLoaded?.()} />
    ) : (
      <ImageSkeleton className={className} />
    );
  }

  return (
    <img
      src={url}
      alt="sent"
      className={`block ${className}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onLoad={() => onLoaded?.()}
    />
  );
}

function VoiceMessageBubble({
  path,
  duration,
  levels,
  mine,
  getUrl,
}: {
  path: string;
  duration: number;
  levels: number[];
  mine: boolean;
  getUrl: (p: string, bucket?: string) => Promise<string>;
}) {
  const barCount = 30;
  const bars = React.useMemo(() => {
    if (levels && levels.length > 0) {
      if (levels.length === barCount) return levels;
      const out: number[] = [];
      const step = levels.length / barCount;
      for (let i = 0; i < barCount; i++) {
        out.push(levels[Math.min(levels.length - 1, Math.floor(i * step))]);
      }
      return out;
    }
    // deterministic pseudo-waveform fallback so bars aren't perfectly flat
    return Array.from({ length: barCount }, (_, i) =>
      20 + Math.round(30 * Math.abs(Math.sin(i * 0.9)))
    );
  }, [levels]);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const urlRef = React.useRef<string>('');

  const [loading, setLoading] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const tick = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration && isFinite(audio.duration) ? audio.duration : duration || 1;
    setProgress(Math.min(1, dur > 0 ? audio.currentTime / dur : 0));
    setElapsed(audio.currentTime);
    if (!audio.paused && !audio.ended) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [duration]);

  const togglePlay = async () => {
    if (!audioRef.current) {
      setLoading(true);
      const signed = urlRef.current || (await getUrl(path, 'chat-voice'));
      setLoading(false);
      if (!signed) return;
      urlRef.current = signed;

      const audio = new Audio(signed);
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
        setElapsed(0);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      });
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    } else {
      try {
        await audio.play();
        setPlaying(true);
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const label = formatVoiceDuration(playing || elapsed > 0 ? elapsed : duration);

  return (
    <div
      className={[
        'flex items-center gap-3 px-3.5 py-2.5 md:px-4 md:py-3 rounded-[18px]',
        'w-[230px] md:w-[270px]',
        mine ? 'bg-white text-black' : 'bg-[#1f1f1f] text-white',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        title={playing ? 'Pause' : 'Play'}
        className={[
          'shrink-0 h-[36px] w-[36px] rounded-full grid place-items-center transition',
          mine ? 'bg-black text-white' : 'bg-white text-black',
          loading ? 'opacity-60' : 'hover:opacity-90',
        ].join(' ')}
      >
        {loading ? (
          <span className="h-[14px] w-[14px] rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : playing ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="4" width="5" height="16" rx="1.5" />
            <rect x="14" y="4" width="5" height="16" rx="1.5" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4.5v15l13-7.5-13-7.5z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-end gap-[2px] h-[24px]">
          {bars.map((h, i) => {
            const active = i / bars.length <= progress;
            const barHeight = Math.max(4, Math.min(24, Math.round((h / 100) * 24)));
            return (
              <span
                key={i}
                className={[
                  'w-[3px] rounded-full shrink-0 transition-all duration-150',
                  active ? (mine ? 'bg-black' : 'bg-[#26D9D9]') : (mine ? 'bg-black/25' : 'bg-white/25'),
                  playing && active && i === Math.floor(progress * bars.length) ? 'scale-y-125' : '',
                ].join(' ')}
                style={{ height: `${barHeight}px` }}
              />
            );
          })}
        </div>
        <div className={['text-[11px] tabular-nums', mine ? 'text-black/50' : 'text-white/50'].join(' ')}>
          {label}
        </div>
      </div>
    </div>
  );
}

function EscrowCard({
  orderId,
  loadEscrow,
  supabase,
  viewerId,
  onBuy,
  onFundEscrow,
  onMarkShipped,
  onReview,
  onRefund,
  onCancel,
  onRespond,
  onDisputeRefund,
  onRefundDiscuss,
  onPaySeller,
  onUploadFile,
  onDownload
}: {
  orderId: string
  loadEscrow: (id: string) => Promise<any>
  supabase: any
  viewerId: string | null
  onBuy: (order:any) => void
  onFundEscrow?: (order:any) => void
  onMarkShipped?: (order:any)=>void
  onReview?: (order:any)=>void
  onRefund?: (order:any)=>void
  onCancel?: (order:any)=>void
  onRespond?: (order:any)=>void
  onDisputeRefund: (order:any)=>void
  onRefundDiscuss: (order:any)=>void
  onPaySeller: (order:any)=>void
  onUploadFile: (order:any)=>void
  onDownload: (order:any) => void
}) {

  const [order, setOrder] = React.useState<any>(null);
  const [imageUrl, setImageUrl] = React.useState<string>("");

  const isSeller = order?.seller_id === viewerId
  const isBuyer = order?.buyer_id === viewerId
  const type = order?.type

  React.useEffect(() => {
    loadEscrow(orderId).then(setOrder);
  }, [orderId, loadEscrow]);

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  if (!order) return <EscrowCardSkeleton />;

  const status = order?.status

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full min-w-[300px] max-w-[340px] md:w-[360px] ${UI.panel} p-4`}
    >
      <div className="flex gap-2 mb-3">
        <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
          {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
        </div>

        {type === "physical" && (
          <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
            {order.dispute_mode === "BTR" ? "BTR" : "STR"}
          </div>
        )}

        {order.type !== "nft" && (
          <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
            {order.type === "digital"
              ? `${order.ship_time_hours}h`
              : order.ship_date}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            className="w-[64px] h-[64px] md:w-[80px] md:h-[80px] rounded-xl object-cover"
          />
        ) : (
          <div className="w-[64px] h-[64px] md:w-[80px] md:h-[80px] rounded-xl bg-white/10 animate-pulse" />
        )}

        <div>
          <div className="text-[#26D9D9] text-[16px] md:text-[20px] font-bold">
            {order.order_name}
          </div>

          <div className="text-white text-[19px] md:text-[24px]">
            ${order.price_usd}
          </div>

          <div className="text-white/50 text-[12px] md:text-[14px]">
            {order.description}
          </div>
        </div>
      </div>
      {isBuyer && status === "onchain_created" && (
        <AsyncButton
          onClick={() => onBuy(order)}
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
        >
          <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar"/>
          Buy
        </AsyncButton>
      )}

      {isBuyer && status === "BuyerFunded" && (
        <AsyncButton
          onClick={() => onRefund?.(order)}
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
        >
          <Image src="/refund-forward-svgrepo-com (1).svg" width={22} height={22} alt="Refund"/>
          Refund
        </AsyncButton>
      )}

      {isBuyer && status === "Shipping" && (
        <button
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#7b7b7b] text-black font-medium flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Image src="/truck-speed-svgrepo-com.svg" width={24} height={24} alt="Dollar"/>
          Seller Shipping item...
        </button>
      )}

      {isBuyer && status === "Shipped" && order.type === "physical" && (
        <AsyncButton
          onClick={() => onReview?.(order)}
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
        >
          <Image src="/eye-show-svgrepo-com.svg" width={24} height={24} alt="review"/>
          Review
        </AsyncButton>
      )}

      {isBuyer && status === "Shipped" && order.type === "digital" && (
        <div>
          <AsyncButton
            onClick={() => onDownload(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
          >
            <Image src="/download-svgrepo-com.svg" width={20} height={20} alt="download" className='mb-0.5'/>
            Download Item
          </AsyncButton>

          <AsyncButton
            onClick={() => onReview?.(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
          >
            <Image src="/eye-show-svgrepo-com.svg" width={24} height={24} alt="review"/>
            Review
          </AsyncButton>
        </div>
      )}

      {isSeller && status === "onchain_created" && order.type !== "nft" && (
        <button
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#7b7b7b] text-black font-medium flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar"/>
          Waiting for buyer to fund...
        </button>
      )}

      {isSeller && status === "onchain_created" && order.type === "nft" && (
        <AsyncButton
          onClick={() => onCancel?.(order)}
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#510000] text-[#FF0000] font-medium flex items-center justify-center gap-2"
        >
          <Image src="/cancel-red-svgrepo-com.svg" width={12} height={12} alt="Cancel"/>
          Cancel Listing
        </AsyncButton>
      )}

      {isSeller && status === "BuyerFunded" && (
        <AsyncButton
          onClick={() => onFundEscrow?.(order)}
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
        >
          <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar"/>
          Fund Escrow
        </AsyncButton>
      )}

      {isBuyer && status === "Discuss" && (
        <AsyncButton
          onClick={() => onPaySeller?.(order)}
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
        >
          <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar"/>
          Pay Seller
        </AsyncButton>
      )}


      {isSeller && status === "Discuss" && (
        <AsyncButton
          onClick={() => onRefundDiscuss?.(order)}
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
        >
          <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="respond"/>
          Refund Buyer {/*During discuss time*/}
        </AsyncButton>
      )}

      {isSeller && status === "Shipping" && order.type === "physical" && (
        <div>
          <AsyncButton
            onClick={() => onMarkShipped?.(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
          >
            <Image src="/check-svgrepo-com.svg" width={22} height={22} alt="mark"/>
            Mark as Shipped
          </AsyncButton>

          <AsyncButton
            onClick={() => onCancel?.(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#510000] text-[#FF0000] font-medium flex items-center justify-center gap-2"
          >
            <Image src="/cancel-red-svgrepo-com.svg" width={12} height={12} alt="Cancel"/>
            Cancel
          </AsyncButton>
        </div>
      )}

      {isSeller && status === "Shipping" && order.type === "digital" && (
        <div>
          <AsyncButton
            onClick={() => onUploadFile?.(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
          >
            <Image src="/upload-svgrepo-com (1).svg" width={17} height={17} alt="upload"/>
            Upload file
          </AsyncButton>

          <AsyncButton
            onClick={() => onCancel?.(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#510000] text-[#FF0000] font-medium flex items-center justify-center gap-2"
          >
            <Image src="/cancel-red-svgrepo-com.svg" width={12} height={12} alt="Cancel"/>
            Cancel
          </AsyncButton>
        </div>
      )}

      {isSeller && status === "Shipped" && (
        <button
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#7b7b7b] text-black font-medium flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Image src="/eye-show-svgrepo-com.svg" width={24} height={24} alt="review"/>
          Waiting for buyer to review...
        </button>
      )}

      {isSeller && status === "Dispute" && (
        <div>
          <AsyncButton
            onClick={() => onRespond?.(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
          >
            <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="respond"/>
            Respond
          </AsyncButton>
          <AsyncButton
            onClick={()=>onDisputeRefund(order)}
            className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
          >
            <Image src="/refund-forward-svgrepo-com (1).svg" width={20} height={20} alt="refund"/>
            Refund
          </AsyncButton>
        </div>
      )}

      {isBuyer && status === "Dispute" && (
        <button
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#7b7b7b] text-black font-medium flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="respond"/>
          Waiting for seller to respond...
        </button>
      )}

      {status === "Cancelled" && (
        <button
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#7b7b7b] text-black font-medium flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Image src="/cancel-black-svgrepo-com.svg" width={12} height={12} alt="Cancelled"/>
          Cancelled
        </button>
      )}

      {status === "Completed" && (
        <button
          className="mt-4 h-[37px] md:h-[40px] w-full rounded-xl bg-[#7b7b7b] text-black font-medium flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Image src="/check-svgrepo-com.svg" width={20} height={20} alt="Completed"/>
          Completed
        </button>
      )}

    </motion.div>
  );
}

function OpenDisputeScreen({
  order,
  supabase,
  onNext
}: {
  order: any
  supabase: any
  onNext:()=>void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Open Dispute
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          Before you open dispute you have to read all the information in the next page carefully
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/eye-show-svgrepo-com.svg" width={22} height={22} alt="refund" className='mb-0.5 mr-1.5'/>
            Review
          </button>
        </div>
          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    </div>
  )
}

function BuyerRefundScreen({
  order,
  onClose,
  supabase,
  onRefund
}: {
  order: any
  onClose: () => void
  supabase: any
  onRefund: (order:any) => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [step, setStep] = React.useState<"details" | "receipt">("details");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  const bond = order.price_usd * 0.2
  const total = order.price_usd + bond

  if (step === "receipt") {
    return (
      <div className="h-full flex flex-col">
        {/* top bar */}
        <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
          {/* LEFT */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
              title="Back"
            >
              <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
            </button>

            <div className="text-white text-[18px] font-medium truncate">
              Refund
            </div>
          </div>

          {/* RIGHT */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Close"
          >
            <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">

          <div className="text-white text-2xl">
            What you'll get back
          </div>
          {imageUrl ? (
            <img
              src={imageUrl}
              className="w-[140px] h-[140px] rounded-xl object-cover"
            />
          ) : (
            <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
          )}
          {/* card */}
          <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Item's Price:</span>
              <span className='text-[11px] mt-1'>
                {(order.price_usd / solPrice).toFixed(5)} SOL
              </span>
              <span>${order.price_usd}</span>
            </div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond (20%):</span>
              <span className='text-[11px] mt-1'>
                {(bond / solPrice).toFixed(5)} SOL
              </span>
              <span>${bond}</span>
            </div>

            <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
              <span>Total</span>
              <span className='text-[14px] mt-1'>
                {(total / solPrice).toFixed(5)} SOL
              </span>
              <span>${total}</span>
            </div>

          </div>

          <AsyncButton
            onClick={()=>onRefund(order)}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[320px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Refund
          </AsyncButton>

        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Refund</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Refund
        </div>
        <div className="text-white/50 text-[14px] text-center max-w-[420px]">
          You'll get your funded money back
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/refund-forward-svgrepo-com (1).svg" width={22} height={22} alt="refund" className='mb-0.5 mr-1.5'/>
            Refund
          </button>
        </div>
          <button
            onClick={()=>setStep("receipt")}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Refund
          </button>
      </div>
    </div>
  )
}

function SellerCancelScreen({
  order,
  onClose,
  supabase,
  onRefund
}: {
  order: any
  onClose: () => void
  supabase: any
  onRefund: (order:any) => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [step, setStep] = React.useState<"details" | "receipt">("details");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  const buyerBond = order.price_usd * 0.2
  const buyerTotal = order.price_usd + buyerBond

  const sellerBond = order.dispute_mode === "STR"
    ? order.price_usd * 1.2
    : order.price_usd * 0.2
  const sellerTotal = sellerBond
  if (step === "receipt" && order.type !== "nft") {
    return (
      <div className="h-full flex flex-col">
        {/* top bar */}
        <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
          {/* LEFT */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
              title="Back"
            >
              <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
            </button>

            <div className="text-white text-[18px] font-medium truncate">
              Cancel
            </div>
          </div>

          {/* RIGHT */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Close"
          >
            <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8 overflow-y-auto">

          <div className="text-white text-2xl">
            What you'll get back
          </div>
          {imageUrl ? (
            <img
              src={imageUrl}
              className="w-[100px] h-[100px] rounded-xl object-cover"
            />
          ) : (
            <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
          )}

          {/* You (seller) */}
          <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">
            <div className="text-white/50 text-[13px] uppercase tracking-wide">You get back</div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond ({order.dispute_mode === "STR" ? "120%" : "20%"}):</span>
              <span className='text-[11px] mt-1'>
                {(sellerBond / solPrice).toFixed(5)} SOL
              </span>
              <span>${sellerBond}</span>
            </div>

            <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
              <span>Total</span>
              <span className='text-[14px] mt-1'>
                {(sellerTotal / solPrice).toFixed(5)} SOL
              </span>
              <span>${sellerTotal}</span>
            </div>
          </div>

          {/* Buyer */}
          <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">
            <div className="text-white/50 text-[13px] uppercase tracking-wide">Buyer gets back</div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Item's Price:</span>
              <span className='text-[11px] mt-1'>
                {(order.price_usd / solPrice).toFixed(5)} SOL
              </span>
              <span>${order.price_usd}</span>
            </div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond (20%):</span>
              <span className='text-[11px] mt-1'>
                {(buyerBond / solPrice).toFixed(5)} SOL
              </span>
              <span>${buyerBond}</span>
            </div>

            <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
              <span>Total</span>
              <span className='text-[14px] mt-1'>
                {(buyerTotal / solPrice).toFixed(5)} SOL
              </span>
              <span>${buyerTotal}</span>
            </div>
          </div>

          <AsyncButton
            onClick={()=>onRefund(order)}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[320px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Cancel
          </AsyncButton>

        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Cancel</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Cancel
        </div>
        <div className="text-white/50 text-[14px] text-center max-w-[420px]">
          {order.type === "nft"
            ? "This listing will be closed and the NFT returned to your wallet."
            : "After you click Cancel you and buyer will get all the money back and this order will be cancel"}
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            {order.type !== "nft" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.type === "digital"
                  ? `${order.ship_time_hours}h`
                  : order.ship_date}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-[#510000] text-[#FF0000] flex items-center justify-center font-medium"
          >
            <Image src="/cancel-red-svgrepo-com.svg" width={12} height={12} alt="cancel" className='mb-0.5 mr-1.5'/>
            Cancel
          </button>
        </div>
          <AsyncButton
            onClick={()=> order.type === "nft" ? onRefund(order) : setStep("receipt")}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Cancel
          </AsyncButton>
      </div>
    </div>
  )
}

function WYNTKRespondScreen({
  order,
  onClose,
  supabase,
  onBack,
  onNext,
  step
}: {
  order: any
  onClose: () => void
  supabase: any
  onBack:()=>void
  onNext: () => void
  step: number
}) {

  type Step = "wyntk" | "1" | "2" | "3" | "respond" 

  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
    {/* top bar */}
    <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
      {/* LEFT */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Back"
        >
          <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
        </button>

        <div className="text-white text-[18px] font-medium truncate">
          Respond Dispute
        </div>
      </div>

      {/* RIGHT */}
      <button
        type="button"
        onClick={onClose}
        className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
        title="Close"
      >
        <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
      </button>
    </div>
    {/* BODY */}
    {step === 0 && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="w-20 h-20 rounded-full bg-[#402F11] flex items-center justify-center mb-2">
          <Image src="/info-svgrepo-com.svg" width={40} height={40} alt="info" />
        </div>
        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          What you need to know before respond dispute
        </div>

          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === 1 && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="flex items-center justify-center mb-2">
          <Image src="/discuss-svgrepo-com (2).svg" width={70} height={70} alt="discuss" />
        </div>
        <div className="text-white text-[24px] text-center max-w-[420px]">
          After you respond dispute you will have 24 hours to discuss with the buyer
        </div>

          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === 2 && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="flex items-center justify-center mb-2">
          <Image src="/reply-svgrepo-com (2).svg" width={70} height={70} alt="return" />
        </div>
        <div className="text-white text-[22px] text-center max-w-[420px]">
          During the discussion you can return money to the buyer and you will get all your money back
        </div>

          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === 3 && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="flex items-center justify-center mb-2">
          <Image src="/time-svgrepo-com (2).svg" width={70} height={70} alt="time" />
        </div>
        <div className="text-white text-[22px] text-center max-w-[420px]">
          If discussion time ends but buyer or seller didn’t do anything this dispute will ends in draw and both seller and buyer will lose all their money
        </div>

          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    </div>
  )
}

function RespondDisputeWyntkScreen({
  order,
  onClose,
  supabase,
  onBack,
  onNext
}: {
  order: any
  onClose: () => void
  supabase: any
  onBack: () => void
  onNext: () => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
    {/* top bar */}
    <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
      {/* LEFT */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Back"
        >
          <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
        </button>

        <div className="text-white text-[18px] font-medium truncate">
          Respond Dispute
        </div>
      </div>

      {/* RIGHT */}
      <button
        type="button"
        onClick={onClose}
        className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
        title="Close"
      >
        <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
      </button>
    </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Respond Dispute
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          After you respond dispute you have 24 hours to discuss with the buyer
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="Respond" className='mb-0.5 mr-1.5'/>
            Respond
          </button>
        </div>
          <AsyncButton
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Respond Dispute
          </AsyncButton>
      </div>
    </div>
  )
}

function RespondDisputeScreen({
  order,
  onClose,
  supabase,
  onNext
}: {
  order: any
  onClose: () => void
  supabase: any
  onNext: () => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Respond Dispute</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Respond Dispute
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          Before you respond to this dispute you have to read all the information in the next page carefully
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="Respond" className='mb-0.5 mr-1.5'/>
            Respond
          </button>
        </div>
          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    </div>
  )
}

function PaySellerDiscussScreen({
  order,
  onClose,
  supabase,
  onNext
}: {
  order: any
  onClose: () => void
  supabase: any
  onNext: () => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Pay Seller During Discuss</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Pay Seller
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          After you click Pay Seller will get paid and you will get your bond money back
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/dollar-sign-svgrepo-black-com.svg" width={17} height={17} alt="Dollar" className='mb-0.5 mr-1.5'/>
            Pay Seller
          </button>
        </div>
          <AsyncButton
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Pay Seller
          </AsyncButton>
      </div>
    </div>
  )
}

function RefundBuyerDiscussScreen({
  order,
  onClose,
  supabase,
  onNext
}: {
  order: any
  onClose: () => void
  supabase: any
  onNext: () => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [step, setStep] = React.useState<"details" | "receipt">("details");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  const buyerBond = order.price_usd * 0.2
  const buyerTotal = order.price_usd + buyerBond

  const sellerBond = order.dispute_mode === "STR"
    ? order.price_usd * 1.2
    : order.price_usd * 0.2
  const sellerTotal = sellerBond

  if (step === "receipt") {
    return (
      <div className="h-full flex flex-col">
        {/* top bar */}
        <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
          {/* LEFT */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
              title="Back"
            >
              <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
            </button>

            <div className="text-white text-[18px] font-medium truncate">
              Refund During Discuss
            </div>
          </div>

          {/* RIGHT */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Close"
          >
            <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8 overflow-y-auto">

          <div className="text-white text-2xl">
            What you'll get back
          </div>
          {imageUrl ? (
            <img
              src={imageUrl}
              className="w-[100px] h-[100px] rounded-xl object-cover"
            />
          ) : (
            <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
          )}

          {/* You (seller) */}
          <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">
            <div className="text-white/50 text-[13px] uppercase tracking-wide">You get back</div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond ({order.dispute_mode === "STR" ? "120%" : "20%"}):</span>
              <span className='text-[11px] mt-1'>
                {(sellerBond / solPrice).toFixed(5)} SOL
              </span>
              <span>${sellerBond}</span>
            </div>

            <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
              <span>Total</span>
              <span className='text-[14px] mt-1'>
                {(sellerTotal / solPrice).toFixed(5)} SOL
              </span>
              <span>${sellerTotal}</span>
            </div>
          </div>

          {/* Buyer */}
          <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">
            <div className="text-white/50 text-[13px] uppercase tracking-wide">Buyer gets back</div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Item's Price:</span>
              <span className='text-[11px] mt-1'>
                {(order.price_usd / solPrice).toFixed(5)} SOL
              </span>
              <span>${order.price_usd}</span>
            </div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond (20%):</span>
              <span className='text-[11px] mt-1'>
                {(buyerBond / solPrice).toFixed(5)} SOL
              </span>
              <span>${buyerBond}</span>
            </div>

            <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
              <span>Total</span>
              <span className='text-[14px] mt-1'>
                {(buyerTotal / solPrice).toFixed(5)} SOL
              </span>
              <span>${buyerTotal}</span>
            </div>
          </div>

          <AsyncButton
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[320px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Refund
          </AsyncButton>

        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Refund During Discuss</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Refund
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          After you click refund everyone will get all their money back
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/dollar-sign-svgrepo-black-com.svg" width={17} height={17} alt="Dollar" className='mb-0.5 mr-1.5'/>
            Refund Buyer
          </button>
        </div>
          <button
            onClick={()=>setStep("receipt")}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Refund
          </button>
      </div>
    </div>
  )
}

function RefundScreen({
  order,
  onClose,
  supabase,
  onNext
}: {
  order: any
  onClose: () => void
  supabase: any
  onNext: () => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [step, setStep] = React.useState<"details" | "receipt">("details");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  const buyerBond = order.price_usd * 0.2
  const buyerTotal = order.price_usd + buyerBond

  const sellerBond = order.dispute_mode === "STR"
    ? order.price_usd * 1.2
    : order.price_usd * 0.2
  const sellerTotal = sellerBond

  if (step === "receipt") {
    return (
      <div className="h-full flex flex-col">
        {/* top bar */}
        <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
          {/* LEFT */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setStep("details")}
              className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
              title="Back"
            >
              <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
            </button>

            <div className="text-white text-[18px] font-medium truncate">
              Refund
            </div>
          </div>

          {/* RIGHT */}
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Close"
          >
            <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8 overflow-y-auto">

          <div className="text-white text-2xl">
            What you'll get back
          </div>
          {imageUrl ? (
            <img
              src={imageUrl}
              className="w-[100px] h-[100px] rounded-xl object-cover"
            />
          ) : (
            <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
          )}

          {/* You (seller) */}
          <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">
            <div className="text-white/50 text-[13px] uppercase tracking-wide">You get back</div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond ({order.dispute_mode === "STR" ? "120%" : "20%"}):</span>
              <span className='text-[11px] mt-1'>
                {(sellerBond / solPrice).toFixed(5)} SOL
              </span>
              <span>${sellerBond}</span>
            </div>

            <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
              <span>Total</span>
              <span className='text-[14px] mt-1'>
                {(sellerTotal / solPrice).toFixed(5)} SOL
              </span>
              <span>${sellerTotal}</span>
            </div>
          </div>

          {/* Buyer */}
          <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">
            <div className="text-white/50 text-[13px] uppercase tracking-wide">Buyer gets back</div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Item's Price:</span>
              <span className='text-[11px] mt-1'>
                {(order.price_usd / solPrice).toFixed(5)} SOL
              </span>
              <span>${order.price_usd}</span>
            </div>

            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond (20%):</span>
              <span className='text-[11px] mt-1'>
                {(buyerBond / solPrice).toFixed(5)} SOL
              </span>
              <span>${buyerBond}</span>
            </div>

            <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
              <span>Total</span>
              <span className='text-[14px] mt-1'>
                {(buyerTotal / solPrice).toFixed(5)} SOL
              </span>
              <span>${buyerTotal}</span>
            </div>
          </div>

          <AsyncButton
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[320px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Refund
          </AsyncButton>

        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Refund</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Refund
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          After you click refund everyone will get all their money back
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="Respond" className='mb-0.5 mr-1.5'/>
            Respond
          </button>
        </div>
          <button
            onClick={()=>setStep("receipt")}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Refund
          </button>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();

  return "/file-svgrepo-com (3).svg";
}

function UploadFileScreen({
  order,
  onClose,
  supabase,
  onSendFile
}: {
  order: any
  onClose: () => void
  supabase: any
  onSendFile: (order: any, file: File) => Promise<void>
}) {
  const [step, setStep] = React.useState<"upload" | "confirm">("upload");
  const [imageUrl, setImageUrl] = React.useState<string>("");

  const [sending, setSending] = React.useState(false);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {
      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
      {step === "upload" && (
        <>
          <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
            <div className="text-white text-[18px] font-medium">Upload File</div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
            >
              <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
            </button>
          </div>
        </>
      )}

      {step === "confirm" && (
        <>
          <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
                title="Back"
              >
                <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
              </button>

              <div className="text-white text-[18px] font-medium truncate">
                Upload File
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
              title="Close"
            >
              <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
            </button>
          </div>
        </>
      )}

      {step === "upload" && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
            <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
              Upload file
            </div>

            <div className="text-white/50 text-[17px] text-center max-w-[420px]">
              Since this is a digital product, just upload the file and click send to deliver it to the buyer.
            </div>

            <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
              <div className="flex gap-2 mb-3">
                <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                  {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
                </div>

                {order.type === "physical" && (
                  <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                    {order.dispute_mode === "BTR" ? "BTR" : "STR"}
                  </div>
                )}

                <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                  {order.type === "digital"
                    ? `${order.ship_time_hours}h`
                    : order.ship_date}
                </div>
              </div>

              <div className="flex gap-4">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    className="w-[80px] h-[80px] rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
                )}

                <div>
                  <div className="text-[#26D9D9] text-xl font-bold">
                    {order.order_name}
                  </div>

                  <div className="text-white text-2xl">
                    ${order.price_usd}
                  </div>

                  <div className="text-white/50 text-sm">
                    {order.description}
                  </div>
                </div>
              </div>

              <button
                className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
              >
                <Image src="/upload-svgrepo-com (1).svg" width={16} height={16} alt="upload" className='mb-0.5 mr-1.5'/>
                Upload file
              </button>
            </div>

            <button
              onClick={() => setStep("confirm")}
              className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
            >
              Next
            </button>
          </div>
        </>
      )}

      {step === "confirm" && (
        <>
          <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8 px-4">
            <div className="text-white text-[26px] text-center">
              Upload file
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
            />

            {!selectedFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-[340px] h-[180px] rounded-2xl bg-[#222222] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-[#2a2a2a] transition"
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#26D9D9"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>

                <div className="text-white/40 text-[13px]">
                  Upload file here
                </div>
              </button>
            ) : (
              <div className="w-full max-w-[340px] rounded-xl bg-[#222222] px-3 py-2 flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <img
                    src={getFileIcon(selectedFile.name)}
                    alt="file"
                    className="w-10 h-10 object-contain shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "/document-ui-description-svgrepo-com.svg";
                    }}
                  />

                  <div className="min-w-0">
                    <div className="text-[#d9d9d9] text-[14px] truncate">
                      {selectedFile.name}
                    </div>
                    <div className="text-[#666] text-[12px]">
                      {formatFileSize(selectedFile.size)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-[#d9d9d9] text-[18px] leading-none shrink-0"
                >
                  ×
                </button>
              </div>
            )}

            <button
              disabled={!selectedFile || sending}
              onClick={async () => {
                if (!selectedFile) return;

                try {
                  setSending(true);
                  await onSendFile(order, selectedFile);
                  onClose();
                } catch (err: any) {
                  reportError(err, "upload-delivery-file");
                } finally {
                  setSending(false);
                }
              }}
              className={`h-[48px] rounded-xl font-bold text-[16px] w-full max-w-[340px] transition mt-[-8px]
                ${
                  selectedFile && !sending
                    ? "bg-[#26D9D9] text-black hover:opacity-90"
                    : "bg-[#136262] text-black cursor-not-allowed"
                }`}
            >
              {sending ? <span className="inline-flex items-center justify-center"><Spinner size={22} /></span> : "Send"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DownloadScreen({
  order,
  onClose,
  supabase,
}: {
  order: any
  onClose: () => void
  supabase: any
}) {
  const [step, setStep] = React.useState<"intro" | "download">("intro");
  const [imageUrl, setImageUrl] = React.useState<string>("");
  const [downloadUrl, setDownloadUrl] = React.useState<string>("");
  const [loadingFile, setLoadingFile] = React.useState(false);

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {
      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  async function goToDownloadStep() {
    try {
      setLoadingFile(true);

      if (!order?.delivery_file_path) {
        pushToast("No delivery file found");
        return;
      }

      const { data, error } = await supabase.storage
        .from("digital-delivery")
        .createSignedUrl(order.delivery_file_path, 60 * 60);

      if (error) {
        reportError(error, "load-delivery-file");
        return;
      }

      setDownloadUrl(data.signedUrl);
      setStep("download");
    } finally {
      setLoadingFile(false);
    }
  }

  function handleDownload() {
    if (!downloadUrl) return;

    window.open(downloadUrl, "_blank");
  }

  const fileName =
    order?.delivery_file_name ||
    order?.delivery_file_path?.split("/").pop() ||
    "download-file";

  const fileSizeText = formatFileSize(Number(order?.delivery_file_size || 0));

  return (
    <div className="h-full w-full flex flex-col self-stretch">
      {step === "intro" && (
        <div className="w-full h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-white text-[18px] font-medium truncate">
              Download Item
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Close"
          >
            <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
          </button>
        </div>
      )}

      {step === "download" && (
        <div className="w-full h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setStep("intro")}
              className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
              title="Back"
            >
              <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
            </button>

            <div className="text-white text-[18px] font-medium truncate">
              Download File
            </div>

          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Close"
          >
            <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
          </button>
        </div>
      )}

      {step === "intro" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
          <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
            Download Item
          </div>

          <div className="text-white/50 text-[17px] text-center max-w-[420px]">
            You can get the item file by clicking download on the next page.
          </div>

          <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
            <div className="flex gap-2 mb-3">
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
              </div>

              {order.type === "physical" && (
                <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                  {order.dispute_mode === "BTR" ? "BTR" : "STR"}
                </div>
              )}

              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.type === "digital"
                  ? `${order.ship_time_hours}h`
                  : order.ship_date}
              </div>
            </div>

            <div className="flex gap-4">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  className="w-[80px] h-[80px] rounded-xl object-cover"
                />
              ) : (
                <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
              )}

              <div>
                <div className="text-[#26D9D9] text-xl font-bold">
                  {order.order_name}
                </div>

                <div className="text-white text-2xl">
                  ${order.price_usd}
                </div>

                <div className="text-white/50 text-sm">
                  {order.description}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
            >
              <Image
                src="/download-svgrepo-com.svg"
                width={20}
                height={20}
                alt="download"
                className="mb-0.5 mr-1.5"
              />
              Download
            </button>
          </div>

          <button
            onClick={goToDownloadStep}
            disabled={loadingFile}
            className={`h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] transition
              ${
                loadingFile
                  ? "bg-[#136262] text-black cursor-not-allowed"
                  : "bg-[#26D9D9] text-black hover:opacity-90"
              }`}
          >
            {loadingFile ? <ButtonLoadingLabel label="Preparing..." /> : "Next"}
          </button>
        </div>
      )}

      {step === "download" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8 px-4">
          <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center">
            Dowload File
          </div>

          <div className="text-white/50 text-[17px] text-center max-w-[340px]">
            Review this order after downloading, although the seller is paid automatically.
          </div>

          <div className="w-full max-w-[340px] rounded-xl bg-[#222222] px-3 py-2 flex items-start justify-between gap-3">
            <div className="flex gap-3 min-w-0">
              <img
                src={getFileIcon(fileName)}
                alt="file"
                className="w-10 h-10 object-contain shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/document-ui-description-svgrepo-com.svg";
                }}
              />

              <div className="min-w-0">
                <div className="text-[#d9d9d9] text-[14px] truncate max-w-[220px]">
                  {fileName}
                </div>
                <div className="text-[#666] text-[12px]">
                  {fileSizeText}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!downloadUrl}
            className={`h-[48px] rounded-xl font-bold text-[16px] w-full max-w-[340px] transition
              ${
                downloadUrl
                  ? "bg-[#26D9D9] text-black hover:opacity-90"
                  : "bg-[#136262] text-black cursor-not-allowed"
              }`}
          >
            Download File
          </button>
        </div>
      )}
    </div>
  );
}

function FundEscrowScreen({
  order,
  onClose,
  supabase,
  onNext
}: {
  order: any
  onClose: () => void
  supabase: any
  onNext: () => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Buyer Fund Escrow</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Fund Escrow
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          Deposit money to Escrow before buying this item.
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>


            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar" className='mb-0.5 mr-1.5'/>
            Fund Escrow
          </button>
        </div>
          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    </div>
  )
}

function SellerFundEscrowScreen({ 
  order,
  onClose,
  supabase,
  onNext
}: {
  order: any
  onClose: () => void
  supabase: any
  onNext: () => void
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Seller Fund Escrow</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Fund Escrow
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          Pay the bond to start selling. Shipping time starts immediately after payment. If you miss the delivery deadline, you will lose your bond.
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar" className='mb-0.5 mr-1.5'/>
            Fund Escrow
          </button>
        </div>
          <button
            onClick={onNext}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    </div>
  )
}

function ReadTicks({ read }: { read: boolean }) {
  return (
    <Image
      src={read ? '/read.svg' : '/unread.svg'}
      alt={read ? 'read' : 'unread'}
      width={16}
      height={16}
      className="block shrink-0"
      priority
    />
  );
}

function DisputMode({
  onClose,
  onPick,
  onBack,
}: {
  onClose: () => void;
  onBack: () => void;
  onPick: (type: 'BTR' | 'STR') => void;
}) {
  const [ModeInfo, setModeInfo] = React.useState(false);
  const [ModeInfo1, setModeInfo1] = React.useState(false);
  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Create Escrow order
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* body */}
      <div className="mb-5 flex-1 flex items-center justify-center">
        <div className="w-full max-w-[720px] px-6 text-center">
          <div className="text-white text-[24px] md:text-[27px] font-semibold tracking-[-0.02em] mb-10">
            Select Draw Dispute mode
          </div>
          <div className="grid grid-cols-2 sm:flex items-center justify-center gap-5 sm:gap-10">
            {/* Physical */}
            <div className="flex flex-col items-center gap-4">

              <button
                type="button"
                onClick={() => onPick('BTR')}
                className="size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] hover:bg-[#303030] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 transition-all duration-200 grid place-items-center border border-white/5 hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <span className="text-[#26D9D9] text-[60px] font-bold whitespace-nowrap">
                  B
                </span>

              </button>

              <div className="flex flex-1 justify-center">
                <div
                  className="relative flex items-center group"
                  onMouseEnter={() => setModeInfo1(true)}
                  onMouseLeave={() => setModeInfo1(false)}
                >
                  <div className="text-[#A6A6A6] text-[18px]">BTR</div>
                  <Image
                    src="/question-circle-svgrepo-com.svg"
                    width={18}
                    height={18}
                    alt="info"
                    onClick={() => setModeInfo1((prev) => !prev)}
                    className="mb-0.5 ml-3 cursor-pointer opacity-70 hover:opacity-100"
                  />

                  {ModeInfo1 && (
                    <div
                      className="absolute z-50 mt-8
                                left-1/2 -translate-x-1/2
                                top-0
                                w-[260px] p-3
                                rounded-[8px]
                                bg-[#1A1A1A]
                                text-white text-[12px]
                                shadow-xl
                                border border-white/10"
                    >
                      When a Dispute end in draw buyer will lose the most amount of money.
                    </div>
                      )}
                  </div>
                </div>
              </div>

            {/* Digital */}
            <div className="flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => onPick('STR')}
                className="size-[clamp(6.75rem,33vw,8.625rem)] rounded-[18px] bg-[#262626] hover:bg-[#303030] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 transition-all duration-200 grid place-items-center border border-white/5 hover:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <span className="text-[#26D9D9] text-[60px] font-bold whitespace-nowrap">
                  S
                </span>
              </button>

              <div className="flex flex-1 justify-center">
                <div
                  className="relative flex items-center group"
                  onMouseEnter={() => setModeInfo(true)}
                  onMouseLeave={() => setModeInfo(false)}
                >
                  <div className="text-[#A6A6A6] text-[18px]">STR</div>
                  <Image
                    src="/question-circle-svgrepo-com.svg"
                    width={18}
                    height={18}
                    alt="info"
                    onClick={() => setModeInfo((prev) => !prev)}
                    className="mb-0.5 ml-3 cursor-pointer opacity-70 hover:opacity-100"
                  />

                  {ModeInfo && (
                    <div
                      className="absolute z-50 mt-8
                                left-1/2 -translate-x-1/2
                                top-0
                                w-[260px] p-3
                                rounded-[8px]
                                bg-[#1A1A1A]
                                text-white text-[12px]
                                shadow-xl
                                border border-white/10"
                    >
                      When a Dispute end in draw seller will lose the most amount of money. and seller have to deposit more bond than BTR mode.
                    </div>
                      )}
                  </div>
                </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarkShippedScreen({
  order,
  onClose,
  supabase,
  onConfirm
}:{
  order:any
  onClose:()=>void
  supabase:any
  onConfirm:(order:any)=>void
}){

  const [imageUrl,setImageUrl] = React.useState("")

  React.useEffect(()=>{
    if(!order?.image_path) return

    async function load(){
      const {data} = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path,60*60)

      if(data) setImageUrl(data.signedUrl)
    }

    load()
  },[order])

  return (
    <div className="h-full flex flex-col">

      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">
          Mark as Shipped
        </div>

        <button onClick={onClose}>
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X"/>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <Image src="/warn-triangle-filled-svgrepo-com (1).svg" width={45} height={45} alt="warn"/>

        <div className="text-orange-500 text-center max-w-[420px] text-[16px]">
          If you lie that you shipped this item buyer will open dispute
          and you possibly will lose your bond
        </div>

        <div className="w-[360px] rounded-2xl bg-[#0e0e0e] border border-white/10 p-4">
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white text-black font-medium flex items-center justify-center gap-2 hover:brightness-95 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-all duration-200"
          >
            <Image src="/check-svgrepo-com.svg" width={22} height={22} alt="Dollar"/>
            Mark as Shipped
          </button>
        </div>

        <AsyncButton
          onClick={()=>onConfirm(order)}
          className="h-[46px] w-full max-w-[420px] rounded-[10px] bg-[#26D9D9] text-black font-semibold"
        >
          Mark this order as Shipped
        </AsyncButton>

      </div>
    </div>
  )
}

function FundModeWarning({
  mode,
  onContinue,
  onClose
}:{
  mode:"BTR"|"STR"
  onContinue:()=>void
  onClose:()=>void
}){

  const text =
    mode === "BTR"
      ? "This order uses BTR Mode. If a dispute ends in a draw, the buyer loses more money."
      : "This order uses STR Mode. If a dispute ends in a draw, the seller loses more money."

  return (
    <div className="h-full flex flex-col">
      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Buyer Fund Escrow</div>

        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
        <div className="w-[340px] rounded-2xl bg-[#0e0e0e] border border-white/10 p-5 flex gap-4">
          {/* Info Icon */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-[#3D3216] flex items-center justify-center">
              <Image src="/info-svgrepo-com.svg" width={18} height={18} alt="i"/>
            </div>
          </div>

          {/* Text Content */}
          <div className="flex flex-col gap-1">
            <div className="text-[#F8EDC2] font-semibold text-base">
              {mode} Mode Enable
            </div>
            <div className="text-white/80 text-sm leading-relaxed">
              {text}
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-[337px] h-[46px] rounded-xl bg-[#2FE4E4] text-black font-semibold hover:brightness-110 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50 transition-all duration-200 shadow-[0_10px_30px_rgba(47,228,228,0.12)]"
        >
          Continue
        </button>

      </div>
    </div>
  )
}

function SellerEscrowFundedScreen({
  tx,
  shippingDeadline,
  onClose,
  order,
  supabase
}:{
  tx:string
  shippingDeadline:number
  onClose:()=>void
  order: any
  supabase: any
}){

  const [imageUrl,setImageUrl] = React.useState("")

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Seller Fund Escrow</div>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        {/* Success Icon with Glow Effect */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Text & Warning Section */}
        <div className="text-center space-y-5">
          
          {/* Title & Subtitle */}
          <div className="space-y-1.5">
            <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
              Escrow Funded
            </div>
            <div className="text-white/45 text-[14px]">
              Funds are locked on-chain until delivery is confirmed
            </div>
          </div>

          {/* Styled Warning Card */}
          <div className="flex flex-col items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 max-w-[340px] mx-auto">
            <Image 
              src="/warn-triangle-filled-svgrepo-com (1).svg" 
              width={28} 
              height={28} 
              alt="Warn" 
              className="opacity-90"
            />
            
            {order.type === "physical" && (
              <div className="text-orange-400 text-[14px] font-medium leading-snug">
                You have to ship this item before{" "}
                <span className="font-bold text-orange-500">
                  {new Date(shippingDeadline * 1000).toISOString().slice(0, 10)}
                </span>
              </div>
            )}

            {order.type === "digital" && (
              <div className="text-orange-400 text-[14px] font-medium leading-snug">
                You have to ship this item in{" "}
                <span className="font-bold text-orange-500">{order.ship_time_hours} hours</span>
              </div>
            )}

            <div className="text-orange-500/60 text-[12px] font-medium mt-1">
              Although you will lose your bond
            </div>
          </div>
        </div>

        {/* Tx Link (Pill style) */}
        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt="solscan"
            className="opacity-70"
          />
          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Close
        </button>

      </div>
          </div>
  )
}

function BuyerReFundedScreen({
  tx,
  onClose
}:{
  tx:string
  onClose:()=>void
}){

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Refund</div>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Refunded
          </div>
          <div className="text-white/45 text-[14px]">
            Your refund is now live on-chain
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Close
        </button>
      </div>
    </div>
  )
}

function SellerRespondedDisputeScreen({
  tx,
  onClose,
}:{
  tx:string
  onClose:()=>void
}){

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Respond Dispute</div>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        {/* Amber, not green — a dispute being opened is neutral/attention-
            needed, not a celebratory outcome, even though the on-chain
            action itself succeeded. */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#F5A524]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#FFC85C] to-[#F0A020] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(245,165,36,0.4)]">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8v5" stroke="#1A1000" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="16.2" r="1.15" fill="#1A1000" />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Responded Dispute
          </div>
          <div className="text-white/45 text-[14px]">
            Discussion time has started
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Close
        </button>
      </div>
    </div>
  )
}

function SellerCancelledScreen({
  tx,
  onClose
}:{
  tx:string
  onClose:()=>void
}){

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Cancel</div>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            Cancelled
          </div>
          <div className="text-white/45 text-[14px]">
            Your cancellation is now live on-chain
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function SellerMarkShippedScreen({ 
  tx,
  onClose
}:{
  tx:string
  onClose:()=>void
}){

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">Mark as Shipped</div> 
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">  
        {/* Success Icon with Glow Effect */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Text & Warning Section */}
        <div className="text-center space-y-5 w-full">
          
          {/* Title & Subtitle */}
          <div className="space-y-1.5">
            <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
              Marked as Shipped
            </div>
            <div className="text-white/45 text-[14px]">
              Your confirmation in now live on-chain
            </div>
          </div>

          {/* Styled Info/Warning Card */}
          <div className="flex flex-col items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 max-w-[340px] mx-auto">
            <Image 
              src="/warn-triangle-filled-svgrepo-com (1).svg" 
              width={28} 
              height={28} 
              alt="Warn" 
              className="opacity-90"
            />
            
            <div className="text-orange-400 text-[14px] font-medium leading-relaxed">
              The buyer has <span className="font-bold text-orange-500">24 hours</span> to confirm or dispute. If they take no action, you'll be paid automatically.
            </div>
          </div>
        </div>

        {/* Tx Link (Pill style) */}
        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt="solscan"
            className="opacity-70"
          />
          <span className="font-mono">
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full max-w-[320px] h-[46px] rounded-xl bg-[#2FE4E4] text-black font-semibold hover:brightness-110 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50 transition-all duration-200 shadow-[0_10px_30px_rgba(47,228,228,0.12)]"
        >
          Close
        </button>
      </div>
    </div>
  )
}

function FundEscrowConfirm({
  order,
  onBack,
  onFund,
  supabase,
  onClose
}:{
  order: any
  onBack: any
  onFund: any
  supabase: any
  onClose:()=>void
}){

  const bond = order.price_usd * 0.2
  const fee = order.price_usd * 0.01
  const total = order.price_usd + bond + fee

  const [imageUrl, setImageUrl] = React.useState<string>("");


  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Buyer Fund Escrow
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">

        <div className="text-white text-2xl">
          You have to pay
        </div>
        {imageUrl ? (
          <img
            src={imageUrl}
            className="w-[140px] h-[140px] rounded-xl object-cover"
          />
        ) : (
          <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
        )}
        {/* card */}
        <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">

          <div className="flex justify-between text-white/70 text-[15px]">
            <span>Item’s Price:</span>
            <span className='text-[11px] mt-1'>
              {(order.price_usd / solPrice).toFixed(5)} SOL
            </span>
            <span>${order.price_usd}</span>
          </div>

          <div className="flex justify-between text-white/70 text-[15px]">
            <span>Bond (20%):</span>
            <span className='text-[11px] mt-1'>
              {(bond / solPrice).toFixed(5)} SOL
            </span>
            <span>${bond}</span>
          </div>

          <div className="flex justify-between text-white/70 text-[15px]">
            <span>Fee (%1):</span>
            <span className='text-[11px] mt-1'>
              {(fee / solPrice).toFixed(5)} SOL
            </span>
            <span>${fee}</span>
          </div>

          <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
            <span>Total</span>
            <span className='text-[14px] mt-1'>
              {(total / solPrice).toFixed(5)} SOL
            </span>
            <span>${total}</span>
          </div>

        </div>

        <AsyncButton
          onClick={onFund}
          className="h-[46px] rounded-[10px] font-semibold w-full max-w-[320px] bg-[#26D9D9] text-black hover:opacity-90 transition"
        >
          Fund Escrow
        </AsyncButton>

      </div>
    </div>
  )
}

function BuyNftConfirm({
  order,
  onBack,
  onBuy,
  supabase,
  onClose
}:{
  order: any
  onBack: any
  onBuy: any
  supabase: any
  onClose:()=>void
}){

  // NFT purchases are a direct swap — no bond, no buyer-side fee. The
  // buyer pays exactly the listed price.
  const fee = order.price_usd * 0.01
  const total = order.price_usd + fee

  const [imageUrl, setImageUrl] = React.useState<string>("");


  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Buy NFT
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">

        <div className="text-white text-2xl">
          You have to pay
        </div>
        {imageUrl ? (
          <img
            src={imageUrl}
            className="w-[140px] h-[140px] rounded-xl object-cover"
          />
        ) : (
          <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
        )}
        {/* card */}
        <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">

          <div className="flex justify-between text-white/70 text-[15px]">
            <span>Item’s Price:</span>
            <span className='text-[11px] mt-1'>
              {(order.price_usd / solPrice).toFixed(5)} SOL
            </span>
            <span>${order.price_usd}</span>
          </div>

          <div className="flex justify-between text-white/70 text-[15px]">
            <span>Fee (%1):</span>
            <span className='text-[11px] mt-1'>
              {(fee / solPrice).toFixed(5)} SOL
            </span>
            <span>${fee}</span>
          </div>

          <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
            <span>Total</span>
            <span className='text-[14px] mt-1'>
              {(total / solPrice).toFixed(5)} SOL
            </span>
            <span>${total}</span>
          </div>

        </div>

        <AsyncButton
          onClick={onBuy}
          className="h-[46px] rounded-[10px] font-semibold w-full max-w-[320px] bg-[#26D9D9] text-black hover:opacity-90 transition"
        >
          Buy NFT
        </AsyncButton>

      </div>
    </div>
  )
}

function NftBoughtScreen({
  tx,
  onClose,
}: {
  tx: string
  onClose: () => void
}) {
  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="text-white text-[18px] font-medium">
          Buy NFT
        </div>

        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6 py-10">

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#3DDC84]/20 blur-2xl scale-125" aria-hidden="true" />
          <div className="relative size-[clamp(4.5rem,18vw,5.5rem)] rounded-full bg-gradient-to-b from-[#4EEB92] to-[#2FC46E] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_16px_32px_-8px_rgba(61,220,132,0.4)]">
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 13l4 4L19 7"
                stroke="#04120F"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="text-center space-y-1.5">
          <div className="text-white text-[clamp(1.375rem,4vw,1.75rem)] font-semibold tracking-[-0.02em]">
            NFT purchased
          </div>
          <div className="text-white/45 text-[14px]">
            Ownership has been transferred on-chain
          </div>
        </div>

        <a
          href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/60 text-[13px] hover:text-white/90 hover:border-white/[0.14] hover:bg-white/[0.06] transition-all duration-200"
        >
          <Image
            src="/share-2-svgrepo-com (1).svg"
            width={14}
            height={14}
            alt=""
            className="opacity-70"
          />

          <span className='font-mono tabular-nums tracking-[-0.01em]'>
            {tx.slice(0, 6)}...{tx.slice(-4)}
          </span>
        </a>

        <button
          onClick={onClose}
          className={`w-full max-w-[320px] ${UI.primaryButton}`}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function SellerFundEscrowConfirm({
  order,
  onBack,
  onFund,
  supabase,
  onClose
}:{
  order: any
  onBack: any
  onFund: any
  supabase: any
  onClose:()=>void
}){

  const price = order.price_usd
  const bond = order.dispute_mode === "STR"
    ? price * 1.2
    : price * 0.2
  const fee = order.price_usd * 0.01
  const total = bond + fee

  const [imageUrl, setImageUrl] = React.useState<string>("");


  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  return (
    <div className="h-full flex flex-col">

      {/* top bar */}
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Seller Fund Escrow
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">

        <div className="text-white text-2xl">
          You have to pay
        </div>
        {imageUrl ? (
          <img
            src={imageUrl}
            className="w-[140px] h-[140px] rounded-xl object-cover"
          />
        ) : (
          <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
        )}
        {/* card */}
        <div className="w-full max-w-[300px] border-t border-white/10 pt-4 space-y-3">
          {order.dispute_mode === "BTR" && (
            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond (20%):</span>
              <span className='text-[11px] mt-1'>
                {(bond / solPrice).toFixed(5)} SOL
              </span>
              <span>${bond}</span>
            </div>
          )}

          {order.dispute_mode === "STR" && (
            <div className="flex justify-between text-white/70 text-[15px]">
              <span>Bond (120%):</span>
              <span className='text-[11px] mt-1'>
                {(bond / solPrice).toFixed(5)} SOL
              </span>
              <span>${bond}</span>
            </div>
          )}

          <div className="flex justify-between text-white/70 text-[15px]">
            <span>Fee (%1):</span>
            <span className='text-[11px] mt-1'>
              {(fee / solPrice).toFixed(5)} SOL
            </span>
            <span>${fee}</span>
          </div>

          <div className="border-t border-white/10 pt-3 mt-3 flex justify-between text-white text-[18px] font-semibold">
            <span>Total</span>
            <span className='text-[14px] mt-1'>
              {(total / solPrice).toFixed(5)} SOL
            </span>
            <span>${total}</span>
          </div>

        </div>

        <AsyncButton
          onClick={onFund}
          className="h-[46px] rounded-[10px] font-semibold w-full max-w-[320px] bg-[#26D9D9] text-black hover:opacity-90 transition"
        >
          Fund Escrow
        </AsyncButton>

      </div>
    </div>
  )
}

function BuyerConfirmedMessage({
  order,
}:{
  order:any
}){

  return (
    <div className="w-full max-w-[680px]">

      <div className="w-full max-w-[400px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[18px] mb-2">
          {order.buyer_name} has confirmed the escrow “{order.order_name}”
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-sm mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done
        </div>

        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-sm">
            Seller got paid and Buyer got all bonds money back
          </div>

        </div>

        <div>
        </div>
      </div>

    </div>
  )
}

function PaidSellerMessage({
  order,
}:{
  order:any
}){

  return (
    <div className="w-full max-w-[680px]">

      <div className="w-full max-w-[400px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          {order.buyer_name} has paid seller for the order “{order.order_name}”
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done
        </div>

        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            Seller got paid and Buyer got all bonds money back
          </div>

        </div>

        <div>
        </div>
      </div>

    </div>
  )
}

function SellerRefundedMessage({
  order,
}:{
  order:any
}){

  return (
    <div className="w-full max-w-[680px]">

      <div className="w-full max-w-[400px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          {order.seller_name} refunded the order “{order.order_name}”
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done.
        </div>

        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            Everyone got all their money back
          </div>

        </div>

        <div>
        </div>
      </div>

    </div>
  )
}

function ShippingTimeoutMessage({
  order,
}:{
  order:any
}){

  return (
    <div className="w-full max-w-[445px]">

      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          Shipping time has expired.
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done.
        </div>
    
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            {order.seller_name} lost 20% of the item's price. Half went to {order.buyer} and the other half was burned.
          </div>
        </div>
      </div>

    </div>
  )
}

function ConfirmTimeoutMessage({
  order,
}:{
  order:any
}){

  return (
    <div className="w-full max-w-[445px]">

      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          Confirm time has expired.
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px]mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done.
        </div>
    
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            {order.seller_name} has been paid and has received all bond money back, and {order.buyer_name} has received all of their bond money back.
          </div>
        </div>
      </div>

    </div>
  )
}

function DiscussTimeoutMessage({
  order,
}:{
  order:any
}){

  return (
    <div className="w-full max-w-[445px]">

      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          Discuss time has expired.
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done.
        </div>
    
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            Everyone lost all their money.
          </div>
        </div>
      </div>

    </div>
  )
}

function RespondTimeoutMessage({
  order,
}:{
  order:any
}){
  return (
    <div className="w-full max-w-[445px]">

      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          Respond time has expired. {order.buyer_name} won this dispute
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done.
        </div>
    
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            {order.seller_name} loses 20% of the item's price; half of that goes to {order.buyer_name}, and the other half is burned. {order.buyer_name} receives a full refund.
          </div>
        </div>
      </div>

    </div>
  )
}

function EscrowUpdateMessage({
  order,
  viewerId,
  onFundEscrow,
  onRefund
}:{
  order:any
  viewerId:string | null
  onFundEscrow?: (order:any) => void
  onRefund?: (order:any)=>void
}){

  const isBuyer = order?.buyer_id === viewerId
  const isSeller = order?.seller_id === viewerId

  return (
    <div className="w-full max-w-[680px]">

      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-[14px] font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          {order.buyer_name} has funded the escrow for “{order.order_name}”
        </div>

        <div className="flex items-center gap-2 text-[#F4B400] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#F4B400]"></span>
          Waiting for {order.seller_name} to fund and continue...
        </div>
    
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
        {isBuyer && (  
          <div className="text-white/50 text-[12px] md:text-[14px]">
            You can get funded money back
          </div>
          )}
          {isBuyer && (  
            <button onClick={() => onRefund?.(order)} className="px-4 py-1 rounded-full bg-white text-black md:text-[16px] text-[14px] font-medium">
              Refund
            </button>
          )}

        {isSeller && (  
          <div className="text-white/50 text-[12px] md:text-[14px]">
            Click here to
          </div>
          )}
          {isSeller && (  
            <button 
              onClick={() => onFundEscrow?.(order)}
              className="px-4 py-1 rounded-full bg-white text-black md:text-[16px] text-[14px] font-medium">
              Fund Escrow
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

function BuyerRefundedMessage({
  order,
}:{
  order:any
}){
  return (
    <div className="w-full max-w-[680px]">

      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          {order.buyer_name} has cancel the order “{order.order_name}”
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done
        </div>
    
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            Everyone got all their money back
          </div>

        </div>
      </div>

    </div>
  )
}

function SellerCancelledMessage({
  order,
}:{
  order:any
}){
  return (
    <div className="w-full max-w-[680px]">

      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        <div className="flex items-center justify-between mb-2">

          <div className="flex items-center gap-2 text-[#26D9D9] text-sm font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>

          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([],{
              hour:'2-digit',
              minute:'2-digit'
            })}
          </div>

        </div>

        <div className="text-white text-[16px] md:text-[18px] mb-2">
          {order.seller_name} has cancel the order “{order.order_name}”
        </div>

        <div className="flex items-center gap-2 text-[#50D926] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#50D926]"></span>
          Deal done
        </div>
    
        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          <div className="text-white/50 text-[12px] md:text-[14px]">
            Everyone got all their money back
          </div>

        </div>
      </div>

    </div>
  )
}

function makeConversationId(a: string, b: string) {
  return [a, b].sort().join('__');
}

function pickDisplayName(user: any) {
  const d = user?.user_metadata?.display_name;
  if (typeof d === 'string' && d.trim()) return d.trim();

  const g =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.preferred_username;

  if (typeof g === 'string' && g.trim()) return g.trim();

  const email = user?.email;
  if (typeof email === 'string' && email.includes('@')) return email.split('@')[0];

  return 'User';
}

function formatBadge(n: number) {
  if (n <= 0) return '';
  return n > 9 ? '+9' : String(n);
}

function pickAvatarUrl(user: any) {
  const um = user?.user_metadata;

  const direct =
    um?.avatar_url ||
    um?.picture ||
    um?.avatar ||
    um?.photo_url;

  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const id0 = Array.isArray(user?.identities) ? user.identities[0] : null;
  const idData = id0?.identity_data;

  const fromIdentity =
    idData?.avatar_url ||
    idData?.picture ||
    idData?.photo_url;

  if (typeof fromIdentity === 'string' && fromIdentity.trim()) return fromIdentity.trim();

  return '/cat.png';
}

type ContactListItem = {
  id: string;
  username: string;
  avatar: string;
  subtitle?: string;
  lastAt?: string;
  lastSenderId?: string;
  lastReadAt?: string | null; 
  unreadCount?: number;
};

type DbMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  /** id of the message this one replies to (decoded from the body prefix) */
  reply_to_id?: string | null;
};

function isImagePathMessage(body: string) {
  return typeof body === 'string' && body.startsWith('imgpath:');
}

function isEscrowMessage(body: string) {
  return typeof body === 'string' && body.startsWith('escrow:');
}

function isVoiceMessage(body: string) {
  return typeof body === 'string' && body.startsWith('voice:');
}

function parseVoiceBody(body: string) {
  const rest = body.slice('voice:'.length);
  const [path, durationStr, levelsStr] = rest.split(':');
  const duration = Number(durationStr) || 0;
  const levels = (levelsStr || '')
    .split(',')
    .map((n) => Number(n))
    .filter((n) => !Number.isNaN(n));
  return { path, duration, levels };
}

function formatVoiceDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

// ---------- Reply-to-message encoding ----------
//
// Replies are stored inside the existing `body` column as a prefix
// (`reply:<messageId>|<original body>`), so no DB migration is needed.
// `normalizeDbMessage` strips the prefix once when a row is loaded, so the
// rest of the UI keeps working with the plain body (`imgpath:`, `voice:` ...)
// plus a separate `reply_to_id`.
const REPLY_BODY_RE = /^reply:([^|\s]{1,64})\|/;

function encodeReplyBody(replyToId: string | null | undefined, body: string) {
  return replyToId ? `reply:${replyToId}|${body}` : body;
}

function parseReplyBody(body: string): { replyToId: string | null; body: string } {
  const match = typeof body === 'string' ? body.match(REPLY_BODY_RE) : null;
  if (!match) return { replyToId: null, body };
  return { replyToId: match[1], body: body.slice(match[0].length) };
}

function normalizeDbMessage(row: any): DbMessage {
  const { replyToId, body } = parseReplyBody(row?.body ?? '');
  return { ...row, body, reply_to_id: replyToId } as DbMessage;
}

type ReplyKind = 'text' | 'image' | 'voice' | 'escrow' | 'update' | 'missing';
type ReplySnippet = { kind: ReplyKind; text: string };

function ReplyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 6 6v3" />
    </svg>
  );
}

function ReplyKindIcon({ kind }: { kind: ReplyKind }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'shrink-0' };
  if (kind === 'image') {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="9" cy="9" r="1.6" />
        <path d="m21 15-4.5-4.5L6 21" />
      </svg>
    );
  }
  if (kind === 'voice') {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
      </svg>
    );
  }
  if (kind === 'escrow' || kind === 'update') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />
      </svg>
    );
  }
  return null;
}

// The quoted block shown above a message that is a reply.
function ReplyQuote({
  author,
  kind,
  text,
  alignRight,
  onClick,
}: {
  author: string;
  kind: ReplyKind;
  text: string;
  alignRight: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={[
        'mb-1 flex w-full max-w-[280px] items-stretch gap-2 rounded-xl bg-white/[0.07] px-3 py-1.5 text-left transition',
        alignRight ? 'ml-auto' : '',
        onClick ? 'hover:bg-white/[0.11] active:scale-[0.99]' : 'cursor-default',
      ].join(' ')}
    >
      <span className="w-[3px] shrink-0 rounded-full bg-[#26D9D9]" />
      <span className="min-w-0 flex-1">
        {author && <span className="block truncate text-[12.5px] font-medium text-[#26D9D9]">{author}</span>}
        <span className={`flex items-center gap-1.5 text-[13px] ${kind === 'missing' ? 'italic text-white/35' : 'text-white/60'}`}>
          <ReplyKindIcon kind={kind} />
          <span className="truncate">{text}</span>
        </span>
      </span>
    </button>
  );
}

// Lets the user drag a message to the right (touch devices) to reply to it.
function SwipeToReply({
  enabled,
  onReply,
  children,
}: {
  enabled: boolean;
  onReply: () => void;
  children: React.ReactNode;
}) {
  const x = useMotionValue(0);
  const iconOpacity = useTransform(x, [0, 24, 56], [0, 0.5, 1]);
  const iconScale = useTransform(x, [0, 56], [0.6, 1]);

  // The wrapper is always rendered (drag is just switched off on desktop) so
  // children are never remounted when `enabled` flips after first render.
  return (
    <div className="relative">
      {enabled && (
        <motion.div
          style={{ opacity: iconOpacity, scale: iconScale }}
          className="pointer-events-none absolute left-0 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white/80"
        >
          <ReplyIcon size={16} />
        </motion.div>
      )}
      <motion.div
        style={{ x }}
        drag={enabled ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.35 }}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (enabled && info.offset.x > 56) {
            try { navigator.vibrate?.(10); } catch {}
            onReply();
          }
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ---------- Escrow update lines (short text + "?" details) ----------

type EscrowUpdateInfo = {
  text: string;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  what: string;
  next: string;
  deadline?: string;
};

function fmtUnixDeadline(sec: any) {
  const n = Number(sec);
  if (!n || Number.isNaN(n)) return undefined;
  return new Date(n * 1000).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function capFirst(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// One place that defines the short text + the "?" details for every escrow
// update. Edit the copy here.
function getEscrowUpdateInfo(action: string, order: any, viewerId: string | null): EscrowUpdateInfo {
  const buyer = order?.buyer_name || 'the buyer';
  const seller = order?.seller_name || 'the seller';
  const item = order?.order_name ? `“${order.order_name}”` : 'this order';
  const isBuyer = !!order && order.buyer_id === viewerId;
  const isSeller = !!order && order.seller_id === viewerId;
  const digital = order?.type === 'digital';
  const DAY = 24 * 3600;
  const plusDay = (t: any) => {
    const n = Number(t);
    return n && !Number.isNaN(n) ? fmtUnixDeadline(n + DAY) : undefined;
  };
  const byRole = (b: string, s: string, other: string) => (isBuyer ? b : isSeller ? s : other);

  switch (action) {
    case 'buyer_funded':
      return {
        text: 'Escrow funded',
        tone: 'warn',
        what: capFirst(`${buyer} funded the escrow for ${item}.`),
        next: byRole(
          `Waiting for ${seller} to fund. You can refund from the escrow card while you wait.`,
          'Fund the escrow from the escrow card to continue the deal.',
          `Waiting for ${seller} to fund.`
        ),
      };

    case 'seller_funded':
      return {
        text: 'Seller funded',
        tone: 'warn',
        what: capFirst(`${seller} funded the escrow for ${item} and now has to deliver it.`),
        next: byRole(
          digital
            ? `Waiting for ${seller} to upload the file. Once it is uploaded you can download it from the escrow card.`
            : `Waiting for ${seller} to ship the item. If they miss the deadline they lose their bond to you.`,
          digital
            ? `Upload the file from the escrow card before the deadline, or cancel. If you miss it you lose your bond to ${buyer}.`
            : `Ship the item and press “Mark as Shipped” on the escrow card before the deadline, or cancel. If you miss it you lose your bond to ${buyer}.`,
          `Waiting for ${seller} to deliver.`
        ),
        deadline: fmtUnixDeadline(order?.shipping_deadline),
      };

    case 'seller_shipped':
      return {
        text: digital ? 'File uploaded' : 'Marked as shipped',
        tone: 'warn',
        what: capFirst(
          digital
            ? `${seller} delivered the file for ${item}.`
            : `${seller} marked ${item} as shipped.`
        ),
        next: byRole(
          digital
            ? 'Download and review the file from the escrow card. If you do nothing, the seller is paid automatically when the timer ends.'
            : 'Review the item from the escrow card. If you do nothing, the seller is paid automatically when the timer ends.',
          `Waiting for ${buyer} to review. You get paid automatically if they do nothing before the timer ends.`,
          `Waiting for ${buyer} to review the item.`
        ),
        deadline: plusDay(order?.shipped_at_unix),
      };

    case 'buyer_confirmed':
      return {
        text: 'Buyer confirmed',
        tone: 'ok',
        what: capFirst(`${buyer} confirmed ${item}.`),
        next: 'Deal done. The seller got paid and the buyer got all bond money back.',
      };

    case 'seller_paid':
      return {
        text: 'Seller paid',
        tone: 'ok',
        what: capFirst(`${buyer} paid the seller for ${item}.`),
        next: 'Deal done. The seller got paid and the buyer got all bond money back.',
      };

    case 'seller_refunded':
      return {
        text: 'Seller refunded',
        tone: 'neutral',
        what: capFirst(`${seller} refunded ${item}.`),
        next: 'Deal done. Nothing more to do.',
      };

    case 'buyer_cancelled':
      return {
        text: 'Buyer cancelled',
        tone: 'neutral',
        what: capFirst(`${buyer} cancelled ${item}.`),
        next: 'Deal done. Nothing more to do.',
      };

    case 'seller_cancelled':
      return {
        text: 'Seller cancelled',
        tone: 'neutral',
        what: capFirst(`${seller} cancelled ${item}.`),
        next: 'Deal done. Nothing more to do.',
      };

    case 'dispute_opened':
      return {
        text: 'Dispute opened',
        tone: 'bad',
        what: capFirst(`${buyer} opened a dispute on ${item}.`),
        next: byRole(
          `Waiting for ${seller} to respond or refund. If they don't answer in time, you win the dispute.`,
          `Respond or refund the buyer from the escrow card before the timer ends. If you don't, ${buyer} wins and you lose your bond to them.`,
          `Waiting for ${seller} to respond or refund.`
        ),
        deadline: plusDay(order?.dispute_opened_at_unix),
      };

    case 'seller_responded_dispute':
      return {
        text: 'Dispute responded',
        tone: 'warn',
        what: capFirst(`${seller} responded to the dispute on ${item}. Discuss time has started.`),
        next: byRole(
          'Talk it out with the seller. You can pay the seller from the escrow card. If time runs out, the dispute ends in a draw and everyone loses all their money.',
          'Talk it out with the buyer, or refund the buyer from the escrow card. If time runs out, the dispute ends in a draw and everyone loses all their money.',
          'The buyer and seller are discussing. If time runs out, the dispute ends in a draw.'
        ),
        deadline: plusDay(order?.seller_responded_at_unix),
      };

    case 'shipping_timeout':
      return {
        text: 'Shipping time expired',
        tone: 'bad',
        what: capFirst(`${seller} did not ship ${item} in time.`),
        next: `Deal done. ${capFirst(seller)} lost 20% of the item's price. Half went to ${buyer} and the other half was burned.`,
      };

    case 'confirm_timeout':
      return {
        text: 'Confirm time expired',
        tone: 'ok',
        what: capFirst(`${buyer} did not confirm ${item} in time, so the deal was completed automatically.`),
        next: `Deal done. ${capFirst(seller)} was paid and got all bond money back, and ${buyer} got all their bond money back.`,
      };

    case 'respond_timeout':
      return {
        text: 'Respond time expired',
        tone: 'bad',
        what: capFirst(`${seller} did not respond to the dispute on ${item} in time, so ${buyer} won.`),
        next: `Deal done. ${capFirst(seller)} loses 20% of the item's price. Half goes to ${buyer} and the other half is burned. ${capFirst(buyer)} receives a full refund.`,
      };

    case 'draw':
      return {
        text: 'Discuss time expired',
        tone: 'bad',
        what: capFirst(`Discuss time ran out without an agreement on ${item}.`),
        next: 'Deal done. The dispute ended in a draw and everyone lost all their money.',
      };

    default:
      return {
        text: 'Escrow updated',
        tone: 'neutral',
        what: capFirst(`There was an update on ${item}.`),
        next: 'Open the escrow card to see its current status.',
      };
  }
}

const ESCROW_TONE_DOT: Record<EscrowUpdateInfo['tone'], string> = {
  ok: 'bg-[#50D926]',
  warn: 'bg-[#F4B400]',
  bad: 'bg-[#FF3B30]',
  neutral: 'bg-[#26D9D9]',
};

function EscrowUpdateLine({
  action,
  order,
  viewerId,
  createdAt,
  onReply,
  onGoToEscrow,
}: {
  action: string;
  order: any;
  viewerId: string | null;
  createdAt: string;
  onReply?: () => void;
  onGoToEscrow?: () => void;
}) {
  const info = getEscrowUpdateInfo(action, order, viewerId);
  const tipId = React.useId();
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const tipRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimer = React.useRef<number | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = React.useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }, [cancelClose]);

  const openTip = React.useCallback(() => {
    cancelClose();
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - r.bottom;
    if (spaceBelow < 280 && r.top > spaceBelow) {
      setPos({ left, width, bottom: window.innerHeight - r.top + 8 });
    } else {
      setPos({ left, width, top: r.bottom + 8 });
    }
    setOpen(true);
  }, [cancelClose]);

  React.useEffect(() => {
    if (!open) return;

    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || tipRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => setOpen(false);

    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  React.useEffect(() => cancelClose, [cancelClose]);

  const timeText = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const orderName = order?.order_name as string | undefined;

  return (
    <>
      <div className="relative inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[13px] text-white/80 md:text-[14px]">
        <span className={`h-2 w-2 shrink-0 rounded-full ${ESCROW_TONE_DOT[info.tone]}`} />
        <span className="truncate font-medium">{info.text}</span>
        <span className="shrink-0 text-[12px] tabular-nums text-white/35">{timeText}</span>

        <button
          ref={btnRef}
          type="button"
          aria-label={`What does “${info.text}” mean?`}
          aria-describedby={open ? tipId : undefined}
          aria-expanded={open}
          onMouseEnter={openTip}
          onMouseLeave={scheduleClose}
          onFocus={openTip}
          onBlur={scheduleClose}
          onClick={(e) => {
            const isTouch = (e.nativeEvent as PointerEvent).pointerType === 'touch';
            if (open && isTouch) setOpen(false);
            else openTip();
          }}
          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-white/25 text-[11px] font-semibold leading-none text-white/60 transition hover:border-[#26D9D9] hover:text-[#26D9D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
        >
          ?
        </button>

        {onReply && (
          <button
            type="button"
            onClick={onReply}
            title="Reply"
            aria-label="Reply to this update"
            className="absolute left-full top-1/2 ml-2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/[0.08] text-white/70 opacity-0 transition hover:bg-white/15 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 md:grid"
          >
            <ReplyIcon size={16} />
          </button>
        )}
      </div>

      {open && pos && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
            className="z-[90] rounded-2xl border border-white/10 bg-[#0E0E0E]/95 p-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#26D9D9]">
              <span className={`h-2 w-2 rounded-full ${ESCROW_TONE_DOT[info.tone]}`} />
              Escrow update
            </div>
            <div className="mt-1.5 text-[16px] font-medium text-white">{info.text}</div>
            {orderName && <div className="truncate text-[13px] text-white/45">“{orderName}”</div>}

            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">What happened</div>
            <div className="mt-0.5 text-[14px] leading-snug text-white/85">{info.what}</div>

            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">What&apos;s next</div>
            <div className="mt-0.5 text-[14px] leading-snug text-white/85">{info.next}</div>

            {info.deadline && (
              <div className="mt-3 text-[12.5px] text-[#F4B400]">Deadline: {info.deadline}</div>
            )}

            {onGoToEscrow && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onGoToEscrow();
                }}
                className="mt-3 rounded-full bg-white px-4 py-1 text-[13px] font-medium text-black transition hover:opacity-90"
              >
                View escrow
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

function lastPreviewText(rawBody: string, isMine: boolean) {
  const { body } = parseReplyBody(rawBody);
  if (isImagePathMessage(body)) {
    return `${isMine ? 'You: ' : ''}Sent an Image`;
  }
  if (isVoiceMessage(body)) {
    return `${isMine ? 'You: ' : ''}Sent a Voice Message`;
  }
  return `${isMine ? 'You: ' : ''}${body}`;
}

async function compressImage(file: File, maxW = 1280, quality = 0.75): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas context');
  ctx.drawImage(bmp, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality
    );
  });

  return blob;
}

function useCountdown(deadlineSeconds: number) {
  const [remaining, setRemaining] = React.useState(
    Math.max(0, deadlineSeconds - Math.floor(Date.now() / 1000))
  );

  React.useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, deadlineSeconds - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [deadlineSeconds]);

  return remaining;
}

function formatCountdown(seconds: number) {
  if (seconds > 86400) {
    const days = Math.ceil(seconds / 86400);
    return `${days} Day${days !== 1 ? 's' : ''}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function SellerShippingMessage({
  order,
  viewerId,
  onMarkShipped,
  onCancel,
  onUploadFile
}: {
  order: any;
  viewerId: string | null;
  onMarkShipped?: (order: any) => void;
  onCancel?: (order: any) => void;
  onUploadFile?: (order: any) => void;
}) {
  const isSeller = order?.seller_id === viewerId;
  const isBuyer  = order?.buyer_id  === viewerId;

  const shippingHours = React.useMemo(() => {
    if (order?.type === 'physical' && order?.ship_date) {
      const deadline = new Date(order.ship_date)
      deadline.setHours(23, 59, 59, 999)
      const fundedAt = order?.seller_funded_at_unix
        ? new Date(order.seller_funded_at_unix * 1000)
        : new Date()
      const diffMs = deadline.getTime() - fundedAt.getTime()
      return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)))
    }
    return Number(order?.ship_time_hours ?? 0)
  }, [order])

  const deadlineSec: number = React.useMemo(() => {
    if (order?.shipping_deadline) return order.shipping_deadline
    if (shippingHours > 0) {
      const fundedAt = order?.seller_funded_at_unix ?? Math.floor(Date.now() / 1000)
      return fundedAt + shippingHours * 3600
    }
    return 0
  }, [order, shippingHours])

  const totalSec = shippingHours * 3600

  const remaining = useCountdown(deadlineSec);

  const progress = totalSec > 0 ? Math.max(0, remaining / totalSec) : 0;

  // SVG ring params
  const R = 70;
  const C = 2 * Math.PI * R;   // circumference
  const dash = progress * C;    // filled arc length
  const gap  = C - dash;

  const deadlineStr = deadlineSec
    ? new Date(deadlineSec * 1000).toISOString().slice(0, 10)
    : '';

  return (
    <div className="w-full max-w-[480px]">
      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        {/* header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[#26D9D9] text-[14px] font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>
          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* title */}
        <div className="text-white text-[16px] md:text-[18px] mb-1">
          {order.seller_name} has funded the escrow for &ldquo;{order.order_name}&rdquo;
        </div>

        {/* status pill */}
        <div className="flex items-center gap-2 text-[#F4B400] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#F4B400]"></span>
          {order.seller_name} is now shipping the item...
        </div>

        {/* ring */}
        <div className="flex flex-col items-center gap-3 py-4">
          <svg width="180" height="180" viewBox="0 0 180 180">
            {/* track */}
            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#333"
              strokeWidth="5"
            />

            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#26D9D9"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={C / 4}
              transform="rotate(-90 90 90)"
            />
            <text
              x="90" y="95"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="22"
              fontWeight="500"
            >
              {formatCountdown(remaining)}
            </text>
          </svg>

          {deadlineStr && isSeller && order.type === "physical" && (
            <div>
              <p className="text-[#ff6b35] text-[12px] md:text-[14px] font-semibold text-center">
                You have to ship this item before the timer ends
              </p>

              <p className="mt-2 text-white/40 text-xs text-center">
                Although you will lose your bond to {order.buyer_name}
              </p>
            </div>
          )}

          {deadlineStr && isSeller && order.type === "digital" && (
            <div>
              <p className="text-[#ff6b35] text-[12px] md:text-[14px] font-semibold text-center">
                You have to ship this item by upload file before the timer ends
              </p>

              <p className="mt-2 text-white/40 text-xs text-center">
                Although you will lose your bond to {order.buyer_name}
              </p>
            </div>
          )}

          {deadlineStr && isBuyer && order.type === "physical" && (
            <div>
              <p className="text-[#ff6b35] text-[12px] md:text-[14px] font-semibold text-center">
                {order.seller_name} have to ship this item before the timer ends.
              </p>

              <p className="mt-2 text-white/40 text-xs text-center">
                Although {order.seller_name} will lose their bond to you
              </p>
            </div>
          )}

          {deadlineStr && isBuyer && order.type === "digital" && (
            <div>
              <p className="text-[#ff6b35] text-[12px] md:text-[14px] font-semibold text-center">
                {order.seller_name} must upload the item's file before the timer ends. After {order.seller_name} uploads it, you can download the file.
              </p>

              <p className="mt-2 text-white/40 text-xs text-center">
                Although {order.seller_name} will lose their bond to you
              </p>
            </div>
          )}

        </div>

        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          {isSeller && order.type === "physical" && (
            <>
              <div className="flex flex-1 gap-5 justify-center items-center">
                <button
                  onClick={() => onMarkShipped?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
                >
                  <Image src="/check-svgrepo-com.svg" width={18} height={18} alt="check"/>
                  Mark as Shipped
                </button>

                <button
                  onClick={() => onCancel?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-[#510000] text-[#FF0000] font-medium"
                >
                  <Image src="/cancel-red-svgrepo-com.svg" width={12} height={12} alt="cancel"/>
                  Cancel
                </button>
              </div>
            </>
          )}
          {isSeller && order.type === "digital" && (
            <>
              <div className="flex flex-1 gap-5 justify-center items-center">
                <button
                  onClick={() => onUploadFile?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
                >
                  <Image src="/upload-svgrepo-com (1).svg" width={16} height={16} alt="upload"/>
                  Upload file
                </button>

                <button
                  onClick={() => onCancel?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-[#510000] text-[#FF0000] font-medium"
                >
                  <Image src="/cancel-red-svgrepo-com.svg" width={12} height={12} alt="cancel"/>
                  Cancel
                </button>
              </div>
            </>
          )}
          {isBuyer && (
            <div className="text-white/50 text-sm w-full text-center">
              Waiting for seller to ship...
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function SellerMarkShippedMessage({
  order,
  viewerId,
  onReview,
  onDownload
}: {
  order: any;
  viewerId: string | null;
  onReview?: (order:any)=>void
  onDownload?: (order:any)=>void;
}) {
  const isSeller = order?.seller_id === viewerId;
  const isBuyer  = order?.buyer_id  === viewerId;

  const CONFIRM_SECONDS = 24 * 3600

  const deadlineSec = React.useMemo(() => {

    if(order?.shipped_at_unix){
      const shipped = Number(order.shipped_at_unix)

      if(Number.isNaN(shipped)) return 0

      return shipped + CONFIRM_SECONDS
    }

    return 0

  },[order])

  const totalSec = CONFIRM_SECONDS

  const remaining = useCountdown(deadlineSec);

  const progress = totalSec > 0 ? Math.max(0, remaining / totalSec) : 0;

  // SVG ring params
  const R = 70;
  const C = 2 * Math.PI * R;   // circumference
  const dash = progress * C;    // filled arc length
  const gap  = C - dash;

  let deadlineStr = ""

  if (deadlineSec && !Number.isNaN(deadlineSec)) {
    deadlineStr = new Date(deadlineSec * 1000)
      .toISOString()
      .slice(0, 10)
  }

  return (
    <div className="w-full max-w-[680px]">
      <div className="w-full max-w-[680px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        {/* header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[#26D9D9] text-[14px] font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>
          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* title */}
        <div className="text-white text-[16px] md:text-[18px] mb-1">
          {order.seller_name} has mark as shipped for &ldquo;{order.order_name}&rdquo;
        </div>

        {/* status pill */}
        <div className="flex items-center gap-2 text-[#F4B400] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#F4B400]"></span>
          {order.buyer_name} have to review the item in time...
        </div>

        {/* ring */}
        <div className="flex flex-col items-center gap-3 py-4">
          <svg width="180" height="180" viewBox="0 0 180 180">
            {/* track */}
            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#333"
              strokeWidth="5"
            />

            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#26D9D9"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={C / 4}
              transform="rotate(-90 90 90)"
            />
            <text
              x="90" y="95"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="22"
              fontWeight="500"
            >
              {formatCountdown(remaining)}
            </text>
          </svg>

          {deadlineStr && (
            <div>
              <p className="text-[#ff6b35] text-[12px] md:text-[14px] font-semibold text-center">
                Once the timer ends {order.seller_name} will be automaticlly get paid
              </p>

            </div>
          )}

        </div>

        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          {isBuyer && order.type === "physical" &&(
            <>
              <div className="flex flex-1 justify-center items-center">
                <button
                  onClick={() => onReview?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
                >
                  <Image src="/eye-show-svgrepo-com.svg" width={22} height={22} alt="review"/>
                  Review
                </button>
              </div>
            </>
          )}
          {isBuyer && order.type === "digital" &&(
            <>
              <div className="flex flex-1 justify-center items-center gap-5">
                <button
                  onClick={() => onDownload?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
                >
                  <Image src="/download-svgrepo-com.svg" width={20} height={20} alt="download" className='mb-0.5'/>
                  Download
                </button>

                <button
                  onClick={() => onReview?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
                >
                  <Image src="/eye-show-svgrepo-com.svg" width={22} height={22} alt="review"/>
                  Review
                </button>
              </div>
            </>
          )}
          {isSeller && (
            <div className="text-white/50 text-sm w-full text-center">
              Waiting for buyer action...
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function DiscussTimeMessage({
  order,
  viewerId,
  onRefundDiscuss,
  onPaySeller
}: {
  order: any;
  viewerId: string | null;
  onRefundDiscuss?: (order:any)=>void
  onPaySeller?: (order:any)=>void
}) {
  if(!order) return null

  const isSeller = order?.seller_id === viewerId;
  const isBuyer  = order?.buyer_id  === viewerId;

  const CONFIRM_SECONDS = 24 * 3600

  const deadlineSec = React.useMemo(() => {
    if (order?.seller_responded_at_unix) {
      const respondedAt = Number(order.seller_responded_at_unix)

      if (Number.isNaN(respondedAt)) return 0

      return respondedAt + CONFIRM_SECONDS
    }

    return 0
  }, [order])

  const totalSec = CONFIRM_SECONDS

  const remaining = useCountdown(deadlineSec);

  const progress = totalSec > 0 ? Math.max(0, remaining / totalSec) : 0;

  // SVG ring params
  const R = 70;
  const C = 2 * Math.PI * R;   // circumference
  const dash = progress * C;    // filled arc length
  const gap  = C - dash;

  let deadlineStr = ""

  if (deadlineSec && !Number.isNaN(deadlineSec)) {
    deadlineStr = new Date(deadlineSec * 1000)
      .toISOString()
      .slice(0, 10)
  }

  return (
    <div className="w-full max-w-[395px]">
      <div className="w-full max-w-[395px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        {/* header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[#26D9D9] text-[14px] font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>
          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* title */}
        <div className="text-white text-[16px] md:text-[18px] mb-1">
          {order.seller_name} responded dispute for the order &ldquo;{order.order_name}&rdquo;
        </div>

        {/* status pill */}
        <div className="flex items-center gap-2 text-[#FF0000] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#FF0000]"></span>
          Discuss time started
        </div>

        {/* ring */}
        <div className="flex flex-col items-center gap-3 py-4">
          <svg width="180" height="180" viewBox="0 0 180 180">
            {/* track */}
            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#333"
              strokeWidth="5"
            />

            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#26D9D9"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={C / 4}
              transform="rotate(-90 90 90)"
            />
            <text
              x="90" y="95"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="22"
              fontWeight="500"
            >
              {formatCountdown(remaining)}
            </text>
          </svg>

          {deadlineStr && (
            <div>
              <p className="text-[#ff6b35] text-[12px] md:text-[14px] font-semibold text-center">
                Once the timer ends this dispute will ends in draw and everyone will lose all their money
              </p>

            </div>
          )}

        </div>

        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          {isBuyer && (
            <>
              <div className='flex flex-1 justify-center'>
                <button
                  onClick={() => onPaySeller?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
                >
                  <Image src="/dollar-sign-svgrepo-black-com.svg" width={17} height={17} alt="dollar"/>
                  Pay Seller
                </button>
              </div>
            </>
          )}
          {isSeller && (
            <>
              <div className='flex flex-1 justify-center'>
                <button
                  onClick={() => onRefundDiscuss?.(order)}
                  className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
                >
                  <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="respond"/>
                  Refund Buyer {/*During discuss time*/}
                </button>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}

function OpenedDisputeMessage({
  order,
  viewerId,
  onRespond,
  onRefund
}: {
  order: any;
  viewerId: string | null;
  onRespond?: (order:any)=>void
  onRefund?: (order:any)=>void
}) {
  if(!order) return null

  const isSeller = order?.seller_id === viewerId;
  const isBuyer  = order?.buyer_id  === viewerId;

  const CONFIRM_SECONDS = 24 * 3600

  const deadlineSec = React.useMemo(() => {
    if (order?.dispute_opened_at_unix) {
      const openedAt = Number(order.dispute_opened_at_unix)

      if (Number.isNaN(openedAt)) return 0

      return openedAt + CONFIRM_SECONDS
    }

    return 0
  }, [order])

  const totalSec = CONFIRM_SECONDS

  const remaining = useCountdown(deadlineSec);

  const progress = totalSec > 0 ? Math.max(0, remaining / totalSec) : 0;

  // SVG ring params
  const R = 70;
  const C = 2 * Math.PI * R;   // circumference
  const dash = progress * C;    // filled arc length
  const gap  = C - dash;

  let deadlineStr = ""

  if (deadlineSec && !Number.isNaN(deadlineSec)) {
    deadlineStr = new Date(deadlineSec * 1000)
      .toISOString()
      .slice(0, 10)
  }

  return (
    <div className="w-full max-w-[300px] md:max-w-[395px]">
      <div className="w-full max-w-[300px] md:max-w-[395px] rounded-2xl bg-[#0E0E0E] border border-white/10 p-4">

        {/* header row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[#26D9D9] text-[14px] font-medium">
            <Image src="/shield-exclamation-svgrepo-com (4).svg" width={22} height={22} alt="shield"/>
            ESCROW UPDATE
          </div>
          <div className="text-white/50 text-sm">
            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* title */}
        <div className="text-white text-[16px] md:text-[18px] mb-1">
          {order.buyer_name} opened dispute on the order &ldquo;{order.order_name}&rdquo;
        </div>

        {/* status pill */}
        <div className="flex items-center gap-2 text-[#F4B400] text-[12px] md:text-[14px] mb-4">
          <span className="w-2 h-2 rounded-full bg-[#F4B400]"></span>
          {order.seller_name} have to respond or refund to this dispute in time...
        </div>

        {/* ring */}
        <div className="flex flex-col items-center gap-3 py-4">
          <svg width="180" height="180" viewBox="0 0 180 180">
            {/* track */}
            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#333"
              strokeWidth="5"
            />

            <circle
              cx="90" cy="90" r={R}
              fill="none"
              stroke="#26D9D9"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={C / 4}
              transform="rotate(-90 90 90)"
            />
            <text
              x="90" y="95"
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="22"
              fontWeight="500"
            >
              {formatCountdown(remaining)}
            </text>
          </svg>

          {deadlineStr && (
            <div>
              <p className="text-[#ff6b35] text-[12px] md:text-[14px] font-semibold text-center">
                Once the timer ends {order.buyer_name} will win this dispute and {order.seller_name} will lose their bond to buyer
              </p>

            </div>
          )}

        </div>

        <div className="border-t border-white/10 pt-3 flex justify-between items-center">
          {isBuyer && (
            <>
              <div className="text-white/50 text-sm w-full text-center">
                Waiting for seller to respond...
              </div>
            </>
          )}
          {isSeller && (
            <div className="flex flex-1 gap-5 justify-center">
              <button
                onClick={() => onRespond?.(order)}
                className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
              >
                <Image src="/reply-svgrepo-com (1).svg" width={17} height={17} alt="respond"/>
                Respond
              </button>

              <button
                onClick={() => onRefund?.(order)}
                className="flex items-center text-[13px] md:text-[16px] gap-1.5 px-4 py-1 rounded-full bg-white text-black font-medium"
              >
                <Image src="/refund-forward-svgrepo-com (1).svg" width={20} height={20} alt="refund"/>
                Refund
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function OpenDisputeWyntkScreen({
  order,
  supabase,
  reason,
  openDisputeOnChain
}: {
  order: any
  supabase: any
  reason: "not_received" | "not_as_described" | null
  openDisputeOnChain:(order:any)=>Promise<void>
}) {

  const reasonText = {
    not_received: "Open dispute because you haven’t got the item.",
    not_as_described: "Open dispute because product is not as described.",
  }

  const title =
    reason ? reasonText[reason] :
    "Open dispute to report an issue with this order."


  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);


  return (
    <div className="h-full flex flex-col">

      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          Open Dispute
        </div>
        <div className="text-white/50 text-[17px] text-center max-w-[420px]">
          {title}
        </div>

        <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
            </div>

            {order.type === "physical" && (
              <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                {order.dispute_mode === "BTR" ? "BTR" : "STR"}
              </div>
            )}

            <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
              {order.type === "digital"
                ? `${order.ship_time_hours}h`
                : order.ship_date}
            </div>
          </div>

          <div className="flex gap-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                className="w-[80px] h-[80px] rounded-xl object-cover"
              />
            ) : (
              <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
            )}

            <div>
              <div className="text-[#26D9D9] text-xl font-bold">
                {order.order_name}
              </div>

              <div className="text-white text-2xl">
                ${order.price_usd}
              </div>

              <div className="text-white/50 text-sm">
                {order.description}
              </div>
            </div>
          </div>
          <button
            className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
          >
            <Image src="/eye-show-svgrepo-com.svg" width={22} height={22} alt="refund" className='mb-0.5 mr-1.5'/>
            Review
          </button>
        </div>
          <AsyncButton
            onClick={() => openDisputeOnChain(order)}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Open dispute
          </AsyncButton>
      </div>
    </div>
  )
}

function WYNTKScreen({
  order,
  supabase,
  onBack,
  reason,
  openDisputeOnChain,
  onInternalBack
}: {
  order: any
  supabase: any
  onBack:()=>void
  reason: "not_received" | "not_as_described" | null
  openDisputeOnChain:(order:any)=>Promise<void>
  onInternalBack?: (fn: () => void) => void
}) {

  type WyntkStep = "wyntk" | "1" | "2" | "3" | "4" | "dispute"

  const [step, setStep] = React.useState<WyntkStep>("wyntk")

  const historyRef = React.useRef<WyntkStep[]>([])

  function go(next: WyntkStep) {
    if (step !== next) {
      historyRef.current.push(step)
      setStep(next)
    }
  }

  function goBack() {
    const prev = historyRef.current.pop()

    if (prev) {
      setStep(prev)
    } else {

      if (step === "wyntk") {
        onBack()
      }
    }
  }

  const [imageUrl, setImageUrl] = React.useState<string>("");

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  React.useEffect(() => {
    onInternalBack?.(goBack)
  }, [step])

  return (
    <div className="h-full flex flex-col">

    {/* BODY */}
    {step === "wyntk" && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="w-20 h-20 rounded-full bg-[#402F11] flex items-center justify-center mb-2">
          <Image src="/info-svgrepo-com.svg" width={40} height={40} alt="info" />
        </div>
        <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
          What you need to know before open dispute
        </div>

          <button
            onClick={()=>{
              go("1")
            }}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === "1" && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="flex items-center justify-center mb-2">
          <Image src="/warn-triangle-filled-svgrepo-com (1).svg" width={70} height={70} alt="warn" />
        </div>
        <div className="text-white text-[24px] text-center max-w-[420px]">
          Open a dispute only if the item hasn't arrived or isn't as described, as it cannot be canceled once opened.
        </div>

          <button
            onClick={()=>{
              go("2")
            }}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === "2" && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="flex items-center justify-center mb-2">
          <Image src="/reply-svgrepo-com (2).svg" width={70} height={70} alt="reply" />
        </div>
        <div className="text-white text-[22px] text-center max-w-[420px]">
          Once a dispute is opened, Seller has 24 hours to respond or refund. If they refund, you get your money back. If they fail to respond in time, you win the dispute, and the seller’s bond will be forfeited to you.
        </div>

          <button
            onClick={()=>{
              go("3")
            }}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === "3" && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="flex items-center justify-center mb-2">
          <Image src="/discuss-svgrepo-com (2).svg" width={70} height={70} alt="discuss" />
        </div>
        <div className="text-white text-[22px] text-center max-w-[420px]">
          Once the seller responds, both parties have 24 hours to discuss.
        </div>

          <button
            onClick={()=>{
              go("4")
            }}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === "4" && (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">
        <div className="flex items-center justify-center mb-2">
          <Image src="/time-svgrepo-com (2).svg" width={70} height={70} alt="info" />
        </div>
        <div className="text-white text-[22px] text-center max-w-[420px]">
          If discussion time ends this dispute will ends in draw and both seller and buyer will lose all their money
        </div>

          <button
            onClick={()=>{
              go("dispute")
            }}
            className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
          >
            Next
          </button>
      </div>
    )}
    {step === "dispute" && (
      <OpenDisputeWyntkScreen
        order={order}
        supabase={supabase}
        reason={reason}
        openDisputeOnChain={openDisputeOnChain}
      />
    )}
    </div>
  )
}

function ReviewScreen({
  order,
  onClose,
  supabase,
  conversationId,
  userId,
  activeContactId,
  openDisputeOnChain
}:{
  order:any
  onClose:()=>void
  supabase: any
  conversationId: string | null
  userId: string | null
  activeContactId: string | null
  openDisputeOnChain:(order:any)=>Promise<void>
}){

  const wyntkBackRef = React.useRef<() => void>(() => {})

  type Step =
    | "intro"
    | "questions"
    | "question2"
    | "pay"
    | "dispute"
    | "success"
    | "wyntk"
    | "download"

  const [disputeReason, setDisputeReason] = React.useState<
    "not_received" | "not_as_described" | null
  >(null)

  const [imageUrl, setImageUrl] = React.useState<string>("");

  const [step, setStep] = React.useState<Step>("intro")

  const [previousStep,setPreviousStep] = React.useState<"questions" | "question2">("questions")

  React.useEffect(() => {
    if (!order?.image_path) return;

    async function loadImage() {

      const { data, error } = await supabase.storage
        .from("escrow")
        .createSignedUrl(order.image_path, 60 * 60);

      if (error) {
        console.error("signed url error:", error);
        return;
      }

      setImageUrl(data.signedUrl);
    }

    loadImage();
  }, [order, supabase]);

  const historyRef = React.useRef<Step[]>([])

  function go(next: Step) {
    if (step !== next) {
      historyRef.current.push(step)
      setStep(next)
    }
  }

  function goBack() {
    const prev = historyRef.current.pop()
    if (prev) setStep(prev)
  }

  async function confirmDeliveryOnChain(order:any){
    try{

      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const buyer = wallet.publicKey
      const seller = new anchor.web3.PublicKey(order.seller_wallet)

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller,orderIndex)

      const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      const tx = await program.methods
        .confirmDelivery(orderIndex)
        .accounts({
          order:orderPda,
          escrow:escrowPda,
          buyer:buyer,
          seller:seller
        })
        .rpc()


      await supabase
        .from("escrow_orders")
        .update({
          status:"Completed",
          confirm_tx:tx
        })
        .eq("escrow_pda",order.escrow_pda)

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body: `escrow_update:${order.escrow_pda}:buyer_confirmed`,
        message_type: "escrow_update",
      });

      setTx(tx)
      go("success")

    }catch(err:any){
      reportError(err, "confirm-delivery");
    }
  }

  const [tx,setTx] = React.useState<string>("")

  return (
    <div className="h-full flex flex-col">
    {step === "intro" && (
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">

          <div className="text-white text-[18px] font-medium truncate">
            Review
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
    )}
    {step === "questions" && (
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={goBack}
            type="button"
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Review
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
    )}
    {step === "wyntk" && (
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => {
              if (step === "wyntk") {
                wyntkBackRef.current()
              } else {
                goBack()
              }
            }}
            type="button"
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Review
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
    )}
    {step === "question2" && (
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={goBack}
            type="button"
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Review
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
    )}
    {step === "pay" && (
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={goBack}
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Review
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
    )}
    {step === "dispute" && (
      <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
        {/* LEFT */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={goBack}
            type="button"
            className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
            title="Back"
          >
            <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
          </button>

          <div className="text-white text-[18px] font-medium truncate">
            Review
          </div>
        </div>

        {/* RIGHT */}
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80 shrink-0"
          title="Close"
        >
          <Image src="/cancel-svgrepo-com.svg" width={20} height={20} alt="X" />
        </button>
      </div>
    )}
      {step === "success" && (
        <ConfirmSuccess
          tx={tx}
          onClose={onClose}
        />
      )}
      {/* BODY */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

        {step === "intro" && (
          <>
            <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
              Review
            </div>

            <div className="text-white/50 text-[17px] text-center max-w-[420px]">
              Please answer a few questions to review this order. If you haven’t received the item or it is not as described, you can open a dispute.
            </div>

            <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
              <div className="flex gap-2 mb-3">
                <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                  {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
                </div>

                {order.type === "physical" && (
                  <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                    {order.dispute_mode === "BTR" ? "BTR" : "STR"}
                  </div>
                )}

                <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                  {order.type === "digital"
                    ? `${order.ship_time_hours}h`
                    : order.ship_date}
                </div>
              </div>

              <div className="flex gap-4">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    className="w-[80px] h-[80px] rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
                )}

                <div>
                  <div className="text-[#26D9D9] text-xl font-bold">
                    {order.order_name}
                  </div>

                  <div className="text-white text-2xl">
                    ${order.price_usd}
                  </div>

                  <div className="text-white/50 text-sm">
                    {order.description}
                  </div>
                </div>
              </div>
              <button
                className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
              >
                <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar" className='mb-0.5 mr-1.5'/>
                Fund Escrow
              </button>
            </div>

            <button
              onClick={() => go("questions")}
              className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
            >
              Answer Questions
            </button>
          </>
        )}

        {step === "questions" && (
          <>
            <div className="text-white text-[28px]">
              Have you got the item?
            </div>

            <div className="flex gap-16">

              {/* YES */}
              <button onClick={() => go("question2")} className="flex flex-col items-center gap-3">
                <div className="size-[clamp(5.5rem,24vw,7.5rem)] rounded-2xl bg-[#063b1d] flex items-center justify-center">
                  <Image src="/check-svgrepo-com (1).svg" width={50} height={50} alt="yes"/>
                </div>
                <div className="text-white/70">Yes</div>
              </button>

              {/* NO */}
              <button
                onClick={()=>{
                  if (order.type === "digital") {
                    go("download")
                    return
                  }
                  setPreviousStep(step)
                  setDisputeReason("not_received")
                  go("dispute")
                }}
                className="flex flex-col items-center gap-3">
                <div className="size-[clamp(5.5rem,24vw,7.5rem)] rounded-2xl bg-[#3b0606] flex items-center justify-center">
                  <Image src="/cancel-red-svgrepo-com (2).svg" width={32} height={32} alt="no"/>
                </div>
                <div className="text-white/70">No</div>
              </button>

            </div>
          </>
        )}
        {step === "download" && (
          <DownloadScreen
            order={order}
            supabase={supabase}
            onClose={onClose}
          />
        )}
        {step === "question2" && (
          <>
            <div className="text-white text-[28px]">
              Is the product as described?
            </div>

            <div className="flex gap-16">

              {/* YES */}
              <button onClick={() => {go("pay")}} className="flex flex-col items-center gap-3">
                <div className="size-[clamp(5.5rem,24vw,7.5rem)] rounded-2xl bg-[#063b1d] flex items-center justify-center">
                  <Image src="/check-svgrepo-com (1).svg" width={50} height={50} alt="yes"/>
                </div>
                <div className="text-white/70">Yes</div>
              </button>

              {/* NO */}
              <button
                onClick={()=>{
                  setPreviousStep(step)
                  setDisputeReason("not_as_described")
                  go("dispute")
                }}
                className="flex flex-col items-center gap-3">
                <div className="size-[clamp(5.5rem,24vw,7.5rem)] rounded-2xl bg-[#3b0606] flex items-center justify-center">
                  <Image src="/cancel-red-svgrepo-com (2).svg" width={32} height={32} alt="no"/>
                </div>
                <div className="text-white/70">No</div>
              </button>

            </div>
          </>
        )}

        {step === "dispute" && (
          <OpenDisputeScreen
            order={order}
            supabase={supabase}
            onNext={()=>go("wyntk")}
          />
        )}

        {step === "wyntk" && (
          <WYNTKScreen
            order={order}
            supabase={supabase}
            onBack={goBack}
            reason={disputeReason}
            openDisputeOnChain={openDisputeOnChain}
            onInternalBack={(fn) => {
              wyntkBackRef.current = fn
            }}
          />
        )}

        {step === "pay" && (
          <>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 px-4 py-8">

              <div className="text-white text-[28px] md:text-[32px] font-semibold tracking-[-0.02em] text-center max-w-[420px]">
                Confirm
              </div>
              <div className="text-white/50 text-[17px] text-center max-w-[420px]">
                After you click Confirm Seller will get paid and you will get your bond money back
              </div>

              <div className={`w-full max-w-[420px] ${UI.panel} p-4`}>
                <div className="flex gap-2 mb-3">
                  <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                    {order.type === "nft" ? "NFT" : order.type === "digital" ? "Digital" : "Physical"}
                  </div>

                {order.type === "physical" && (
                  <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                    {order.dispute_mode === "BTR" ? "BTR" : "STR"}
                  </div>
                )}

                  <div className="px-3 py-0.5 rounded-full bg-[#113f3f] text-[#26D9D9] font-medium text-xs sm:text-sm">
                    {order.type === "digital"
                      ? `${order.ship_time_hours}h`
                      : order.ship_date}
                  </div>
                </div>

                <div className="flex gap-4">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      className="w-[80px] h-[80px] rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-[80px] h-[80px] rounded-xl bg-white/10 animate-pulse" />
                  )}

                  <div>
                    <div className="text-[#26D9D9] text-xl font-bold">
                      {order.order_name}
                    </div>

                    <div className="text-white text-2xl">
                      ${order.price_usd}
                    </div>

                    <div className="text-white/50 text-sm">
                      {order.description}
                    </div>
                  </div>
                </div>
                <button
                  className="mt-4 h-[40px] w-full rounded-xl bg-white flex items-center justify-center text-black font-medium"
                >
                  <Image src="/dollar-sign-svgrepo-black-com.svg" width={16} height={16} alt="Dollar" className='mb-0.5 mr-1.5'/>
                  Confirm
                </button>
              </div>
                <AsyncButton
                  onClick={() => confirmDeliveryOnChain(order)}
                  className="h-[46px] rounded-[10px] font-semibold w-full max-w-[420px] bg-[#26D9D9] text-black hover:opacity-90 transition"
                >
                  Confirm
                </AsyncButton>
            </div>
          </>
        )}

      </div>

    </div>
  )
}

function ProfileViewModal({
  uid,
  supabase,
  onClose,
}: {
  uid: string;
  supabase: any;
  onClose: () => void;
}) {
  const [profile, setProfile] = React.useState<{
    username: string;
    bio: string;
    avatar_url: string;
    created_at: string | null;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;

    async function loadProfile() {
      setLoading(true);

      const [usernameRes, profileRes] = await Promise.all([
        supabase
          .from("usernames")
          .select("username")
          .eq("user_id", uid)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select("bio, avatar_url, created_at")
          .eq("id", uid)
          .maybeSingle(),
      ]);

      if (!alive) return;

      if (usernameRes.error) {
        console.error("LOAD_USERNAME_ERROR:", {
          message: usernameRes.error?.message,
          details: usernameRes.error?.details,
          hint: usernameRes.error?.hint,
          code: usernameRes.error?.code,
        });
      }

      if (profileRes.error) {
        console.error("LOAD_PROFILE_ERROR:", {
          message: profileRes.error?.message,
          details: profileRes.error?.details,
          hint: profileRes.error?.hint,
          code: profileRes.error?.code,
        });
      }

      setProfile({
        username: usernameRes.data?.username || "Unknown user",
        bio: profileRes.data?.bio || "",
        avatar_url: profileRes.data?.avatar_url || "",
        created_at: profileRes.data?.created_at || null,
      });

      setLoading(false);
    }

    loadProfile();

    return () => {
      alive = false;
    };
  }, [uid, supabase]);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const storageAvatarUrl = getProfileUrl(supabase, uid);
  const avatarUrl = profile?.avatar_url || storageAvatarUrl;
  const freshAvatarUrl = avatarUrl
    ? `${avatarUrl.split("?")[0]}?v=${Date.now()}`
    : "/cat.png";

  const username = profile?.username || "Unknown user";
  const bio = profile?.bio?.trim() || "No bio yet.";
  const joinedText = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Close profile"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 18 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[480px] rounded-[30px] border border-white/10 bg-[#080808]/95 p-8 text-white shadow-[0_30px_100px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top,#2FE4E420,transparent_42%)]" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 transition"
        >
          <Image src="/cancel-svgrepo-com.svg" width={18} height={18} alt="close" />
        </button>

        {loading ? (
          <div className="relative z-10 flex flex-col items-center pt-8">
            <Skeleton className="h-[132px] w-[132px] rounded-full" shimmer />
            <Skeleton className="mt-6 h-8 w-44 rounded-lg" shimmer />
            <Skeleton className="mt-4 h-4 w-28 rounded-md" />
            <Skeleton className="mt-8 h-[120px] w-full rounded-3xl" shimmer />
          </div>
        ) : (
          <div className="relative z-10">
            <div className="flex flex-col items-center pt-8">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#2FE4E4]/15 blur-2xl" />
                <img
                  src={freshAvatarUrl}
                  alt="profile"
                  className="relative h-[132px] w-[132px] rounded-full border border-white/10 object-cover shadow-[0_0_45px_rgba(47,228,228,0.14)]"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.src = "/cat.png";
                  }}
                />
              </div>

              <h2 className="mt-6 max-w-full truncate text-[32px] font-bold tracking-[-0.05em]">
                {username}
              </h2>

              {joinedText && (
                <p className="mt-1 text-xs text-white/35">
                  Joined {joinedText}
                </p>
              )}
            </div>

            <div className="mt-8">
              <div className="mb-3 text-sm font-semibold text-white">
                Bio
              </div>

              <div className="min-h-[120px] rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-4">
                <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-white/80">
                  {bio}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SendFeedbackModal({
  feedbackText,
  setFeedbackText,
  feedbackType,
  setFeedbackType,
  sendingFeedback,
  feedbackError,
  onSubmit,
  onClose,
}: {
  feedbackText: string;
  setFeedbackText: React.Dispatch<React.SetStateAction<string>>;
  feedbackType: string;
  setFeedbackType: React.Dispatch<React.SetStateAction<string>>;
  sendingFeedback: boolean;
  feedbackError: string;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center px-4 py-6">
      <motion.button
        type="button"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[480px] rounded-[32px] border border-white/10 bg-[#09090b]/95 p-6 text-white shadow-[0_24px_90px_rgba(0,0,0,0.72)] backdrop-blur-xl sm:p-8"
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Send Feedback
            </h2>
            <p className="mt-1.5 text-sm text-white/50">
              Tell us what we can improve.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white active:scale-90"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["Bug", "Idea", "Other"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFeedbackType(type)}
              className={`h-10 rounded-xl text-sm font-semibold transition ${
                feedbackType === type
                  ? "bg-[#2FE4E4] text-black"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold text-white/90">
            Feedback
          </label>

          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
            placeholder="Write your feedback..."
            className="min-h-[150px] w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 pr-16 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#2FE4E4]/30"
          />

          <div className="mt-2 text-right text-xs text-white/40">
            {feedbackText.length}/500
          </div>
        </div>

        {feedbackError && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {feedbackError}
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!feedbackText.trim() || sendingFeedback}
          className="mt-7 flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#2FE4E4] text-base font-bold text-black transition hover:bg-[#4ff3f3] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sendingFeedback ? (
            <ButtonLoadingLabel label="Sending..." />
          ) : (
            "Send Feedback"
          )}
        </button>
      </motion.div>
    </div>
  );
}

export default function AppHome() {
  // Warning (Delete once deploy)
  const [showPrototypeBanner, setShowPrototypeBanner] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => {
      setShowPrototypeBanner(true);
    }, 150);

    return () => clearTimeout(t);
  }, []);
  // Warning (Delete once deploy)
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState("");
  const [feedbackType, setFeedbackType] = React.useState("Bug");
  const [sendingFeedback, setSendingFeedback] = React.useState(false);
  const [feedbackError, setFeedbackError] = React.useState("");

  async function submitFeedback() {
    const message = feedbackText.trim();

    if (!message || sendingFeedback) return;

    try {
      setSendingFeedback(true);
      setFeedbackError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setFeedbackError("Please sign in before sending feedback.");
        return;
      }

      const { data: usernameRow, error: usernameError } = await supabase
        .from("usernames")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();

      if (usernameError) {
        console.error("LOAD_FEEDBACK_USERNAME_ERROR:", usernameError);
      }

      const { error } = await supabase
        .from("feedbacks")
        .insert({
          user_id: user.id,
          username: usernameRow?.username ?? null,
          type: feedbackType,
          message,
        });

      if (error) throw error;

      setFeedbackText("");
      setFeedbackType("Bug");
      setShowFeedback(false);
    } catch (err: any) {
      console.error("SEND_FEEDBACK_ERROR:", {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
      });

      setFeedbackError(err?.message || "Failed to send feedback. Please try again.");
    } finally {
      setSendingFeedback(false);
    }
  }

  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [profileModal, setProfileModal] = React.useState<string | null>(null);

  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const avatarPreviewUrlRef = React.useRef<string | null>(null);
  const [bio, setBio] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function withCacheBust(url: string) {
    if (!url || url.startsWith("blob:") || url.startsWith("/")) return url;
    const cleanUrl = url.split("?")[0];
    return `${cleanUrl}?v=${Date.now()}`;
  }

  function setLocalAvatarPreview(file: File) {
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
      avatarPreviewUrlRef.current = null;
    }

    const previewUrl = URL.createObjectURL(file);
    avatarPreviewUrlRef.current = previewUrl;
    setAvatarFile(file);
    setAvatarSrc(previewUrl);
  }

  React.useEffect(() => {
    return () => {
      if (avatarPreviewUrlRef.current) {
        URL.revokeObjectURL(avatarPreviewUrlRef.current);
        avatarPreviewUrlRef.current = null;
      }
    };
  }, []);


  const [authReady, setAuthReady] = React.useState(false);
  const [walletChecked, setWalletChecked] = React.useState(false);
  const [mustConnectWallet, setMustConnectWallet] = React.useState(false);
  const [connectingWallet, setConnectingWallet] = React.useState(false);

  const [uploadOrder, setUploadOrder] = React.useState<any | null>(null)

  const [paidSellerTx, setPaidSellerTx] = React.useState<string | null>(null)

  const [downloadOrder, setDownloadOrder] = React.useState<any | null>(null);

  const [refundDiscussOrder, setRefundDiscussOrder] = React.useState<any | null>(null)

  const [PaySellerOrder, setPaySellerOrder] = React.useState<any | null>(null)

  const [respondDisputeSuccessTx, setRespondDisputeSuccessTx] =
    React.useState<string | null>(null)

  const [refundDisputeOrder, setRefundDisputeOrder] = React.useState<any | null>(null)

  const [respondDisputeStep, setRespondDisputeStep] =
    React.useState<"respond" | "wyntk" | "confirm">("respond")

  const [respondDisputeOrder, setRespondDisputeOrder] = React.useState<any | null>(null)

  const [respondDisputeSubStep, setRespondDisputeSubStep] = React.useState(0);

  const [disputeStep,setDisputeStep] = React.useState<"open" | "wyntk" >("open")

  const [openedDisputeTx, setOpenedDisputeTx] = React.useState<string | null>(null)

  const [disputeOrder, setDisputeOrder] = React.useState<any>(null)

  const [sellerCancelSuccessTx, setSellerCancelSuccessTx] = React.useState<string | null>(null)

  const [cancelOrder, setCancelOrder] = React.useState<any>(null)

  const [sellerFundOrder, setSellerFundOrder] = React.useState<any>(null)
  const [sellerStep, setSellerStep] = React.useState<"fund" | "confirm">("fund")
  const [sellerFundSuccess,setSellerFundSuccess] = React.useState<any>(null)
  const [sellerShippedSuccess,setSellerShippedSuccess] = React.useState<any>(null)

  const [refundSuccessTx, setRefundSuccessTx] = React.useState<string | null>(null)

  const [refundOrder, setRefundOrder] = React.useState<any>(null)

  const [shipOrder,setShipOrder] = React.useState<any>(null)

  const [escrowListOpen, setEscrowListOpen] = React.useState(false)

  const [reviewOrder,setReviewOrder] = React.useState<any>(null)

  const [fundSuccessTx, setFundSuccessTx] = React.useState<string | null>(null)

  const [fundOrder, setFundOrder] = React.useState<any>(null)
  const [fundMode, setFundMode] = React.useState<"BTR" | "STR" | null>(null)

  const [fundStep, setFundStep] = React.useState<"screen" | "confirm" >("screen")

  const [buyNftOrder, setBuyNftOrder] = React.useState<any>(null)
  const [buyNftSuccessTx, setBuyNftSuccessTx] = React.useState<string | null>(null)


  async function handleSaveProfile() {
    if (!userId) {
      pushToast("Not logged in");
      return;
    }

    setSaving(true);

    try {
      const trimmedBio = bio.trim();
      let nextAvatarUrl: string | null = null;

      if (avatarFile) {
        const filePath = `${userId}.jpg`;

        const { error: removeError } = await supabase.storage
          .from("profiles")
          .remove([filePath]);

        // remove() returns an error when the file does not exist in some setups.
        // That should not block first-time avatar upload.
        if (removeError && removeError.message && !removeError.message.toLowerCase().includes("not found")) {
          console.warn("PROFILE_AVATAR_REMOVE_WARNING:", removeError);
        }

        const { error: uploadError } = await supabase.storage
          .from("profiles")
          .upload(filePath, avatarFile, {
            cacheControl: "0",
            contentType: avatarFile.type || "image/jpeg",
          });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("profiles")
          .getPublicUrl(filePath);

        nextAvatarUrl = withCacheBust(data.publicUrl);

        if (avatarPreviewUrlRef.current) {
          URL.revokeObjectURL(avatarPreviewUrlRef.current);
          avatarPreviewUrlRef.current = null;
        }

        // show the newly uploaded image immediately
        setAvatarSrc(nextAvatarUrl);
      }

      const profilePatch: Record<string, any> = {
        bio: trimmedBio,
        updated_at: new Date().toISOString(),
      };

      if (nextAvatarUrl) {
        profilePatch.avatar_url = nextAvatarUrl;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(profilePatch)
        .eq("id", userId);

      if (updateError) throw updateError;

      setBio(trimmedBio);
      setAvatarFile(null);
      setShowEditProfile(false);
    } catch (err: any) {
      console.error("SAVE_PROFILE_ERROR_FULL:", {
        message: err?.message,
        statusCode: err?.statusCode,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err,
      });

      pushToast("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function onReview(order:any){
    setReviewOrder(order)
  }

  function openSellerShippedSuccess(tx:string,deadline:number){
    setSellerShippedSuccess({
      tx,
      deadline
    })
  }

  function isEscrowUpdateMessage(body: string) {
    return body.startsWith("escrow_update:");
  }

  function onMarkShipped(order:any){
    setShipOrder(order)
  }

  function openSellerFundSuccess(tx:string,deadline:number){
    setSellerFundSuccess({
      tx,
      deadline
    })
  }

  function onBuy(order:any){
    if (order.type === "nft") {
      setBuyNftOrder(order)
      return
    }
    setFundMode(order.dispute_mode)
    setFundOrder(order)
  }

  function onSellerFund(order:any){
    setSellerFundOrder(order)
    setSellerStep("fund")
  }

  type ExitTarget = 'chat' | 'pickType';

  const [exitTarget, setExitTarget] = React.useState<ExitTarget>('chat');
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);

  function exitEscrowFlow() {
    resetEscrowDraft();

    if (exitTarget === 'pickType') {
      setEscrowStep('pickType');
    } else {
      setEscrowOpen(false);
      setEscrowStep('pickType');
    }

    setShowExitConfirm(false);
  }

  function resetEscrowDraft() {
    setEscrowDraft({
      type: '' as 'physical' | 'digital' | '',
      disputeMode: '' as 'BTR' | 'STR' | '',
      imageFile: undefined,
      imagePreview: '',
      description: '',
      price: '',
      shipDate: '',
      shipTime: '',
      orderName: '',
      nftMint: '',
    });
    setEscrowType(null);
  }

  type MobileView = 'contacts' | 'chat';
  const [mobileView, setMobileView] = React.useState<MobileView>('contacts');

  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)'); // < md
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  type EscrowType = 'physical' | 'digital';
  type EscrowStep = 'pickType' | 'digitalKind' | 'nftInfo' | 'itemInfo' | 'nameOrder' | 'preview' | 'disputeMode' | 'success';
  type DisputeMode = 'BTR' | 'STR';

  const [escrowOpen, setEscrowOpen] = React.useState(false);
  const [escrowStep, setEscrowStep] = React.useState<EscrowStep>('pickType');
  const [escrowType, setEscrowType] = React.useState<EscrowType | null>(null);
  const [escrowById, setEscrowById] = React.useState<Record<string, any>>({});
  const refreshEscrowRowsRef = React.useRef<((pdas: string[]) => Promise<void>) | null>(null);

  async function loadEscrow(orderId: string) {
    if (escrowById[orderId]) return escrowById[orderId];

    const { data, error } = await supabase
      .from("escrow_orders")
      .select("*")
      .eq("escrow_pda", orderId)
      .single();

    if (error) {
      console.error(error);
      return null;
    }

    setEscrowById(prev => ({ ...prev, [orderId]: data }));
    return data;
  }

  const [escrowDraft, setEscrowDraft] = React.useState({
    type: '' as 'physical' | 'digital' | '',
    disputeMode: '' as 'BTR' | 'STR' | '',
    imageFile: undefined as File | undefined,
    imagePreview: '',
    description: '',
    price: '',
    shipDate: '',
    shipTime: '',
    orderName: '',
    nftMint: '',
  });

  function followBottomFor(
    ms = 700,
    force = false,
    behavior: ScrollBehavior = 'auto'
  ) {
    if (restoringScrollRef.current) return;
    const start = performance.now();
    let first = true;

    const tick = () => {
      if (!force && !isNearBottom()) return;

      scrollToBottomHard(first ? behavior : 'auto');
      first = false;

      if (performance.now() - start < ms) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  const chatScrollRef = React.useRef<HTMLDivElement | null>(null);
  const chatScrollPosRef = React.useRef(0);
  const restoringScrollRef = React.useRef(false);

  function clampPan(nextPan: { x: number; y: number }, nextZoom: number) {
    const el = viewerBodyRef.current;
    if (!el) return nextPan;

    const cw = el.clientWidth;
    const ch = el.clientHeight;

    const maxX = Math.max(0, (cw * nextZoom - cw) / 2);
    const maxY = Math.max(0, (ch * nextZoom - ch) / 2);

    return {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    };
  }

  function isNearBottom(threshold = 80) {
    const el = chatScrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }

  function scrollToBottomHard(behavior: ScrollBehavior = 'auto') {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  function calcFitZoom() {
    const el = viewerBodyRef.current;
    const img = imgRef.current;
    if (!el || !img) return 1;

    const cw = el.clientWidth;
    const ch = el.clientHeight;

    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;

    return Math.min(cw / iw, ch / ih);
  }

  const dragRef = React.useRef<{ dragging: boolean; sx: number; sy: number; px: number; py: number }>({
    dragging: false, sx: 0, sy: 0, px: 0, py: 0
  });

  function onViewerMouseDown(e: React.MouseEvent) {
    if (zoom <= 1) return;
    dragRef.current = { dragging: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  }

  function onViewerMouseMove(e: React.MouseEvent) {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;

    const next = { x: dragRef.current.px + dx, y: dragRef.current.py + dy };
    setPan(clampPan(next, zoom));
  }

  function onViewerMouseUp() {
    dragRef.current.dragging = false;
  }

  const imgRef = React.useRef<HTMLImageElement | null>(null);

  const [minZoom, setMinZoom] = React.useState(1);
  React.useEffect(() => {
    setZoom((z) => Math.max(z, minZoom));
    setPan((p) => clampPan(p, Math.max(zoom, minZoom)));
  }, [minZoom]);

  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const viewerBodyRef = React.useRef<HTMLDivElement | null>(null);

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  function resetZoom() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  const [viewer, setViewer] = React.useState<null | {
    url: string;
    createdAt: string;
    title: string;
    avatar?: string;
    uid?: string;
  }>(null);

  function formatViewerTime(iso: string) {
    const d = new Date(iso);
    const day = d.getDate();
    const mon = MONTH_ABBR[d.getMonth()];
    const yyyy = d.getFullYear();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${day} ${mon} ${yyyy} ${time}`;
  }
  const [signedUrlByPath, setSignedUrlByPath] = React.useState<Record<string, string>>({});

  async function openImageViewer(m: DbMessage) {
    const el = chatScrollRef.current;
    if (el) chatScrollPosRef.current = el.scrollTop;

    resetZoom();
    if (!activeContact || !userId) return;

    const path = m.body.slice(8);
    const url = await getSignedUrl(path);
    if (!url) return;

    const mine = m.sender_id === userId;

    setViewer({
      url,
      createdAt: m.created_at,
      title: mine ? 'You' : activeContact.username,
      avatar: mine ? avatarSrc : (activeContact.avatar || '/cat.png'),
      uid: mine ? userId : activeContact.id,
    });
  }

  React.useEffect(() => {
    if (viewer !== null) return;
    if (!restoringScrollRef.current) return;

    const el = chatScrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const prev = el.style.scrollBehavior;
        el.style.scrollBehavior = 'auto';

        el.scrollTop = chatScrollPosRef.current;

        el.style.scrollBehavior = prev;

        restoringScrollRef.current = false;
        chatPositionReadyRef.current = conversationId;
      });
    });
  }, [viewer]);

  async function getSignedUrl(path: string, bucket: string = 'chat-images') {
    const cacheKey = `${bucket}:${path}`;
    if (signedUrlByPath[cacheKey]) return signedUrlByPath[cacheKey];

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60);

    if (error || !data?.signedUrl) {
      console.error(error);
      return '';
    }

    setSignedUrlByPath((prev) => ({ ...prev, [cacheKey]: data.signedUrl }));
    return data.signedUrl;
  }
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [sendingImage, setSendingImage] = React.useState(false);

  // images that are being uploaded right now (shown as dimmed bubbles with a
  // spinner) and local previews kept until the real image URL has loaded
  const [pendingImages, setPendingImages] = React.useState<{ id: string; url: string; path?: string }[]>([]);
  const [localImagePreviews, setLocalImagePreviews] = React.useState<Record<string, string>>({});

  async function sendImage(file: File) {
    if (!userId || !activeContactId || !conversationId) return;

    pendingBottomScrollRef.current = true;
    pendingConvoRef.current = conversationId;

    followBottomFor(800, true, 'smooth');

    const replyId = replyToRef.current?.id ?? null;
    setReplyTo(null);

    setSendingImage(true);

    const pendingId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    const dropPending = () => setPendingImages((prev) => prev.filter((p) => p.id !== pendingId));

    setPendingImages((prev) => [...prev, { id: pendingId, url: previewUrl }]);
    requestAnimationFrame(() => followBottomFor(500, true, 'auto'));

    try {
      const compressed = await compressImage(file, 1280, 0.75);

      const path = `${conversationId}/${Date.now()}_${crypto.randomUUID()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from('chat-images')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });

      if (upErr) {
        console.error(upErr);
        dropPending();
        pushToast("Couldn't upload the image. Please try again.");
        return;
      }

      // the real image shows this local preview until its own URL has loaded
      setLocalImagePreviews((prev) => ({ ...prev, [path]: previewUrl }));
      setPendingImages((prev) => prev.map((p) => (p.id === pendingId ? { ...p, path } : p)));

      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body: encodeReplyBody(replyId, `imgpath:${path}`),
      });

      setContacts((prev) => {
        const next = prev.map((c) =>
          c.id === activeContactId
            ? {
                ...c,
                subtitle: 'You: Sent an Image',
                lastAt: new Date().toISOString(),
                lastSenderId: userId!,
              }
            : c
        );
        next.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
        return next;
      });

      if (msgErr) {
        console.error(msgErr);
        dropPending();
        pushToast("Couldn't send the image. Please try again.");
      } else {
        // safety net in case the realtime event never arrives
        window.setTimeout(dropPending, 8000);
      }
    } catch (err) {
      console.error(err);
      dropPending();
      pushToast("Couldn't send the image. Please try again.");
    } finally {
      setSendingImage(false);
    }
  }

  // ---- voice messages ----
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [sendingVoice, setSendingVoice] = React.useState(false);
  const [recordingLevels, setRecordingLevels] = React.useState<number[]>(Array(28).fill(4));

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordedLevelsRef = React.useRef<number[]>([]);
  const recordingIntervalRef = React.useRef<number | null>(null);
  const recordingStartRef = React.useRef<number>(0);
  const streamRef = React.useRef<MediaStream | null>(null);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const levelRafRef = React.useRef<number | null>(null);

  function downsampleLevels(levels: number[], count: number) {
    if (levels.length === 0) return Array.from({ length: count }, () => 30);
    if (levels.length <= count) return levels;
    const step = levels.length / count;
    const out: number[] = [];
    for (let i = 0; i < count; i++) out.push(Math.round(levels[Math.floor(i * step)]));
    return out;
  }

  function cleanupRecording() {
    if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current);
    levelRafRef.current = null;
    if (recordingIntervalRef.current) window.clearInterval(recordingIntervalRef.current);
    recordingIntervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setIsRecording(false);
    setRecordingTime(0);
    setRecordingLevels(Array(28).fill(4));
  }

  async function startRecording() {
    if (!activeContact || isRecording || sendingVoice) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredType = 'audio/webm;codecs=opus';
      const mimeType =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(preferredType)
          ? preferredType
          : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm')
          ? 'audio/webm'
          : '';

      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      recordedLevelsRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.start();

      const AudioCtxCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxCtor) {
        const audioCtx = new AudioCtxCtor();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.max(6, Math.round((avg / 255) * 140)));

          recordedLevelsRef.current.push(level);
          setRecordingLevels((prev) => [...prev.slice(1), level]);

          levelRafRef.current = requestAnimationFrame(tick);
        };
        levelRafRef.current = requestAnimationFrame(tick);
      }

      recordingStartRef.current = Date.now();
      setRecordingTime(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 200);

      setIsRecording(true);
    } catch (err) {
      console.error('Microphone permission error', err);
    }
  }

  function cancelRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = null;
      mr.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    cleanupRecording();
  }

  function stopAndSendRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') {
      cleanupRecording();
      return;
    }

    const duration = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
    const levels = downsampleLevels(recordedLevelsRef.current, 40);

    mr.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      cleanupRecording();
      if (blob.size > 0) {
        await sendVoice(blob, duration, levels);
      }
    };
    mr.stop();
  }

  async function sendVoice(blob: Blob, duration: number, levels: number[]) {
    if (!userId || !activeContactId || !conversationId) return;

    pendingBottomScrollRef.current = true;
    pendingConvoRef.current = conversationId;
    followBottomFor(800, true, 'smooth');

    const replyId = replyToRef.current?.id ?? null;
    setReplyTo(null);

    setSendingVoice(true);
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const path = `${conversationId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('chat-voice')
        .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: false });

      if (upErr) {
        console.error(upErr);
        return;
      }

      const body = `voice:${path}:${duration}:${levels.join(',')}`;

      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body: encodeReplyBody(replyId, body),
      });

      setContacts((prev) => {
        const next = prev.map((c) =>
          c.id === activeContactId
            ? {
                ...c,
                subtitle: 'You: Sent a Voice Message',
                lastAt: new Date().toISOString(),
                lastSenderId: userId!,
              }
            : c
        );
        next.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
        return next;
      });

      if (msgErr) console.error(msgErr);
    } finally {
      setSendingVoice(false);
    }
  }

  React.useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      cleanupRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ---- end voice messages ----

  async function sendEscrowMessage(orderId: string) {
    if (!userId || !activeContactId || !conversationId) return;

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      receiver_id: activeContactId,

      body: `escrow:${orderId}`,
      message_type: "escrow",
    });

    if (error) console.error(error);
  }

  function dayKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatContactLastAt(iso?: string) {
    if (!iso) return '';

    const d = new Date(iso);
    const todayKey = dayKey(new Date());
    const dKey = dayKey(d);

    if (dKey === todayKey) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
  }
  
  function formatDayHeader(date: Date) {
    const dd = date.getDate();
    const mon = MONTH_ABBR[date.getMonth()];
    const yyyy = date.getFullYear();

    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    return `${dd} ${mon} ${yyyy} ${time}`;
  }

  function ellipsize(s: string, max = 13) {
    const t = String(s ?? '').trim();
    if (t.length <= max) return t;
    return t.slice(0, max) + '...';
  }

  const [loadedConvoId, setLoadedConvoId] = React.useState<string | null>(null);

  const msgRefs = React.useRef(new Map<string, HTMLDivElement | null>());
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const pendingBottomScrollRef = React.useRef(false);
  const lastMsgLenRef = React.useRef(0);
  const pendingConvoRef = React.useRef<string | null>(null);
  const [jumpOnOpen, setJumpOnOpen] = React.useState(false);
  const [scrollToBottomOnNext, setScrollToBottomOnNext] = React.useState(false);

  function scrollToMessage(id: string, behavior: ScrollBehavior = 'auto') {
    const el = msgRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior, block: 'center' });
  }

  const [contacts, setContacts] = React.useState<ContactListItem[]>([]);
  const [activeContactId, setActiveContactId] = React.useState<string | null>(null);
  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const [contactsError, setContactsError] = React.useState<string | null>(null);

  const hasContacts = contacts.length > 0;

  const [userId, setUserId] = React.useState<string | null>(null);
  const [dbMessages, setDbMessages] = React.useState<DbMessage[]>([]);

  // the real message arrived (realtime): drop the placeholder bubble
  React.useEffect(() => {
    if (pendingImages.length === 0) return;

    const bodies = new Set(dbMessages.map((m) => m.body));
    const done = pendingImages.filter((p) => p.path && bodies.has(`imgpath:${p.path}`));

    if (done.length > 0) {
      setPendingImages((prev) => prev.filter((p) => !done.some((d) => d.id === p.id)));
    }
  }, [dbMessages, pendingImages]);
  const router = useRouter();
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [q, setQ] = React.useState('');

  const filteredContacts = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return contacts;

    return contacts.filter((c) => {
      const username = (c.username ?? '').toLowerCase();
      const subtitle = (c.subtitle ?? '').toLowerCase();
      return username.includes(t) || subtitle.includes(t);
    });
  }, [q, contacts]);

  const [displayName, setDisplayName] = React.useState('User');
  const [avatarSrc, setAvatarSrc] = React.useState('/cat.png');
  const [loadingName, setLoadingName] = React.useState(true);

  // dropdown state
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuWrapRef = React.useRef<HTMLDivElement | null>(null);

  const [addOpen, setAddOpen] = React.useState(false);
  const [addOpenPhone, setAddOpenPhone] = React.useState(false);
  const [addStep, setAddStep] = React.useState<'enter' | 'confirm'>('enter');

  const [addUsername, setAddUsername] = React.useState('');
  const [addError, setAddError] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);

  const [loadingMsgs, setLoadingMsgs] = React.useState(false);

  const conversationId = React.useMemo(() => {
    if (!userId || !activeContactId) return null;
    return makeConversationId(userId, activeContactId);
  }, [userId, activeContactId]);

  const activeContact = React.useMemo(
    () => contacts.find((c) => c.id === activeContactId) ?? null,
    [contacts, activeContactId]
  );

  const [chatDraft, setChatDraft] = React.useState('');

  React.useEffect(() => {
    if (isRecording) cancelRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContactId]);

  const avatarFromUserId = React.useCallback((uid: string) => {
    const filePath = `${uid}.jpg`;
    const { data } = supabase.storage.from('profiles').getPublicUrl(filePath);
    return data.publicUrl || '/cat.png';
  }, [supabase]);

  const [found, setFound] = React.useState<null | { userId: string; username: string; avatar?: string }>(null);

  const addInputRef = React.useRef<HTMLInputElement | null>(null);

  // 2) HELPERS
  const openAdd = React.useCallback(() => {
    setAddOpen(true);
    setAddStep('enter');
    setAddUsername('');
    setAddError(null);
    setSearching(false);
    setFound(null);

    setTimeout(() => addInputRef.current?.focus(), 0);
  }, []);

  const openAddPhone = React.useCallback(() => {
    setAddOpenPhone(true);
    setAddStep('enter');
    setAddUsername('');
    setAddError(null);
    setSearching(false);
    setFound(null);

    setTimeout(() => addInputRef.current?.focus(), 0);
  }, []);
  
  const closeAdd = React.useCallback(() => {
    setAddOpen(false);
    setAddStep('enter');
    setAddError(null);
    setSearching(false);
    setFound(null);
  }, []);

  const closeAddPhone = React.useCallback(() => {
    setAddOpenPhone(false);
    setAddStep('enter');
    setAddError(null);
    setSearching(false);
    setFound(null);
  }, []);

  const [adding, setAdding] = React.useState(false);

  type LastMsg = {
    body: string;
    created_at: string;
    sender_id: string;
    read_at: string | null;
  };

  async function fetchLastMessagesForContacts(contactIds: string[]) {
    if (!userId || contactIds.length === 0)
      return new Map<string, LastMsg>();

    const convoIds = contactIds.map((cid) => makeConversationId(userId, cid));

    const { data, error } = await supabase
      .from('messages')
      .select('conversation_id, body, created_at, sender_id, read_at')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('fetchLastMessages error:', error);
      return new Map();
    }

    const map = new Map<string, LastMsg>();

    for (const row of (data ?? []) as any[]) {
      if (!map.has(row.conversation_id)) {
        map.set(row.conversation_id, {
          body: row.body ?? '',
          created_at: row.created_at,
          sender_id: row.sender_id,
          read_at: row.read_at ?? null,
        });
      }
    }

    return map;
  }

  async function onAddContact() {
    setAddError(null);

    if (!userId) {
      setAddError('Not logged in.');
      return;
    }
    if (!found?.userId) {
      setAddError('No contact selected.');
      return;
    }
    if (found.userId === userId) {
      setAddError("You can't add yourself.");
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          owner_id: userId,
          contact_id: found.userId,
        });

      if (error) {
        if (String(error.message).toLowerCase().includes('duplicate')) {
          setAddError('Already in your contacts.');
          return;
        }
        setAddError(error.message);
        return;
      }

      await fetchContacts();

      setAddOpen(false);
      setAddStep('enter');
      setFound(null);
      setAddUsername('');
    } finally {
      setAdding(false);
    }
  }

  async function onNext() {
    const uname = addUsername.trim().toLowerCase();
    setAddError(null);

    if (!uname) {
      setAddError('Please enter a username.');
      return;
    }
    if (!userId) {
      setAddError('Not logged in.');
      return;
    }

    setSearching(true);
    try {
      const { data: urow, error: uerr } = await supabase
        .from('usernames')
        .select('user_id, username')
        .eq('username', uname)
        .maybeSingle();

      if (uerr) {
        setAddError(uerr.message);
        return;
      }
      if (!urow?.user_id) {
        setAddError('Username not found.');
        return;
      }
      if (urow.user_id === userId) {
        setAddError("You can't add yourself.");
        return;
      }

      const { data: exists, error: exErr } = await supabase
        .from('contacts')
        .select('owner_id')
        .eq('owner_id', userId)
        .eq('contact_id', urow.user_id)
        .maybeSingle();

      if (exErr) {
        setAddError(exErr.message);
        return;
      }
      if (exists) {
        setAddError('Already in your contacts.');
        return;
      }

      const filePath = `${urow.user_id}.jpg`;
      const { data: pub } = supabase.storage.from('profiles').getPublicUrl(filePath);
      const publicUrl = pub.publicUrl;

      let avatar = '/cat.png';
      try {
        const head = await fetch(publicUrl, { method: 'HEAD', cache: 'no-store' });
        if (head.ok) avatar = publicUrl;
      } catch {}

      setFound({
        userId: urow.user_id,
        username: (urow.username ?? uname).trim(),
        avatar,
      });
      setAddStep('confirm');
    } finally {
      setSearching(false);
    }
  }

  async function connectPhantom() {
    try {
      const provider = (window as any).solana;

      if (!provider?.isPhantom) {
        pushToast("Please install Phantom Wallet");
        window.open('https://phantom.app/', '_blank');
        return;
      }

      setConnectingWallet(true);

      let publicKey;

      if (provider.isConnected && provider.publicKey) {
        publicKey = provider.publicKey.toString();
      } else {

        const resp = await provider.connect({ onlyIfTrusted: false });
        publicKey = resp.publicKey.toString();
      }

      if (!userId) throw new Error('User not logged in');

      // save wallet
      const { error } = await supabase
        .from('profiles')
        .update({ wallet_address: publicKey })
        .eq('id', userId);

      if (error) throw error;

      setMustConnectWallet(false);

    } catch (err) {
      console.error(err);
      reportError(err, "connect-wallet");
    } finally {
      setConnectingWallet(false);
    }
  }

  async function onSend() {
    const text = chatDraft.trim();
    if (!text || !userId || !activeContactId || !conversationId) return;

    const replyId = replyToRef.current?.id ?? null;
    setReplyTo(null);

    setChatDraft('');

    pendingBottomScrollRef.current = true;
    pendingConvoRef.current = conversationId;

    followBottomFor(500, true, 'smooth');

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      receiver_id: activeContactId,
      body: encodeReplyBody(replyId, text),
    });

    setContacts((prev) => {
      const next = prev.map((c) =>
        c.id === activeContactId
          ? { ...c, subtitle: `You: ${text}`, lastAt: new Date().toISOString(), lastSenderId: userId }
          : c
      );
      next.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
      return next;
    });

    if (error) {

      console.error(error);
    }
  }

  async function getWalletAddress(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("wallet_address")
      .eq("id", userId)
      .single();


    if (error) throw new Error(error.message);

    if (!data?.wallet_address) {
      throw new Error("User has not connected wallet yet");
    }

    return data.wallet_address;
  }

  async function uploadEscrowImage(
    file: File,
    sellerId: string,
    orderPda: string
  ) {

    const compressed = await compressImage(file, 1280, 0.8)

    const path = `${sellerId}/${orderPda}.jpg`

    const { error } = await supabase.storage
      .from("escrow")
      .upload(path, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      })

    if (error) throw error

    return path
  }

  async function uploadDigitalDeliveryFile(
    file: File,
    order: any
  ) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");

    const path = `${order.escrow_pda}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from("digital-delivery")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) throw error;

    return path;
  }

  async function fetchUnreadCountsForContacts(contactIds: string[]) {
    if (!userId || contactIds.length === 0) return new Map<string, number>();

    const convoIds = contactIds.map((cid) => makeConversationId(userId, cid));

    const { data, error } = await supabase
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convoIds)
      .eq('receiver_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('fetchUnreadCounts error:', error);
      return new Map();
    }

    const map = new Map<string, number>();
    for (const row of (data ?? []) as any[]) {
      map.set(row.conversation_id, (map.get(row.conversation_id) ?? 0) + 1);
    }
    return map;
  }

  function closeViewer() {
    restoringScrollRef.current = true;
    setViewer(null);
  }

  const prevLenRef = React.useRef(0);

  React.useEffect(() => {
    if (!conversationId) return;
    if (viewer) return;

    const prevLen = prevLenRef.current;
    const currLen = dbMessages.length;
    prevLenRef.current = currLen;

    if (currLen <= prevLen) return;

    const last = dbMessages[currLen - 1];
    if (!last) return;

    const isIncoming = last.receiver_id === userId;
    const shouldAutoScroll = isNearBottom() || isIncoming;

    if (!shouldAutoScroll) return;

    if (isImagePathMessage(last.body)) {
      pendingBottomScrollRef.current = true;
      pendingConvoRef.current = conversationId;
      return;
    }

    requestAnimationFrame(() => {
      scrollToBottomHard('smooth');
    });
  }, [dbMessages, conversationId, userId, viewer]);

  React.useEffect(()=>{

    const requested = new Set<string>()

    dbMessages.forEach(m=>{
      if(isEscrowMessage(m.body)){
        const orderId = m.body.slice(7)

        if(!escrowById[orderId] && !requested.has(orderId)){
          requested.add(orderId)
          loadEscrow(orderId)
        }
      } else if (m.body.startsWith('escrow_update:')) {
        const pda = m.body.split(':')[1]

        if(pda && !escrowById[pda] && !requested.has(pda)){
          requested.add(pda)
          loadEscrow(pda)
        }
      }
    })

  },[dbMessages])

  React.useEffect(() => {
    const prevLen = lastMsgLenRef.current;
    const currLen = dbMessages.length;

    if (
      pendingBottomScrollRef.current &&
      pendingConvoRef.current === conversationId &&
      currLen > prevLen
    ) {
      requestAnimationFrame(() => {
        followBottomFor(700, false);
      });
    }

    lastMsgLenRef.current = currLen;
  }, [dbMessages.length, conversationId]);

  React.useEffect(() => {
    if (!isMobile) return;
    if (!activeContactId) setMobileView('contacts');
  }, [isMobile, activeContactId]);

  React.useEffect(() => {
    let mounted = true;

    async function bootstrapAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      if (!mounted) return;

      if (!user) {
        setAuthReady(true);
        return;
      }

      // save user info
      setUserId(user.id);
      setDisplayName(pickDisplayName(user));

      const { data, error } = await supabase
        .from('profiles')
        .select('wallet_address, bio, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (!mounted) return;

      const profileAvatar =
        typeof data?.avatar_url === 'string' && data.avatar_url.trim()
          ? withCacheBust(data.avatar_url.trim())
          : pickAvatarUrl(user);

      setAvatarSrc(profileAvatar);
      setBio(typeof data?.bio === 'string' ? data.bio : "");
      setLoadingName(false);

      if (error) {
        console.warn("PROFILE_BOOTSTRAP_WARNING:", error);
      }

      if (!data?.wallet_address) {
        setMustConnectWallet(true);
      } else {
        setMustConnectWallet(false);
      }

      setWalletChecked(true);
      setAuthReady(true);
    }

    bootstrapAuth();

    // listen login/logout realtime
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      bootstrapAuth();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // close dropdown when click outside + Esc
  React.useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!menuOpen) return;
      const el = menuWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!menuOpen) return;
      if (e.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function onLogout() {
    setMenuOpen(false);
    await supabase.auth.signOut();
    router.refresh();
  }

  React.useEffect(() => {
    chatPositionReadyRef.current = null;

    if (!conversationId) {
      setDbMessages([]);
      lastMsgLenRef.current = 0;
      pendingBottomScrollRef.current = false;
      pendingConvoRef.current = conversationId;
      setLoadedConvoId(null);
      return;
    }

    let alive = true;

    (async () => {
      setLoadingMsgs(true);
      setLoadedConvoId(null);
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, body, created_at, read_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!alive) return;
      if (!error) setDbMessages((data ?? []).map(normalizeDbMessage));
      setLoadingMsgs(false);
      setLoadedConvoId(conversationId);
    })();

  const channel = supabase
    .channel(`room:${conversationId}`)

    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = normalizeDbMessage(payload.new);
        setDbMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));

        const changedPda = row.body.startsWith('escrow_update:')
          ? row.body.split(':')[1]
          : row.body.startsWith('escrow:')
          ? row.body.slice(7)
          : null;
        if (changedPda) {
          refreshEscrowRowsRef.current?.([changedPda]);
          // the sender updates the row right before posting the message; this
          // second pass covers a replica that is a moment behind
          window.setTimeout(() => refreshEscrowRowsRef.current?.([changedPda]), 1500);
        }
      }
    )

    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as DbMessage;

        setDbMessages((prev) =>
          prev.map((m) => (m.id === row.id ? { ...m, read_at: row.read_at } : m))
        );
      }
    )
    .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, userId]);

  React.useEffect(() => {
    if (!jumpOnOpen) return;
    if (!activeContactId || !userId || !conversationId) return;

    if (loadedConvoId !== conversationId) return;

    const firstUnreadIncoming = dbMessages.find(
      (m) => m.receiver_id === userId && m.read_at === null
    );

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (firstUnreadIncoming) {
          scrollToMessage(firstUnreadIncoming.id, 'auto');
          markChatPositionReadySoon(conversationId);
        } else if (!restoreChatPositionStable(conversationId)) {
          scrollToBottomHard('auto');
          markChatPositionReadySoon(conversationId);
        }

        markConversationRead(activeContactId);
        setJumpOnOpen(false);
      });
    });
  }, [
    jumpOnOpen,
    activeContactId,
    userId,
    conversationId,
    loadedConvoId,
    dbMessages,
  ]);

  React.useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const row = payload.new as DbMessage;

          if (row.sender_id !== userId && row.receiver_id !== userId) return;

          const otherId = row.sender_id === userId ? row.receiver_id : row.sender_id;

          const incomingToMe = row.receiver_id === userId;
          const isActiveRoom = otherId === activeContactId;

          setContacts((prev) => {
            if (!prev.some((c) => c.id === otherId)) return prev;

            const next = prev.map((c) => {
              if (c.id !== otherId) return c;

              const base = {
                ...c,
                subtitle: lastPreviewText(row.body ?? '', row.sender_id === userId),
                lastAt: row.created_at,
                lastSenderId: row.sender_id,
                lastReadAt: row.read_at ?? null,
              };

              if (incomingToMe && !isActiveRoom) {
                return { ...base, unreadCount: (c.unreadCount ?? 0) + 1 };
              }

              if (incomingToMe && isActiveRoom) {
                return { ...base, unreadCount: 0 };
              }

              return base;
            });

            next.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
            return next;
          });

          if (incomingToMe && isActiveRoom) {
            setScrollToBottomOnNext(true);
            markConversationRead(otherId);
          }
        }
      )
      .subscribe((status) => {
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, activeContactId]);

  const [solPrice, setSolPrice] = React.useState<number>(0);

  React.useEffect(() => {
    async function loadPrice() {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        const data = await res.json();
        setSolPrice(data.solana.usd);
      } catch (err) {
        console.error(err);
      }
    }

    loadPrice();
  }, []);

  const fetchContacts = React.useCallback(async () => {
    if (!userId) return;

    setLoadingContacts(true);
    setContactsError(null);

    try {
      const { data: rows, error: cErr } = await supabase
        .from('contacts')
        .select('contact_id, created_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (cErr) throw cErr;

      const ids = (rows ?? [])
        .map((r: any) => r.contact_id as string)
        .filter(Boolean);

      if (ids.length === 0) {
        setContacts([]);
        setActiveContactId(null);
        return;
      }

      const { data: urows, error: uErr } = await supabase
        .from('usernames')
        .select('user_id, username')
        .in('user_id', ids);

      if (uErr) throw uErr;

      const usernameById = new Map<string, string>();
      (urows ?? []).forEach((u: any) => {
        if (u?.user_id) usernameById.set(u.user_id, (u.username ?? '').trim());
      });

      const lastByConvo = await fetchLastMessagesForContacts(ids);

      const unreadByConvo = await fetchUnreadCountsForContacts(ids);

      const list: ContactListItem[] = ids.map((id) => {
        const convoId = makeConversationId(userId, id);
        const last = lastByConvo.get(convoId);

        const body = (last?.body ?? '').trim();
        const senderId = last?.sender_id;

        const subtitle = body ? lastPreviewText(body, senderId === userId) : '';

        return {
          id,
          username: usernameById.get(id) || 'Unknown',
          avatar: avatarFromUserId(id),
          subtitle,
          lastAt: last?.created_at,
          lastSenderId: senderId,
          lastReadAt: last?.read_at ?? null,
          unreadCount: unreadByConvo.get(convoId) ?? 0,
        };
      });

      list.sort((a, b) => (b.lastAt ?? '').localeCompare(a.lastAt ?? ''));
      setContacts(list);
    } catch (e: any) {
      setContactsError(e?.message || 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [supabase, userId, avatarFromUserId]);

  React.useEffect(() => {
    if (!userId) return;
    fetchContacts();
  }, [userId, fetchContacts]);

  // ---------- reply to message ----------
  const [replyTo, setReplyTo] = React.useState<DbMessage | null>(null);
  const replyToRef = React.useRef<DbMessage | null>(null);
  replyToRef.current = replyTo;
  const chatInputRef = React.useRef<HTMLInputElement | null>(null);
  const [flashId, setFlashId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReplyTo(null);
  }, [conversationId]);

  function startReply(m: DbMessage) {
    setReplyTo(m);
    requestAnimationFrame(() => {
      chatInputRef.current?.focus({ preventScroll: true });
      followBottomFor(400, false, 'auto');
    });
  }

  function jumpToMessage(id: string) {
    scrollToMessage(id, 'smooth');
    setFlashId(id);
    window.setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1400);
  }

  // orderId -> id of the chat message that holds that escrow card
  const escrowMsgIdByOrder = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of dbMessages) {
      if (isEscrowMessage(m.body)) map[m.body.slice(7)] = m.id;
    }
    return map;
  }, [dbMessages]);

  function getReplySnippet(m: DbMessage | null | undefined): ReplySnippet {
    if (!m) return { kind: 'missing', text: 'Original message unavailable' };
    const b = m.body;
    if (isImagePathMessage(b)) return { kind: 'image', text: 'Photo' };
    if (isVoiceMessage(b)) {
      const { duration } = parseVoiceBody(b);
      return { kind: 'voice', text: `Voice message · ${formatVoiceDuration(duration)}` };
    }
    if (isEscrowMessage(b)) {
      const o = escrowById[b.slice(7)];
      return { kind: 'escrow', text: o?.order_name ? `Escrow: ${o.order_name}` : 'Escrow' };
    }
    if (b.startsWith('escrow_update:')) {
      const [, pda, action] = b.split(':');
      return { kind: 'update', text: getEscrowUpdateInfo(action, escrowById[pda], userId).text };
    }
    return { kind: 'text', text: b };
  }

  function replyAuthorLabel(m: DbMessage) {
    if (m.body.startsWith('escrow_update:')) return 'Escrow update';
    if (m.sender_id === userId) return 'You';
    return activeContact?.username || 'User';
  }

  // ---------- remember chat position (survives leaving the chat) ----------
  //
  // We remember, per conversation, which message sits at the top of the
  // viewport (+ its pixel offset). It is kept in memory and in localStorage,
  // so it survives: opening the escrow flow / escrow list / image viewer
  // (which unmount the message list), switching contacts, going to /docs,
  // and reloading the page.
  type SavedChatPos = { anchorId: string; offset: number; atBottom: boolean };
  const chatPosMemRef = React.useRef<Record<string, SavedChatPos>>({});
  const chatPositionReadyRef = React.useRef<string | null>(null);
  const chatCaptureRafRef = React.useRef<number | null>(null);
  const chatPersistTimerRef = React.useRef<number | null>(null);

  const chatPosKey = (convId: string) => `chat:pos:${convId}`;

  function readSavedChatPos(convId: string): SavedChatPos | null {
    const mem = chatPosMemRef.current[convId];
    if (mem) return mem;
    try {
      const raw = window.localStorage.getItem(chatPosKey(convId));
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (p && typeof p.anchorId === 'string' && typeof p.offset === 'number') {
        const clean: SavedChatPos = { anchorId: p.anchorId, offset: p.offset, atBottom: !!p.atBottom };
        chatPosMemRef.current[convId] = clean;
        return clean;
      }
    } catch {}
    return null;
  }

  function persistChatPos(convId: string) {
    const p = chatPosMemRef.current[convId];
    if (!p) return;
    try {
      window.localStorage.setItem(chatPosKey(convId), JSON.stringify(p));
    } catch {}
  }

  function captureChatPosition() {
    const el = chatScrollRef.current;
    const convId = conversationId;
    if (!el || !convId || chatPositionReadyRef.current !== convId) return;
    if (dbMessages.length === 0) return;

    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    const top = el.getBoundingClientRect().top;
    const bottomOf = (i: number) =>
      msgRefs.current.get(dbMessages[i].id)?.getBoundingClientRect().bottom ?? null;

    // binary search: first message whose bottom edge is below the viewport top
    let lo = 0;
    let hi = dbMessages.length - 1;
    let idx = dbMessages.length - 1;
    let broken = false;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = bottomOf(mid);
      if (b === null) {
        broken = true;
        break;
      }
      if (b > top + 1) {
        idx = mid;
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    if (broken) {
      idx = dbMessages.findIndex((m) => {
        const b = msgRefs.current.get(m.id)?.getBoundingClientRect().bottom;
        return b !== undefined && b > top + 1;
      });
      if (idx === -1) return;
    }

    const anchor = dbMessages[idx];
    const node = msgRefs.current.get(anchor.id);
    if (!node) return;

    chatPosMemRef.current[convId] = {
      anchorId: anchor.id,
      offset: node.getBoundingClientRect().top - top,
      atBottom,
    };

    if (chatPersistTimerRef.current !== null) window.clearTimeout(chatPersistTimerRef.current);
    chatPersistTimerRef.current = window.setTimeout(() => {
      chatPersistTimerRef.current = null;
      persistChatPos(convId);
    }, 250);
  }

  function onChatScroll() {
    if (chatCaptureRafRef.current !== null) return;
    chatCaptureRafRef.current = requestAnimationFrame(() => {
      chatCaptureRafRef.current = null;
      captureChatPosition();
    });
  }

  function flushChatPosition() {
    captureChatPosition();
    if (conversationId) persistChatPos(conversationId);
  }

  function markChatPositionReadySoon(convId: string | null) {
    window.setTimeout(() => {
      chatPositionReadyRef.current = convId;
    }, 350);
  }

  // Puts the list back where the user left it. Re-applies for a short moment
  // so late-loading images above the anchor don't push it away.
  // Returns false when nothing was saved for this conversation.
  function restoreChatPositionStable(convId: string): boolean {
    const el = chatScrollRef.current;
    const saved = readSavedChatPos(convId);
    if (!el || !saved) return false;
    if (!saved.atBottom && !msgRefs.current.get(saved.anchorId)) return false;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    el.addEventListener('wheel', cancel, { passive: true });
    el.addEventListener('touchstart', cancel, { passive: true });

    const apply = () => {
      const prev = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      if (saved.atBottom) {
        el.scrollTop = el.scrollHeight;
      } else {
        const node = msgRefs.current.get(saved.anchorId);
        if (node) {
          el.scrollTop += node.getBoundingClientRect().top - el.getBoundingClientRect().top - saved.offset;
        }
      }
      el.style.scrollBehavior = prev;
    };

    const start = performance.now();
    const tick = () => {
      if (cancelled || performance.now() - start > 900) {
        el.removeEventListener('wheel', cancel);
        el.removeEventListener('touchstart', cancel);
        chatPositionReadyRef.current = convId;
        return;
      }
      apply();
      requestAnimationFrame(tick);
    };
    tick();
    return true;
  }

  // The message list is unmounted whenever another screen takes over the
  // right-hand side (fund / refund / respond / cancel / review / upload /
  // download / success screens, the escrow flow, the escrow list, the image
  // viewer ...). Instead of listing every one of those screens, we watch the
  // scroll container itself: every time a NEW container is mounted for an
  // already-loaded conversation, put it back where the user left it.
  const [chatScrollEl, setChatScrollEl] = React.useState<HTMLDivElement | null>(null);
  const bindChatScroll = React.useCallback((el: HTMLDivElement | null) => {
    chatScrollRef.current = el;
    setChatScrollEl(el);
  }, []);
  const restoredForElRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!chatScrollEl) {
      chatPositionReadyRef.current = null;
      restoredForElRef.current = null;
      return;
    }
    if (restoredForElRef.current === chatScrollEl) return;

    const convId = conversationId;
    if (!convId || loadedConvoId !== convId) return;

    restoredForElRef.current = chatScrollEl;

    // Opening a chat from the contact list / the image viewer have their own
    // restore logic.
    if (jumpOnOpen || restoringScrollRef.current) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!restoreChatPositionStable(convId)) {
          scrollToBottomHard('auto');
          chatPositionReadyRef.current = convId;
        }
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatScrollEl, conversationId, loadedConvoId, jumpOnOpen]);

  // Save on tab hide / page leave, and when AppHome unmounts.
  React.useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushChatPosition();
    };
    const onPageHide = () => flushChatPosition();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      Object.keys(chatPosMemRef.current).forEach((id) => persistChatPos(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, dbMessages]);

  // Remember which chat was open, and reopen it after coming back to the app.
  const lastContactKey = userId ? `chat:lastContact:${userId}` : null;

  React.useEffect(() => {
    if (!lastContactKey || !activeContactId) return;
    try {
      window.localStorage.setItem(lastContactKey, activeContactId);
    } catch {}
  }, [lastContactKey, activeContactId]);

  const restoredLastContactRef = React.useRef(false);
  React.useEffect(() => {
    if (!lastContactKey || restoredLastContactRef.current) return;
    if (loadingContacts || contacts.length === 0) return;

    restoredLastContactRef.current = true;
    if (activeContactId) return;

    try {
      const lastId = window.localStorage.getItem(lastContactKey);
      if (lastId && contacts.some((c) => c.id === lastId)) {
        setActiveContactId(lastId);
        setJumpOnOpen(true);
        if (isMobile) setMobileView('chat');
      }
    } catch {}
  }, [lastContactKey, contacts, loadingContacts, activeContactId, isMobile]);

  // ---------- keep escrow cards in sync (realtime + fallbacks) ----------
  //
  // `escrowById` is a cache of escrow_orders rows. It used to be filled once
  // and only updated by the user's OWN actions, so the other person kept
  // seeing the old buttons until they refreshed the page. It is now refreshed
  //   1. by Supabase realtime on escrow_orders (needs the table in the
  //      supabase_realtime publication),
  //   2. whenever an escrow / escrow_update chat message arrives,
  //   3. when the chat is opened / new escrow messages appear,
  //   4. every 15s while the tab is visible, and when the tab regains focus.
  const escrowIdsKey = React.useMemo(() => {
    const ids = new Set<string>();
    for (const m of dbMessages) {
      if (m.body.startsWith('escrow:')) ids.add(m.body.slice(7));
      else if (m.body.startsWith('escrow_update:')) {
        const pda = m.body.split(':')[1];
        if (pda) ids.add(pda);
      }
    }
    return Array.from(ids).join(',');
  }, [dbMessages]);

  async function refreshEscrowRows(pdas: string[]) {
    const ids = Array.from(new Set(pdas.filter(Boolean)));
    if (ids.length === 0) return;

    const { data, error } = await supabase
      .from('escrow_orders')
      .select('*')
      .in('escrow_pda', ids);

    if (error || !data) {
      if (error) console.error('refreshEscrowRows error:', error);
      return;
    }

    setEscrowById((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const row of data as any[]) {
        const old = prev[row.escrow_pda];
        if (!old || Object.keys(row).some((k) => old[k] !== row[k])) {
          next[row.escrow_pda] = { ...old, ...row };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }
  refreshEscrowRowsRef.current = refreshEscrowRows;

  React.useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`escrow-orders:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'escrow_orders',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row?.escrow_pda) return;
          setEscrowById((prev) => ({ ...prev, [row.escrow_pda]: { ...prev[row.escrow_pda], ...row } }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  React.useEffect(() => {
    if (!conversationId || loadedConvoId !== conversationId || !escrowIdsKey) return;
    refreshEscrowRowsRef.current?.(escrowIdsKey.split(','));
  }, [conversationId, loadedConvoId, escrowIdsKey]);

  React.useEffect(() => {
    if (!conversationId || !escrowIdsKey) return;

    const ids = escrowIdsKey.split(',');
    const tick = () => {
      if (document.visibilityState === 'visible') refreshEscrowRowsRef.current?.(ids);
    };

    const timer = window.setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [conversationId, escrowIdsKey]);

  const canSend = chatDraft.trim().length > 0;

  async function markConversationRead(contactId: string) {
    if (!userId) return;
    const convoId = makeConversationId(userId, contactId);

    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convoId)
      .eq('receiver_id', userId)
      .is('read_at', null);

    if (error) console.error('markConversationRead error:', error);

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, unreadCount: 0, lastReadAt: new Date().toISOString() }
          : c
      )
    );
  }

  const showWalletGate =
    authReady &&
    walletChecked &&
    mustConnectWallet;


  const [createdTx, setCreatedTx] = React.useState<string | null>(null)

  async function createEscrowOrderChain() {
    if (!activeContact || !userId) {
      pushToast("No active chat");
      return
    }
    try {
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const buyer = new PublicKey(
        await getWalletAddress(activeContact.id)
      )

      const [sellerPda] = getSellerPDA(seller)

      const sellerAccountClient = program.account.sellerAccount

      // fetchNullable: only "account does not exist" means "not initialised".
      // Any other failure (network hiccup ...) must not trigger initSeller.
      let sellerAccount: any = await sellerAccountClient.fetchNullable(sellerPda)

      if (!sellerAccount) {
        await program.methods
          .initSeller()
          .accounts({
            sellerAccount: sellerPda,
            seller: seller,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()

        // the new account can take a moment to be visible on every RPC node
        sellerAccount = await retryAsync(() => sellerAccountClient.fetch(sellerPda), 8, 700)
      }

      const orderIndex = sellerAccount.orderCount as anchor.BN

      const sellerWallet = await getWalletAddress(userId);
      const buyerWallet  = await getWalletAddress(activeContact.id);

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const mode = escrowDraft.disputeMode === "BTR" ? 0 : 1
      const productType = escrowDraft.type === "physical" ? 0 : 1

      if (productType === 1 && mode !== 0) {
        throw new Error("Digital product must use BTR mode")
      }

      let shippingHours: number

      if (escrowDraft.type === "digital") {
        shippingHours = Number(escrowDraft.shipTime || 0)
      } else {
        if (!escrowDraft.shipDate) {
          throw new Error("Shipping date missing")
        }

        const now = new Date()

        // end of selected day
        const deadline = new Date(escrowDraft.shipDate)
        deadline.setHours(23, 59, 59, 999)

        const diffMs = deadline.getTime() - now.getTime()

        shippingHours = Math.ceil(diffMs / (1000 * 60 * 60))

        if (shippingHours <= 0) {
          throw new Error("Shipping date already passed")
        }

        if (shippingHours > 720) {
          throw new Error("Physical shipping must be <= 720 hours")
        }
      }

      if (productType === 1) {
        if (shippingHours <= 0 || shippingHours > 48) {
          throw new Error("Digital shipping must be between 1-48 hours")
        }
      }

      if (productType === 0) {
        if (shippingHours <= 0 || shippingHours > 720) {
          throw new Error("Physical shipping must be between 1-720 hours")
        }
      }

      if (shippingHours > 720) {
        throw new Error("Shipping too long")
      }

      const priceLamports = usdToLamportsBN(escrowDraft.price, solPrice)

      const tx =  await program.methods
        .createOrder(
          orderIndex,
          mode,
          productType,
          escrowDraft.orderName,
          buyer,
          priceLamports,
          shippingHours
        )
        .accounts({
          sellerAccount: sellerPda,
          order: orderPda,
          seller: seller,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc()


      // This IS the index of the order we just created (the order PDA above is
      // derived from it). Re-reading `orderCount - 1` from the chain could hit a
      // node that hasn't seen the new block yet and store the PREVIOUS index.
      const realOrderIndex = orderIndex

      if (!escrowDraft.imageFile)
        throw new Error("Image file missing")

      const imagePath = await uploadEscrowImage(
        escrowDraft.imageFile,
        userId,
        orderPda.toString()
      )

      const { error: orderInsertError } = await supabase.from("escrow_orders").insert({
        escrow_pda: orderPda.toString(),
        tx_signature: tx,
        seller_id: userId,
        buyer_id: activeContact.id,
        type: escrowDraft.type,
        dispute_mode: escrowDraft.disputeMode,
        description: escrowDraft.description,
        price_usd: Number(escrowDraft.price),
        ship_date: escrowDraft.shipDate || null,
        ship_time_hours: escrowDraft.shipTime || null,
        conversation_id: conversationId,
        seller_name: displayName,
        seller_wallet: sellerWallet,
        buyer_name: activeContact.username,
        buyer_wallet: buyerWallet,
        order_name: escrowDraft.orderName,
        order_index: realOrderIndex.toString(),

        image_path: imagePath,

        status: "onchain_created",
      })

      if (orderInsertError) {
        console.error("escrow_orders insert error:", orderInsertError)
        throw new Error(
          `Escrow created on-chain (tx: ${tx}), but saving the order failed: ${orderInsertError.message || "database error"}`
        )
      }

      setEscrowStep('success')
      setCreatedTx(tx)

      await loadEscrow(orderPda.toString())

      await sendEscrowMessage(orderPda.toString());

    } catch (err:any) {
      reportError(err, "create-escrow-order");
    }
  }

  async function createNftListingOnChain() {
    if (!activeContact || !userId) {
      pushToast("No active chat");
      return
    }
    try {
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const mint = new PublicKey(escrowDraft.nftMint)

      // Defense in depth: handleFetchNft checks this too when the user
      // first loads the NFT, but escrowDraft.nftMint can end up here
      // through other paths (stale state, a different entry point,
      // etc). Check again right before building the transaction, and
      // use it to pick which on-chain instruction set applies.
      const nftKind = await resolveNftKind(program.provider.connection, mint);

      const sellerWallet = await getWalletAddress(userId);
      const buyerWallet  = await getWalletAddress(activeContact.id);

      // ---------- listing nonce + PDA ----------
      const [listingCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("nft_listing_counter"), seller.toBuffer(), mint.toBuffer()],
        program.programId
      );

      const listingCounterAccount = await (program.account as any).nftListingCounter.fetchNullable(listingCounterPda);
      const listingNonce = listingCounterAccount
        ? (listingCounterAccount.nextNonce as anchor.BN)
        : new anchor.BN(0);

      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("nft_listing"),
          seller.toBuffer(),
          mint.toBuffer(),
          listingNonce.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const priceLamports = usdToLamportsBN(escrowDraft.price, solPrice)

      let tx: string;

      if (nftKind.kind === "spl") {
        // Must derive with the mint's actual token program (classic SPL
        // Token or Token-2022) — the ATA address differs between the two.
        const sellerNftAta = getAssociatedTokenAddressSync(mint, seller, false, nftKind.tokenProgram)
        const vaultNftAta = getAssociatedTokenAddressSync(mint, listingPda, true, nftKind.tokenProgram)

        tx = await program.methods
          .listNft(priceLamports)
          .accounts({
            listingCounter: listingCounterPda,
            listing: listingPda,
            mint,
            sellerNftAta,
            vaultNftAta,
            seller,
            tokenProgram: nftKind.tokenProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()
      } else {
        // Metaplex Core: no mint/ATA — ownership moves directly via CPI.
        // Pass the real collection account if there is one, otherwise
        // the mpl-core program id itself as the "no collection" sentinel
        // the on-chain instruction expects.
        const collectionOrProgram = nftKind.collection ?? MPL_CORE_PROGRAM_ID;

        tx = await program.methods
          .listCoreNft(priceLamports)
          .accounts({
            listingCounter: listingCounterPda,
            listing: listingPda,
            asset: mint,
            collectionOrProgram,
            seller,
            mplCoreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()
      }

      if (!escrowDraft.imageFile)
        throw new Error("Image file missing")

      const imagePath = await uploadEscrowImage(
        escrowDraft.imageFile,
        userId,
        listingPda.toString()
      )

      const { error: insertError } = await supabase.from("escrow_orders").insert({
        escrow_pda: listingPda.toString(),
        tx_signature: tx,
        seller_id: userId,
        buyer_id: activeContact.id,
        type: "nft",
        dispute_mode: null,
        description: escrowDraft.description,
        price_usd: Number(escrowDraft.price),
        ship_date: null,
        ship_time_hours: null,
        conversation_id: conversationId,
        seller_name: displayName,
        seller_wallet: sellerWallet,
        buyer_name: activeContact.username,
        buyer_wallet: buyerWallet,
        order_name: escrowDraft.orderName,
        order_index: null,
        nft_mint: mint.toString(),

        image_path: imagePath,

        status: "onchain_created",
      })

      if (insertError) {
        console.error("escrow_orders insert error:", insertError);
        throw new Error(
          `NFT listed on-chain (tx: ${tx}), but saving the order failed: ${insertError.message || "database error"}. ` +
          `The listing exists on-chain — check that your escrow_orders table has an "nft_mint" column and that dispute_mode/ship_date/ship_time_hours/order_index allow NULL.`
        );
      }

      setEscrowStep('success')
      setCreatedTx(tx)

      await loadEscrow(listingPda.toString())

      await sendEscrowMessage(listingPda.toString());

    } catch (err:any) {
      reportError(err, "create-nft-listing");
    }
  }

  async function buyNftOnChain(order: any) {
    try {
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const buyer = wallet.publicKey
      const seller = new PublicKey(order.seller_wallet)
      const mint = new PublicKey(order.nft_mint)

      // Same defense-in-depth check as createNftListingOnChain, in
      // case a listing for an unsupported mint type ever made it into
      // the database (e.g. from before this check existed). Also used
      // to pick which on-chain instruction set applies.
      const nftKind = await resolveNftKind(program.provider.connection, mint);

      // ---------- active listing PDA ----------
      const listings = await (program.account.nftListing as any).all([
        { memcmp: { offset: 8, bytes: seller.toBase58() } },
        { memcmp: { offset: 40, bytes: mint.toBase58() } },
      ]);

      const activeListing = listings.find((x: any) => Number(x.account.state) === 0);
      if (!activeListing) {
        throw new Error("Active NFT listing not found");
      }

      const listingNonce = activeListing.account.nonce as anchor.BN;
      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("nft_listing"),
          seller.toBuffer(),
          mint.toBuffer(),
          listingNonce.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      let tx: string;

      if (nftKind.kind === "spl") {
        // ---------- vault ATA (authority = listing PDA) and buyer's destination ATA ----------
        const vaultNftAta = getAssociatedTokenAddressSync(mint, listingPda, true, nftKind.tokenProgram)
        const buyerNftAta = getAssociatedTokenAddressSync(mint, buyer, false, nftKind.tokenProgram)

        tx = await program.methods
          .buyNft()
          .accounts({
            listing: listingPda,
            mint,
            vaultNftAta,
            buyerNftAta,
            buyer,
            seller,
            feeWallet: NFT_FEE_WALLET,
            tokenProgram: nftKind.tokenProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()
      } else {
        const collectionOrProgram = nftKind.collection ?? MPL_CORE_PROGRAM_ID;

        tx = await program.methods
          .buyCoreNft()
          .accounts({
            listing: listingPda,
            asset: mint,
            collectionOrProgram,
            buyer,
            seller,
            feeWallet: NFT_FEE_WALLET,
            mplCoreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()
      }

      const { error: updateError } = await supabase
        .from("escrow_orders")
        .update({ status: "Completed", tx_signature: tx })
        .eq("escrow_pda", order.escrow_pda)

      if (updateError) {
        console.error("escrow_orders update error:", updateError);
      }

      setEscrowById(prev => ({
        ...prev,
        [order.escrow_pda]: {
          ...prev[order.escrow_pda],
          status: "Completed",
          tx_signature: tx,
        }
      }))

      setBuyNftSuccessTx(tx)

    } catch (err:any) {
      reportError(err, "buy-nft");
    }
  }

  async function cancelNftListingOnChain(order: any) {
    try {
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const mint = new PublicKey(order.nft_mint)

      // Same defense-in-depth check as create/buy. Also used to pick
      // which on-chain instruction set applies.
      const nftKind = await resolveNftKind(program.provider.connection, mint);

      // ---------- active listing PDA ----------
      const listings = await (program.account.nftListing as any).all([
        { memcmp: { offset: 8, bytes: seller.toBase58() } },
        { memcmp: { offset: 40, bytes: mint.toBase58() } },
      ]);

      const activeListing = listings.find((x: any) => Number(x.account.state) === 0);
      if (!activeListing) {
        throw new Error("Active NFT listing not found");
      }

      const listingNonce = activeListing.account.nonce as anchor.BN;
      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("nft_listing"),
          seller.toBuffer(),
          mint.toBuffer(),
          listingNonce.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      let tx: string;

      if (nftKind.kind === "spl") {
        // ---------- vault ATA (authority = listing PDA) and seller's return ATA ----------
        const vaultNftAta = getAssociatedTokenAddressSync(mint, listingPda, true, nftKind.tokenProgram)
        const sellerNftAta = getAssociatedTokenAddressSync(mint, seller, false, nftKind.tokenProgram)

        tx = await program.methods
          .cancelNftListing()
          .accounts({
            listing: listingPda,
            mint,
            vaultNftAta,
            sellerNftAta,
            seller,
            tokenProgram: nftKind.tokenProgram,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()
      } else {
        const collectionOrProgram = nftKind.collection ?? MPL_CORE_PROGRAM_ID;

        tx = await program.methods
          .cancelCoreNft()
          .accounts({
            listing: listingPda,
            asset: mint,
            collectionOrProgram,
            seller,
            mplCoreProgram: MPL_CORE_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc()
      }

      const { error: updateError } = await supabase
        .from("escrow_orders")
        .update({ status: "Cancelled", tx_signature: tx })
        .eq("escrow_pda", order.escrow_pda)

      if (updateError) {
        console.error("escrow_orders update error:", updateError);
      }

      setEscrowById(prev => ({
        ...prev,
        [order.escrow_pda]: {
          ...prev[order.escrow_pda],
          status: "Cancelled",
          tx_signature: tx,
        }
      }))

      setSellerCancelSuccessTx(tx)

    } catch (err:any) {
      reportError(err, "seller-cancel");
    }
  }

  // ---------- helpers shared by the on-chain handlers ----------

  async function updateEscrowRow(pda: string, patch: Record<string, any>) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from("escrow_orders").update(patch).eq("escrow_pda", pda)
      if (!error) return true
      console.error("escrow_orders update error:", error)
      await sleep(700)
    }
    return false
  }

  async function postEscrowUpdateMessage(pda: string, action: string, opts: { dedupe?: boolean } = {}) {
    if (!userId || !activeContactId || !conversationId) return

    const body = `escrow_update:${pda}:${action}`

    if (opts.dedupe) {
      const { data } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("body", body)
        .limit(1)
      if (data && data.length > 0) return
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body,
        message_type: "escrow_update",
      })
      if (!error) return
      console.error("escrow update message insert error:", error)
      await sleep(700)
    }
  }

  function patchEscrowLocal(pda: string, patch: Record<string, any>) {
    setEscrowById(prev => ({ ...prev, [pda]: { ...prev[pda], ...patch } }))
  }

  // Reads the Order account. With `ready` it keeps polling until the account
  // shows the expected change — right after a confirmed transaction the RPC
  // node that answers can still be one block behind.
  async function readOrderFromChain(order: any, ready?: (acct: any) => boolean, tries = 8) {
    try {
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)
      const [orderPda] = getOrderPDA(new PublicKey(order.seller_wallet), new anchor.BN(order.order_index))

      let last: any = null
      for (let i = 0; i < tries; i++) {
        try {
          const acct = await program.account.order.fetch(orderPda)
          last = acct
          if (!ready || ready(acct)) return acct
        } catch {
          // not visible yet
        }
        await sleep(700)
      }
      return last
    } catch {
      return null
    }
  }

  // ---------- buyer: fund ----------

  async function fundEscrowOnChain(order:any) {
    let tx: string | null = null

    try {
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = new PublicKey(order.seller_wallet)
      const buyer = wallet.publicKey

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      tx = await program.methods
        .buyerFundEscrow(orderIndex)
        .accounts({
          order: orderPda,
          escrow: escrowPda,
          buyer: buyer,
          seller: seller,
          feeWallet: NFT_FEE_WALLET,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .rpc()

      setFundSuccessTx(tx)

      const patch = { status: "BuyerFunded", funded_tx: tx }
      await updateEscrowRow(order.escrow_pda, patch)
      patchEscrowLocal(order.escrow_pda, patch)

      await postEscrowUpdateMessage(order.escrow_pda, "buyer_funded")

    } catch(err:any) {
      // An earlier attempt already funded it on-chain but never reached the DB.
      if (!tx && getContractErrorName(err) === "AlreadyFunded" && order.status === "onchain_created") {
        const patch = { status: "BuyerFunded" }
        await updateEscrowRow(order.escrow_pda, patch)
        patchEscrowLocal(order.escrow_pda, patch)
        await postEscrowUpdateMessage(order.escrow_pda, "buyer_funded", { dedupe: true })
        pushToast("This escrow was already funded — status updated.", "info")
        return
      }

      if (isAlreadyDoneError(err)) refreshEscrowRows([order.escrow_pda])
      reportError(err, "buyer-fund-escrow");
    }
  }

  // ---------- seller: fund ----------

  // `tx` = the transaction we just sent. `null` = recovery: the chain says it
  // was already funded but the DB/chat never heard about it.
  async function finishSellerFund(order:any, tx: string | null) {
    const acct = await readOrderFromChain(order, (o) => bnToNum(o.sellerFundedAt) > 0)
    const chainFundedAt = acct ? bnToNum(acct.sellerFundedAt) : 0

    if (!tx && chainFundedAt <= 0) return false

    const fundedAt = chainFundedAt > 0 ? chainFundedAt : Math.floor(Date.now() / 1000)
    const chainHours = acct ? Number(acct.shippingHours) : 0
    const hours = chainHours > 0 ? chainHours : fallbackShippingHours(order, fundedAt)
    const deadline = fundedAt + hours * 3600

    if (tx) openSellerFundSuccess(tx, deadline)

    const patch: Record<string, any> = {
      status: "Shipping",
      shipping_deadline: deadline,
      seller_funded_at_unix: fundedAt,
    }
    if (tx) patch.seller_funded_tx = tx

    await updateEscrowRow(order.escrow_pda, patch)
    patchEscrowLocal(order.escrow_pda, patch)
    await postEscrowUpdateMessage(order.escrow_pda, "seller_funded", { dedupe: !tx })

    return true
  }

  async function sellerFundEscrowOnChain(order:any) {
    let tx: string | null = null

    try {
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      // .rpc() already waits (over HTTP) until the transaction is confirmed.
      // Do NOT call connection.confirmTransaction() on top of it: it needs a
      // WebSocket, which /api/solana-rpc doesn't have, so it used to throw after
      // 30s even though the transaction had succeeded — leaving the chain
      // "funded" and the app "not funded".
      tx = await program.methods
        .sellerFundEscrow(orderIndex)
        .accounts({
          order: orderPda,
          escrow: escrowPda,
          seller: seller,
          feeWallet: NFT_FEE_WALLET,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .rpc()

    } catch(err:any) {
      // Previous attempt was confirmed on-chain but never recorded: catch up.
      if (isAlreadyDoneError(err)) {
        try {
          if (await finishSellerFund(order, null)) {
            pushToast("This escrow was already funded — status updated.", "info")
            return
          }
        } catch (e) {
          console.error("seller-fund recovery failed:", e)
        }
        refreshEscrowRows([order.escrow_pda])
      }

      reportError(err, "seller-fund-escrow");
      return
    }

    // The transaction is final from here on; never report it as a failure.
    try {
      await finishSellerFund(order, tx)
    } catch (e) {
      console.error("seller-fund bookkeeping failed:", e)
      pushToast("Escrow funded on-chain, but updating the chat failed. Refresh the page to see the latest status.", "info")
    }
  }

  // ---------- seller: mark shipped ----------

  async function finishMarkShipped(order:any, tx: string | null, extra: Record<string, any> = {}) {
    const acct = await readOrderFromChain(order, (o) => bnToNum(o.markShippedAt) > 0)
    const chainShippedAt = acct ? bnToNum(acct.markShippedAt) : 0

    if (!tx && chainShippedAt <= 0) return false

    // the confirm-deadline is counted from the chain's clock, not this device's
    const shippedAt = chainShippedAt > 0 ? chainShippedAt : Math.floor(Date.now() / 1000)

    const patch: Record<string, any> = { status: "Shipped", shipped_at_unix: shippedAt, ...extra }
    if (tx) patch.shipped_tx = tx

    if (tx) openSellerShippedSuccess(tx, order.shipping_deadline)

    await updateEscrowRow(order.escrow_pda, patch)
    patchEscrowLocal(order.escrow_pda, patch)
    await postEscrowUpdateMessage(order.escrow_pda, "seller_shipped", { dedupe: !tx })

    return true
  }

  async function markShippedOnChain(order:any){
    let tx: string | null = null

    try{
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller,orderIndex)

      tx = await program.methods
        .markShipped(orderIndex)
        .accounts({
          order:orderPda,
          seller:seller
        })
        .rpc()

    }catch(err:any){
      if (isAlreadyDoneError(err)) {
        try {
          if (await finishMarkShipped(order, null)) {
            pushToast("This order was already marked as shipped — status updated.", "info")
            return
          }
        } catch (e) {
          console.error("mark-shipped recovery failed:", e)
        }
        refreshEscrowRows([order.escrow_pda])
      }

      reportError(err, "mark-shipped");
      return
    }

    try {
      await finishMarkShipped(order, tx)
    } catch (e) {
      console.error("mark-shipped bookkeeping failed:", e)
      pushToast("Marked as shipped on-chain, but updating the chat failed. Refresh the page to see the latest status.", "info")
    }
  }

  async function markShippedDigitalOnChain(order:any, file: File){
    let tx: string | null = null
    let deliveryPath: string | null = null
    let extra: Record<string, any> = {}

    try {
      const wallet = await getAnchorWallet();
      const program = getProgram(wallet);

      const seller = wallet.publicKey;
      const orderIndex = new anchor.BN(order.order_index);

      const [orderPda] = getOrderPDA(seller, orderIndex);

      // Upload the file BEFORE the on-chain "shipped" step. Before, a failed
      // upload (big file, network drop ...) happened after the contract had
      // already moved to Shipped: the buyer got nothing to download and
      // retrying hit InvalidState.
      deliveryPath = await uploadDigitalDeliveryFile(file, order);

      extra = {
        delivery_file_path: deliveryPath,
        delivery_file_name: file.name,
        delivery_file_size: file.size,
      }

      tx = await program.methods
        .markShipped(orderIndex)
        .accounts({
          order: orderPda,
          seller: seller
        })
        .rpc();

    } catch (err:any) {
      // Retry after an attempt that already went through on-chain.
      if (deliveryPath && isAlreadyDoneError(err)) {
        try {
          if (await finishMarkShipped(order, null, extra)) {
            pushToast("This order was already marked as shipped — status updated.", "info")
            return
          }
        } catch (e) {
          console.error("mark-shipped recovery failed:", e)
        }
      }

      // The transaction didn't happen, so don't leave an orphaned upload behind.
      if (deliveryPath) {
        supabase.storage.from("digital-delivery").remove([deliveryPath]).catch(() => {})
      }

      console.error(err);
      reportError(err, "mark-shipped");
      return
    }

    try {
      await finishMarkShipped(order, tx, extra)
    } catch (e) {
      console.error("mark-shipped bookkeeping failed:", e)
      pushToast("Marked as shipped on-chain, but updating the chat failed. Refresh the page to see the latest status.", "info")
    }
  }

  async function refundBuyerOnChain(order:any){
    try{

      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const buyer = wallet.publicKey
      const seller = new PublicKey(order.seller_wallet)

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      const tx = await program.methods
        .buyerCancel(orderIndex)
        .accounts({
          order: orderPda,
          escrow: escrowPda,
          buyer: buyer,
          seller: seller
        })
        .rpc()

      setRefundSuccessTx(tx)

      // update DB
      await supabase
        .from("escrow_orders")
        .update({
          status: "Cancelled",
          refund_tx: tx
        })
        .eq("escrow_pda", order.escrow_pda)

      // send message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body: `escrow_update:${order.escrow_pda}:buyer_cancelled`,
        message_type: "escrow_update",
      });

      setEscrowById(prev => ({
        ...prev,
        [order.escrow_pda]: {
          ...prev[order.escrow_pda],
          status: "Cancelled"
        }
      }))

    }catch(err:any){
      reportError(err, "buyer-cancel");
    }
  }

  async function sellerCancelOnChain(order:any){
    try{

      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const buyer = new PublicKey(order.buyer_wallet)

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      const tx = await program.methods
        .sellerCancel(orderIndex)
        .accounts({
          order: orderPda,
          escrow: escrowPda,
          buyer: buyer,
          seller: seller,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .rpc()


      // success screen
      setSellerCancelSuccessTx(tx)

      // update DB
      await supabase
        .from("escrow_orders")
        .update({
          status: "Cancelled",
          refund_tx: tx
        })
        .eq("escrow_pda", order.escrow_pda)

      // send chat message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body: `escrow_update:${order.escrow_pda}:seller_cancelled`,
        message_type: "escrow_update",
      });

      // update local state
      setEscrowById(prev => ({
        ...prev,
        [order.escrow_pda]: {
          ...prev[order.escrow_pda],
          status: "Cancelled"
        }
      }))

    }catch(err:any){
      reportError(err, "seller-cancel-order");
    }
  }

  async function finishOpenDispute(order:any, tx: string | null) {
    const acct = await readOrderFromChain(order, (o) => bnToNum(o.openDisputeAt) > 0)
    const chainOpenedAt = acct ? bnToNum(acct.openDisputeAt) : 0

    if (!tx && chainOpenedAt <= 0) return false

    const disputeOpenedAt = chainOpenedAt > 0 ? chainOpenedAt : Math.floor(Date.now() / 1000)

    const patch: Record<string, any> = { status: "Dispute", dispute_opened_at_unix: disputeOpenedAt }
    if (tx) patch.dispute_tx = tx

    if (tx) setOpenedDisputeTx(tx)

    await updateEscrowRow(order.escrow_pda, patch)
    patchEscrowLocal(order.escrow_pda, patch)
    await postEscrowUpdateMessage(order.escrow_pda, "dispute_opened", { dedupe: !tx })

    return true
  }

  async function openDisputeOnChain(order:any){
    let tx: string | null = null

    try{
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const buyer = wallet.publicKey
      const seller = new PublicKey(order.seller_wallet)

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      tx = await program.methods
        .openDispute(orderIndex)
        .accounts({
          order: orderPda,
          buyer: buyer,
          seller: seller
        })
        .rpc()

    }catch(err:any){
      if (isAlreadyDoneError(err)) {
        try {
          if (await finishOpenDispute(order, null)) {
            pushToast("The dispute was already opened — status updated.", "info")
            return
          }
        } catch (e) {
          console.error("open-dispute recovery failed:", e)
        }
        refreshEscrowRows([order.escrow_pda])
      }

      reportError(err, "open-dispute");
      return
    }

    try {
      await finishOpenDispute(order, tx)
    } catch (e) {
      console.error("open-dispute bookkeeping failed:", e)
      pushToast("Dispute opened on-chain, but updating the chat failed. Refresh the page to see the latest status.", "info")
    }
  }

  async function refundDisputeOnChain(order:any){
    try{

      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const buyer = new PublicKey(order.buyer_wallet)

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      const tx = await program.methods
        .refundBuyer(orderIndex)
        .accounts({
          order: orderPda,
          escrow: escrowPda,
          seller: seller,
          buyer: buyer
        })
        .rpc()


      setRefundSuccessTx(tx)

      // update DB
      await supabase
        .from("escrow_orders")
        .update({
          status:"Cancelled",
          seller_refund_tx:tx
        })
        .eq("escrow_pda",order.escrow_pda)

      // send chat message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body: `escrow_update:${order.escrow_pda}:seller_refunded`,
        message_type: "escrow_update"
      })

      setEscrowById(prev=>({
        ...prev,
        [order.escrow_pda]:{
          ...prev[order.escrow_pda],
          status:"Cancelled"
        }
      }))

    }catch(err:any){
      reportError(err, "seller-refund");
    }
  }

  async function finishRespondDispute(order:any, tx: string | null) {
    const acct = await readOrderFromChain(order, (o) => bnToNum(o.sellerRespondAt) > 0)
    const chainRespondedAt = acct ? bnToNum(acct.sellerRespondAt) : 0

    if (!tx && chainRespondedAt <= 0) return false

    const sellerRespondedAt = chainRespondedAt > 0 ? chainRespondedAt : Math.floor(Date.now() / 1000)

    const patch: Record<string, any> = { status: "Discuss", seller_responded_at_unix: sellerRespondedAt }
    if (tx) patch.seller_respond_tx = tx

    if (tx) setRespondDisputeSuccessTx(tx)

    await updateEscrowRow(order.escrow_pda, patch)
    patchEscrowLocal(order.escrow_pda, patch)
    await postEscrowUpdateMessage(order.escrow_pda, "seller_responded_dispute", { dedupe: !tx })

    return true
  }

  async function respondDisputeOnChain(order:any){
    let tx: string | null = null

    try{
      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      tx = await program.methods
        .respondDispute(orderIndex)
        .accounts({
          order: orderPda,
          seller: seller
        })
        .rpc()

    }catch(err:any){
      if (isAlreadyDoneError(err)) {
        try {
          if (await finishRespondDispute(order, null)) {
            pushToast("You already responded to this dispute — status updated.", "info")
            return
          }
        } catch (e) {
          console.error("respond-dispute recovery failed:", e)
        }
        refreshEscrowRows([order.escrow_pda])
      }

      reportError(err, "seller-respond-dispute");
      return
    }

    try {
      await finishRespondDispute(order, tx)
    } catch (e) {
      console.error("respond-dispute bookkeeping failed:", e)
      pushToast("Responded on-chain, but updating the chat failed. Refresh the page to see the latest status.", "info")
    }
  }

  async function paySellerDuringDiscussOnChain(order:any){
    try{

      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const buyer = wallet.publicKey
      const seller = new PublicKey(order.seller_wallet)

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      const tx = await program.methods
        .paySellerDuringDiscuss(orderIndex)
        .accounts({
          order: orderPda,
          escrow: escrowPda,
          buyer: buyer,
          seller: seller,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .rpc()


      setPaidSellerTx(tx)

      // update DB
      await supabase
        .from("escrow_orders")
        .update({
          status:"Completed",
          pay_seller_tx:tx
        })
        .eq("escrow_pda",order.escrow_pda)

      // send chat message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body: `escrow_update:${order.escrow_pda}:seller_paid`,
        message_type: "escrow_update",
      })

      setEscrowById(prev=>({
        ...prev,
        [order.escrow_pda]:{
          ...prev[order.escrow_pda],
          status:"Completed"
        }
      }))

    }catch(err:any){
      reportError(err, "seller-paid");
    }
  }

  async function refundDuringDiscussOnChain(order:any){
    try{

      const wallet = await getAnchorWallet()
      const program = getProgram(wallet)

      const seller = wallet.publicKey
      const buyer = new PublicKey(order.buyer_wallet)

      const orderIndex = new anchor.BN(order.order_index)

      const [orderPda] = getOrderPDA(seller, orderIndex)

      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), orderPda.toBuffer()],
        program.programId
      )

      const tx = await program.methods
        .refundDuringDiscuss(orderIndex)
        .accounts({
          order: orderPda,
          escrow: escrowPda,
          buyer: buyer,
          seller: seller,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .rpc()


      setRefundSuccessTx(tx)

      // update DB
      await supabase
        .from("escrow_orders")
        .update({
          status:"Cancelled",
          seller_refund_tx:tx
        })
        .eq("escrow_pda",order.escrow_pda)

      // send chat message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        receiver_id: activeContactId,
        body:`escrow_update:${order.escrow_pda}:seller_refunded`,
        message_type:"escrow_update"
      })

      setEscrowById(prev=>({
        ...prev,
        [order.escrow_pda]:{
          ...prev[order.escrow_pda],
          status:"Cancelled"
        }
      }))

    }catch(err:any){
      reportError(err, "seller-refund-3");
    }
  }

  return (
    <motion.div
      {...pageMotion}
      className="min-h-[100svh] h-[100svh] supports-[height:100dvh]:min-h-dvh supports-[height:100dvh]:h-dvh flex bg-black overflow-hidden antialiased selection:bg-[#2FE4E4]/25 selection:text-white"
    >
      {/* LEFT SIDEBAR */}
      <aside
        className={[
          'h-full bg-black/95 border-r border-white/10 flex flex-col backdrop-blur-xl shadow-[18px_0_70px_rgba(0,0,0,0.35)]',
          'w-full md:w-[clamp(20rem,29vw,24.55rem)] shrink-0',
          isMobile ? (mobileView === 'contacts' ? 'flex' : 'hidden') : 'flex',
        ].join(' ')}
      >
        <div className="px-4 pt-5 pb-4 flex flex-col min-h-0 flex-1">

          {!hasContacts && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none px-6 text-center">
              <Image
                className="relative"
                src="/chat-dots-svgrepo-com.svg"
                width={100}
                height={100}
                alt="chat"
              />
              <span className="text-[#A6A6A6] text-[17.5px] whitespace-nowrap">
                Click Add Contact to start chatting
              </span>
            </div>
          )}
          <div ref={menuWrapRef} className="relative inline-block">
            <div className='flex'>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="
                  group
                  rounded-full
                  p-1
                  transition-all duration-300
                  hover:bg-white/[0.04]
                  active:scale-95
                "
              >
                <div className="relative">
                  {/* cyan ring when menu open */}
                  <div
                    className={`
                      absolute inset-0 rounded-full
                      transition-all duration-300
                      ${
                        menuOpen
                          ? "ring-2 ring-[#2FE4E4] shadow-[0_0_25px_rgba(47,228,228,0.35)]"
                          : "ring-0"
                      }
                    `}
                  />

                  <img
                    src={avatarSrc}
                    alt="profile"
                    onError={() => setAvatarSrc("/cat.png")}
                    referrerPolicy="no-referrer"
                    className="
                      relative
                      h-11 w-11
                      rounded-full
                      object-cover
                      border border-white/10
                      transition-all duration-300
                    "
                  />

                  {/* online indicator */}
                  <span
                    className="
                      absolute
                      bottom-0 right-0
                      h-3.5 w-3.5
                      rounded-full
                      bg-emerald-400
                      border-2 border-[#0F0F0F]
                      shadow-[0_0_12px_rgba(74,222,128,0.6)]
                    "
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={() => (isMobile ? openAddPhone() : openAdd())}
                className="ml-auto mr-2 relative z-[9999] transition grid place-items-center shrink-0 p-2 touch-manipulation"
              >
                <Image
                  src="/person-plus-svgrepo-com.svg"
                  width={30}
                  height={30}
                  alt="Add contact"
                />
              </button>

            </div>

            {addOpenPhone && (
              <div className="h-[calc(100vh-91px)] bg-black flex items-center justify-center px-6">
                <div className="w-full max-w-[520px] flex flex-col items-center">
                  {addStep === 'enter' ? (
                    <>
                      <div className="text-white text-[28px] mb-6">Enter Username</div>

                      <input
                        ref={addInputRef}
                        value={addUsername}
                        onLoad={() => {
                          const fit = calcFitZoom();
                          setMinZoom(fit);
                          setZoom(fit);
                          setPan({ x: 0, y: 0 });
                        }}
                        onChange={(e) => setAddUsername(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onNext();
                        }}
                        className="w-full max-w-[430px] h-[46px] rounded-[10px] bg-[#2f2f2f] text-white/90 outline-none px-4 focus-within:ring-2 focus-within:ring-[#2FE4E4]/40"
                      />

                      <button
                        type="button"
                        onClick={onNext}
                        disabled={searching}
                        className="mt-5 w-full max-w-[430px] h-[50px] rounded-[8px] bg-[#26D9D9] text-black font-semibold"
                      >
                        {searching ? <ButtonLoadingLabel label="Searching..." /> : 'Next'}
                      </button>

                      <button
                        type="button"
                        onClick={closeAddPhone}
                        className="mt-4 text-white/60 hover:text-white/80 text-[14px]"
                      >
                        Close
                      </button>

                      {addError && <div className="mt-4 text-red-400 text-[14px]">{addError}</div>}
                    </>
                  ) : (
                    <>
                      <img
                        src={found?.avatar || '/cat.png'}
                        alt="pfp"
                        className="h-[150px] w-[150px] rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/cat.png';
                        }}
                      />

                      <div className="text-white text-[40px] mb-6">{found?.username}</div>

                      <button
                        type="button"
                        onClick={onAddContact}
                        disabled={adding}
                        className="w-full max-w-[430px] h-[52px] rounded-[8px] bg-[#26D9D9] text-black font-semibold disabled:opacity-70"
                      >
                        {adding ? <ButtonLoadingLabel label="Adding..." /> : 'Add Contact'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddStep('enter')}
                        className="mt-4 text-white/60 hover:text-white/80 text-[14px]"
                      >
                        Back
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* DROPDOWN */}
            {menuOpen && (
              <div
                className={[
                  'absolute left-0 top-full mt-2 z-50',
                  'w-[180px]',
                  'rounded-[15px]',
                  'bg-[#0F0F0F]',
                  'border-2',
                  'border-[#222222]',
                  'shadow-[0_30px_80px_rgba(0,0,0,0.75)]',
                  'p-5',
                ].join(' ')}
              >

                {/* menu items */}
                <div className="flex flex-col items-center pt-2">
                  <div className="h-[49px] w-[49px] rounded-full bg-[#0b3b37] flex items-center justify-center overflow-hidden">
                    <img
                      src={avatarSrc}
                      alt="profile"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarSrc('/cat.png')}
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="mt-3 text-white text-[17.5px] font-medium">
                    {loadingName ? <InlineSkeleton className="h-5 w-20" /> : ellipsize(displayName, 13)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowEditProfile(true);
                  }}
                  className="mt-2 items-center justify-center group w-full flex items-center justify-between rounded-2xl px-3 py-3 text-white/90 hover:bg-white/[0.05] transition"
                >
                  <div className="flex items-center gap-4">
                    <Image src="/edit-svgrepo-com.svg" width={20} height={20} alt="edit" />
                    <span className="text-[15px] font-semibold">Edit</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowFeedback(true);
                  }}
                  className="items-center justify-center group w-full flex items-center justify-between rounded-2xl px-3 py-3 text-white/90 hover:bg-white/[0.05] transition"
                >
                  <div className="flex items-center gap-4">
                    <Image src="/feedback-svgrepo-com.svg" width={22} height={22} alt="feedback" />
                    <span className="text-[15px] font-semibold">Feedback</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/docs");
                  }}
                  className="items-center justify-center group w-full flex items-center justify-between rounded-2xl px-3 py-3 text-white/90 hover:bg-white/[0.05] transition"
                >
                  <div className="flex items-center gap-4">
                    <Image src="/google-docs-svgrepo-com.svg" width={22} height={22} alt="docs" />
                    <span className="text-[15px] font-semibold">Docs</span>
                  </div>
                </button>

                <div className="my-2 h-px bg-white/10" />

                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false);
                    await supabase.auth.signOut();
                    router.push("/auth");
                  }}
                  className="group w-full flex items-center justify-between rounded-2xl px-3 py-3 text-red-400 hover:bg-red-500/10 transition"
                >
                  <div className="flex items-center gap-4">
                    <svg width="24.5" height="24.5" viewBox="0 0 24 24" fill="none" className="shrink-0">
                      <path
                        d="M10 17l-5-5 5-5"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 12h9"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M14 7V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-1"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-[15px] font-semibold">Log out</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* search */}
          <div className="mt-4 w-full h-[54.6px] rounded-[15px] bg-[#262626] flex items-center gap-3 px-4 focus-within:ring-2 focus-within:ring-[#2FE4E4]/40">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/55">
              <path
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Paste Username..."
              className="w-full bg-transparent outline-none text-white/80 placeholder:text-white/40 text-[17.5px]"
            />
          </div>
          <div className="mt-4 -mx-4 h-px bg-white/10" />
          {/* contacts list */}
          <div className="mt-0 -mx-4 flex-1 min-h-0 overflow-y-auto scrollbar-hide overscroll-contain">
            {loadingContacts ? (
              <ContactListSkeleton />
            ) : contacts.length === 0 ? (
              <div className="text-white/40 text-[14px] px-2 py-4"></div>
            ) : (
              <div className="space-y-0">
                {filteredContacts.map((c) => {
                  const active = c.id === activeContactId;

                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        flushChatPosition();
                        setActiveContactId(c.id);
                        setJumpOnOpen(true);
                        if (isMobile) setMobileView('chat');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          flushChatPosition();
                          setActiveContactId(c.id);
                          setJumpOnOpen(true);
                          if (isMobile) setMobileView('chat');
                        }
                      }}
                      className={[
                        'h-[91px] w-full flex items-center gap-4 px-4 py-4 cursor-pointer',
                        'border-b border-white/10',
                        active ? 'bg-white/5' : 'hover:bg-white/5',
                        'transition-all duration-200 text-left active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/30',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfileModal(c.id);
                        }}
                        className="group h-[49px] w-[49px] rounded-full bg-[#0b3b37] overflow-hidden flex items-center justify-center shrink-0 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
                        aria-label={`Open ${c.username || 'profile'} profile`}
                      >
                        <img
                          src={c.avatar || '/cat.png'}
                          alt="avatar"
                          className="h-full w-full object-cover transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#2FE4E4]"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/cat.png';
                          }}
                        />
                      </button>
                      <div className="flex items-center justify-between gap-3 w-full min-w-0">
                        <div className="min-w-0">
                          <div className="text-white text-[18px] font-medium truncate">{c.username}</div>

                          <div
                            className={[
                              'text-[16px] truncate',
                              (c.unreadCount ?? 0) > 0 ? 'text-white' : 'text-[#A6A6A6]',
                            ].join(' ')}
                          >
                            {c.subtitle || ''}
                          </div>
                        </div>

                        <div
                          className={[
                            'shrink-0 flex flex-col items-end gap-2',
                            (c.unreadCount ?? 0) === 0 ? 'mt-[0]' : 'mt-[7px]',
                          ].join(' ')}
                        >
                          {!!c.lastAt && (
                            <div
                              className={[
                                'text-[13px] leading-none',
                                (c.unreadCount ?? 0) > 0 ? 'text-[#26D9D9]' : 'text-[#A6A6A6]',
                              ].join(' ')}
                            >
                              {formatContactLastAt(c.lastAt)}
                            </div>
                          )}
                          {(c.unreadCount ?? 0) > 0 && (
                            <div className="min-w-[22px] h-[22px] px-2 rounded-full bg-[#2FE4E4] text-black text-[12px] font-semibold grid place-items-center shadow-[0_0_22px_rgba(47,228,228,0.25)]">
                              {formatBadge(c.unreadCount ?? 0)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <main
        className={[
          'relative flex-1 bg-black min-h-0 flex flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(47,228,228,0.045),transparent_34%),#000]',
          isMobile ? (mobileView === 'chat' ? 'flex' : 'hidden') : 'flex',
        ].join(' ')}
      >
        {viewer ? (
          // ====== VIEWER MODE (right) ======
          <div className="h-full flex flex-col">
            {/* top bar viewer */}
            <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => viewer.uid && setProfileModal(viewer.uid)}
                  className="group h-[49px] w-[49px] rounded-full overflow-hidden bg-[#0b3b37] shrink-0 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
                  aria-label={`Open ${viewer.title || 'profile'} profile`}
                >
                  <img
                    src={viewer.avatar || '/cat.png'}
                    alt="Profile avatar"
                    className="h-full w-full object-cover transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#2FE4E4]"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.src = '/cat.png'; }}
                  />
                </button>

                <div className="min-w-0">
                  <div className="ml-[2px] text-white text-[18px] font-medium truncate">{viewer.title}</div>
                  <div className="ml-[2px] text-white/60 text-[13px] truncate">{formatViewerTime(viewer.createdAt)}</div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeViewer}
                className="h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
                title="Close"
              >
                <Image
                  src="/cancel-svgrepo-com.svg"
                  width={20}
                  height={20}
                  alt="X"
                />
              </button>
            </div>

            {/* body viewer */}
            <div
              ref={viewerBodyRef}
              onMouseDown={onViewerMouseDown}
              onMouseMove={onViewerMouseMove}
              onMouseUp={onViewerMouseUp}
              onMouseLeave={onViewerMouseUp}
              className="flex-1 overflow-hidden bg-black"
              onDoubleClick={resetZoom}
              onWheel={(e) => {
                e.preventDefault();

                const delta = e.deltaY;
                const factor = Math.exp(-delta * 0.0015);

                const el = viewerBodyRef.current;
                if (!el) return;

                const rect = el.getBoundingClientRect();
                const mx = e.clientX - rect.left - rect.width / 2;
                const my = e.clientY - rect.top - rect.height / 2;

                setZoom((prevZoom) => {
                  const nextZoom = clamp(prevZoom * factor, 1, 6);
                  const zoomRatio = nextZoom / prevZoom;

                  setPan((p) => {
                    const anchored = {
                      x: p.x - mx * (zoomRatio - 1),
                      y: p.y - my * (zoomRatio - 1),
                    };
                    return clampPan(anchored, nextZoom);
                  });

                  return nextZoom;
                });
              }}
              style={{ touchAction: 'none' }}
            >
              <img
                src={viewer.url}
                alt="full"
                referrerPolicy="no-referrer"
                draggable={false}
                className="select-none"
                onLoad={() => {
                  const fit = calcFitZoom();
                  setMinZoom(fit);
                  setZoom(fit);
                  setPan({ x: 0, y: 0 });
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 0,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  cursor: zoom > minZoom ? 'grab' : 'zoom-in',
                  transition: 'transform 40ms linear',
                }}
              />
            </div>
          </div>
          ) : openedDisputeTx ? (
            <OpenedDispute
              tx={openedDisputeTx}
              onClose={() => {
                setOpenedDisputeTx(null)
                setReviewOrder(null)
              }}
            />

          ) : sellerCancelSuccessTx ? (

            <SellerCancelledScreen
              tx={sellerCancelSuccessTx}
              onClose={() => {
                setSellerCancelSuccessTx(null)
                setCancelOrder(null)
              }}
            />

          ) : fundSuccessTx ? (

            <BuyerFundedScreen
              tx={fundSuccessTx}
              onClose={()=>{
                setFundSuccessTx(null)
                setFundOrder(null)
                setFundStep("screen")
              }}
            />

          ) : fundMode && fundOrder && fundOrder.type !== "digital" ? (
            <FundModeWarning
              mode={fundMode}
              onContinue={() => setFundMode(null)}
              onClose={() => {
                setFundMode(null)
                setFundOrder(null)
              }}
            />

          ) : paidSellerTx ? (

            <PaidSellerScreen
              tx={paidSellerTx}
              onClose={() => setPaidSellerTx(null)}
            />

          ) : respondDisputeSuccessTx ? (

            <SellerRespondedDisputeScreen
              tx={respondDisputeSuccessTx}
              onClose={() => {
                setRespondDisputeSuccessTx(null)
                setRespondDisputeOrder(null)
                setRespondDisputeStep("respond")
              }}
            />

          ) : refundSuccessTx ? (

            <BuyerReFundedScreen
              tx={refundSuccessTx}
              onClose={() => {
                setRefundSuccessTx(null)
                setFundMode(null)
                setFundOrder(null)
                setDisputeOrder(null)
                setRefundOrder(null)
                setRefundDisputeOrder(null)
              }}
            />

          ) : refundDisputeOrder ? (

            <RefundScreen
              order={refundDisputeOrder}
              supabase={supabase}
              onClose={()=>setRefundDisputeOrder(null)}
              onNext={async ()=>{
                await refundDisputeOnChain(refundDisputeOrder)
              }}
            />

          ) : sellerShippedSuccess ? (

            <SellerMarkShippedScreen
              tx={sellerShippedSuccess.tx}
              onClose={()=>setSellerShippedSuccess(null)}
            />

          ) : cancelOrder ? (

            <SellerCancelScreen
              order={cancelOrder}
              supabase={supabase}
              onClose={()=>setCancelOrder(null)}
              onRefund={(order:any) => order.type === "nft" ? cancelNftListingOnChain(order) : sellerCancelOnChain(order)}
            />

          ) : shipOrder ? (

            <MarkShippedScreen
              order={shipOrder}
              supabase={supabase}
              onClose={()=>setShipOrder(null)}
              onConfirm={async (order)=>{
                await markShippedOnChain(order)
                setShipOrder(null)
              }}
            />

          ) : respondDisputeOrder && respondDisputeStep === "respond" ? (

            <RespondDisputeScreen
              order={respondDisputeOrder}
              supabase={supabase}
              onClose={() => {
                setRespondDisputeOrder(null)
                setRespondDisputeStep("respond")
              }}
              onNext={() => {
                setRespondDisputeStep("wyntk")
                setRespondDisputeSubStep(0)
              }}
            />

          ) : respondDisputeOrder && respondDisputeStep === "wyntk" ? (

            <WYNTKRespondScreen
              order={respondDisputeOrder}
              step={respondDisputeSubStep}
              supabase={supabase}
              onClose={() => {
                setRespondDisputeOrder(null)
                setRespondDisputeStep("respond")
                setRespondDisputeSubStep(0)
              }}
              onBack={() => {
                if (respondDisputeSubStep > 0) {
                  setRespondDisputeSubStep(prev => prev - 1)
                } else {
                  setRespondDisputeStep("respond")
                }
              }}
              onNext={() => {
                if (respondDisputeSubStep < 3) {
                  setRespondDisputeSubStep(prev => prev + 1)
                } else {
                  setRespondDisputeStep("confirm")
                }
              }}
            />

          ) : respondDisputeOrder && respondDisputeStep === "confirm" ? (

            <RespondDisputeWyntkScreen
              order={respondDisputeOrder}
              supabase={supabase}
              onBack={() => {
                setRespondDisputeStep("wyntk")
              }}
              onClose={() => {
                setRespondDisputeOrder(null)
                setRespondDisputeStep("respond")
              }}
              onNext={async () => {
                await respondDisputeOnChain(respondDisputeOrder)
              }}
            />

          ) : refundDiscussOrder ? (

            <RefundBuyerDiscussScreen
              order={refundDiscussOrder}
              supabase={supabase}
              onClose={() => setRefundDiscussOrder(null)}
              onNext={async () => {
                await refundDuringDiscussOnChain(refundDiscussOrder)
              }}
            />

          ) : PaySellerOrder ? (

            <PaySellerDiscussScreen
              order={PaySellerOrder}
              supabase={supabase}
              onClose={() => setPaySellerOrder(null)}
              onNext={async () => {
                await paySellerDuringDiscussOnChain(PaySellerOrder)
              }}
            />

          ) : refundOrder ? (

            <BuyerRefundScreen
              order={refundOrder}
              supabase={supabase}
              onClose={() => setRefundOrder(null)}
              onRefund={refundBuyerOnChain}
            />

          ) : sellerFundSuccess ? (

            <SellerEscrowFundedScreen
              tx={sellerFundSuccess.tx}
              order={sellerFundOrder}
              supabase={supabase}
              shippingDeadline={sellerFundSuccess.deadline}
              onClose={() => {
                setSellerFundSuccess(null)
                setSellerFundOrder(null)
              }}
            />

          ) : sellerFundOrder && sellerStep === "fund" ? (

            <SellerFundEscrowScreen
              order={sellerFundOrder}
              supabase={supabase}
              onClose={()=>setSellerFundOrder(null)}
              onNext={()=>setSellerStep("confirm")}
            />

          ) : sellerFundOrder && sellerStep === "confirm" ? (

            <SellerFundEscrowConfirm
              order={sellerFundOrder}
              supabase={supabase}
              onBack={()=>setSellerStep("fund")}
              onFund={()=>sellerFundEscrowOnChain(sellerFundOrder)}
              onClose={()=>setSellerFundOrder(null)}
            />



          ) : buyNftSuccessTx ? (

            <NftBoughtScreen
              tx={buyNftSuccessTx}
              onClose={() => {
                setBuyNftSuccessTx(null)
                setBuyNftOrder(null)
              }}
            />

          ) : buyNftOrder ? (

            <BuyNftConfirm
              order={buyNftOrder}
              supabase={supabase}
              onBack={()=>setBuyNftOrder(null)}
              onBuy={()=>buyNftOnChain(buyNftOrder)}
              onClose={()=>setBuyNftOrder(null)}
            />

          ) : fundOrder ? (

            fundStep === "screen" ? (

              <FundEscrowScreen
                order={fundOrder}
                onClose={()=>setFundOrder(null)}
                supabase={supabase}
                onNext={()=>setFundStep("confirm")}
              />

            ) : (

              <FundEscrowConfirm
                order={fundOrder}
                supabase={supabase}
                onBack={()=>setFundStep("screen")}
                onFund={()=>fundEscrowOnChain(fundOrder)}
                onClose={() => {
                  setFundOrder(null)
                  setFundStep("screen")
                }}
              />

            )

        ) : disputeOrder ? (

          <OpenDisputeScreen
            order={disputeOrder}
            supabase={supabase}
            onNext={()=>setDisputeStep("wyntk")}
          />

        ) : uploadOrder ? (

          <UploadFileScreen
            order={uploadOrder}
            supabase={supabase}
            onClose={()=>setUploadOrder(null)}
            onSendFile={async (order, file) => {
              await markShippedDigitalOnChain(order, file);
              setUploadOrder(null);
            }}
          />

        ) : downloadOrder ? (

          <DownloadScreen
            order={downloadOrder}
            supabase={supabase}
            onClose={() => setDownloadOrder(null)}
          />

        ) : reviewOrder ? (

          <ReviewScreen
            order={reviewOrder}
            onClose={()=>setReviewOrder(null)}
            supabase={supabase}
            conversationId={conversationId}
            userId={userId}
            activeContactId={activeContactId}
            openDisputeOnChain={openDisputeOnChain}
          />

        ) : escrowListOpen ? (

          <EscrowOrders
            conversationId={conversationId}
            supabase={supabase}
            loadEscrow={loadEscrow}
            viewerId={userId}
            onBuy={onBuy}
            onSellerFund={onSellerFund}
            onMarkShipped={onMarkShipped}
            onRefund={refundBuyerOnChain}
            onCancel={(order:any) => order.type === "nft" ? cancelNftListingOnChain(order) : sellerCancelOnChain(order)}
            onClose={()=>setEscrowListOpen(false)}
            onReview={onReview}
            onRespond={(order: any)=>{
              setRespondDisputeOrder(order)
              setRespondDisputeStep("respond")
              setEscrowListOpen(false)
            }}
            onDisputeRefund={(order: any) => setRefundDisputeOrder(order)}
            onPaySeller={paySellerDuringDiscussOnChain}
            onRefundDiscuss={refundDuringDiscussOnChain}
            onSendDigitalFile={markShippedDigitalOnChain}
            onProfileClick={(uid: string) => setProfileModal(uid)}
          />

        ) : escrowOpen ? (
          escrowStep === 'pickType' ? (
            <EscrowScreen
              onClose={() => setEscrowOpen(false)}
              onPick={(type) => {
                setEscrowDraft(prev => ({
                  ...prev,
                  type: type
                }));

                if (type === 'physical') {
                  setEscrowStep('disputeMode');
                } else {
                  setEscrowStep('digitalKind');
                  setEscrowType('digital');
                }
              }}
            />
          ) : escrowStep === 'digitalKind' ? (
            <EscrowDigitalKind
              onBack={() => setEscrowStep('pickType')}
              onClose={() => { setExitTarget('chat'); setShowExitConfirm(true); }}
              onPick={(kind) => {
                if (kind === 'nft') {
                  setEscrowStep('nftInfo');
                } else {
                  setEscrowStep('itemInfo');
                }
              }}
            />
          ) : escrowStep === 'nftInfo' ? (
            <EscrowNftInfo
              draft={escrowDraft}
              setDraft={setEscrowDraft}
              onNext={() => setEscrowStep('nameOrder')}
              onBack={() => {
                setExitTarget('pickType');
                setShowExitConfirm(true);
              }}
              onClose={() => { setExitTarget('chat'); setShowExitConfirm(true); }}
            />
          ) : escrowStep === 'itemInfo' ? (
            <EscrowItemInfo
              type={escrowType ?? 'physical'}
              mode={escrowDraft.disputeMode}
              draft={escrowDraft}
              setDraft={setEscrowDraft}
              onNext={() => {setEscrowStep('nameOrder');}}

              onBack={() => {
                setExitTarget('pickType');
                setShowExitConfirm(true);
              }}

              onClose={() => {
                setExitTarget('chat');
                setShowExitConfirm(true);
              }}
            />
          ) : escrowStep === 'disputeMode' ? (
            <DisputMode
              onBack={() => setEscrowStep('pickType')}
              onClose={() => { setExitTarget('chat'); setShowExitConfirm(true);}}
              onPick={(type) => {
                setEscrowDraft(prev => ({
                  ...prev,
                  disputeMode: type
                }));
                setEscrowStep('itemInfo');
              }}
            />
          ) : escrowStep === 'nameOrder' ? (
            <EscrowNameOrder
              draft={escrowDraft}
              setDraft={setEscrowDraft}
              onBack={() => setEscrowStep(escrowDraft.nftMint ? 'nftInfo' : 'itemInfo')}
              onClose={() => { setExitTarget('chat'); setShowExitConfirm(true); }}
              onNext={() => setEscrowStep('preview')}
            />
          ) : escrowStep === 'success' ? (
            <EscrowSuccess
              tx={createdTx!}
              onClose={() => {
                resetEscrowDraft();
                setEscrowOpen(false);
              }}
            />
          ) : (
            <EscrowPreview
              draft={escrowDraft}
              type={escrowDraft.type}
              mode={escrowDraft.disputeMode}
              date={escrowDraft.shipDate}
              time={escrowDraft.shipTime}
              onCreate={async () => {
                if (escrowDraft.nftMint) {
                  await createNftListingOnChain()
                } else {
                  await createEscrowOrderChain()
                }
              }}
              onBack={() => setEscrowStep('nameOrder')}
              onClose={() => { setExitTarget('chat'); setShowExitConfirm(true); }}
            />
          )
        ) : (
          // ====== CHAT MODE ======
          <>
          {/* top bar */}
          <div className="h-[clamp(4.75rem,6vw,5.6875rem)] shrink-0 border-b border-white/10 bg-black/80 backdrop-blur-xl flex items-center px-4 md:px-6 min-w-0">
            {/* LEFT */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {activeContact ? (
                <>
                  {isMobile && (
                    <button
                      type="button"
                      onClick={() => {
                        flushChatPosition();
                        if (lastContactKey) {
                          try { window.localStorage.removeItem(lastContactKey); } catch {}
                        }
                        setMobileView('contacts');
                        setActiveContactId(null);
                      }}
                      className="mr-2 h-10 w-10 rounded-full hover:bg-white/5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/40 grid place-items-center transition-all duration-200 touch-manipulation text-white/80"
                      title="Back"
                    >
                      <Image src="/back-svgrepo-com.svg" width={22} height={22} alt="Back" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setProfileModal(activeContact.id)}
                    className="group h-[32px] w-[32px] md:h-[40px] md:w-[40px] rounded-full bg-[#0b3b37] overflow-hidden shrink-0 transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50"
                    aria-label={`Open ${activeContact.username || 'profile'} profile`}
                  >
                    <img
                      src={activeContact.avatar || '/cat.png'}
                      alt="avatar"
                      className="h-full w-full object-cover transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-[#2FE4E4]"
                      referrerPolicy="no-referrer"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).src = '/cat.png')}
                    />
                  </button>

                  <div className="min-w-0">
                    <div className="text-white md:text-[18px] text-[15px] font-medium truncate">{activeContact.username}</div>
                    <div className="text-white/50 md:text-[14px] text-[12px]">Online</div>
                  </div>
                </>
              ) : (
                <div className="text-white/50 text-[16px]"></div>
              )}
            </div>

            {/* RIGHT */}
            {activeContact && !addOpen && (
              <div className="flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setEscrowListOpen(true)}
                  className="h-8 w-8 md:h-10 md:w-10 rounded-full hover:bg-white/5 grid place-items-center text-white/70"
                  title="Cube"
                >
                  <Image src="/box.svg" width={37} height={37} alt="box"/>
                </button>

              </div>
            )}
          </div>
          {/* body */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* messages */}
            <div ref={bindChatScroll} onScroll={onChatScroll} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-[clamp(1rem,3vw,1.5rem)] py-[clamp(1rem,3vw,1.5rem)] space-y-4 scrollbar-hide scroll-smooth">
              {!activeContact ? (
                <div className="h-full flex items-center justify-center">
                  <button type="button" onClick={openAdd} className="group">
                    <div
                      className={[
                        'w-[129.5px] h-[129.5px]',
                        'rounded-[18px]',
                        'bg-[#262626]',
                        'flex items-center justify-center',
                        'group-hover:bg-[#303030] transition',
                      ].join(' ')}
                    >
                      <Image src="/5863.png" width={40} height={40} alt="person_plus" />
                    </div>
                    <div className="mt-[7px] text-[#A6A6A6] text-[16px] tracking-wide">Add contact</div>
                  </button>
                </div>
              ) : loadingMsgs ? (
                <MessagesSkeleton />
              ) : dbMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center px-6 text-center">
                  <div className="text-[#A6A6A6] text-[16px]">
                    Start a conversation by typing a message. Click + to create a new Escrow.
                  </div>
                </div>
              ) : (
                <>
                  {dbMessages.map((m, idx) => {
                    const mine = m.sender_id === userId;
                    const isImg = isImagePathMessage(m.body);
                    const isVoice = isVoiceMessage(m.body);
                    const isEscrow = isEscrowMessage(m.body);
                    const isEscrowUpdate = isEscrowUpdateMessage(m.body)
                    const parts  = m.body.split(":");
                    const action = parts[2];
                    const timeText = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    const curDate = new Date(m.created_at);
                    const curKey = dayKey(curDate);

                    const prev = idx > 0 ? dbMessages[idx - 1] : null;
                    const prevKey = prev ? dayKey(new Date(prev.created_at)) : null;

                    const isFirstOfDay = idx === 0 || curKey !== prevKey;

                    let orderId: string | null = null

                    if (isEscrow) {
                      orderId = m.body.slice(7)
                    }

                    if (isEscrowUpdate) {
                      orderId = m.body.split(":")[1]
                    }

                    const order = orderId ? escrowById[orderId] : null
                    const escrowMine = order?.seller_id === userId
                    const alignRight = isEscrow ? escrowMine : mine
                    const replied = m.reply_to_id
                      ? dbMessages.find((x) => x.id === m.reply_to_id) ?? null
                      : null
                    const flashing = flashId === m.id

                    const dayHeader = isFirstOfDay ? (
                      <div className="flex justify-center my-4">
                        <div className={`px-4 py-1.5 rounded-full bg-white/10 text-white/70 text-[12.5px] font-medium tabular-nums tracking-[-0.01em]`}>
                          {formatDayHeader(curDate)}
                        </div>
                      </div>
                    ) : null

                    const rowRef = (el: HTMLDivElement | null) => {
                      msgRefs.current.set(m.id, el);
                      if (!el) msgRefs.current.delete(m.id);
                    };

                    // ESCROW UPDATE: one short line + "?" with the details
                    if (isEscrowUpdate) {
                      const cardMsgId = orderId ? escrowMsgIdByOrder[orderId] : undefined

                      return (
                        <React.Fragment key={m.id}>
                          {dayHeader}
                          <div
                            ref={rowRef}
                            className={`group flex w-full justify-center rounded-xl py-0.5 transition-colors duration-500 ${
                              flashing ? "bg-[#26D9D9]/15" : ""
                            }`}
                          >
                            <SwipeToReply enabled={isMobile} onReply={() => startReply(m)}>
                              <EscrowUpdateLine
                                action={action}
                                order={order}
                                viewerId={userId}
                                createdAt={m.created_at}
                                onReply={() => startReply(m)}
                                onGoToEscrow={cardMsgId ? () => jumpToMessage(cardMsgId) : undefined}
                              />
                            </SwipeToReply>
                          </div>
                        </React.Fragment>
                      )
                    }

                    return (
                      <React.Fragment key={m.id}>
                        {dayHeader}

                        <div
                          ref={rowRef}
                          className={`group flex w-full rounded-xl transition-colors duration-500 ${
                            alignRight ? "justify-end" : "justify-start"
                          } ${flashing ? "bg-[#26D9D9]/15" : ""}`}
                        >
                          <div className="max-w-[82%] md:max-w-[680px] min-w-0">
                            <div
                              className={`flex w-full ${
                                alignRight ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div className="relative min-w-0 max-w-full md:max-w-[680px]">
                                {/* desktop: reply button on hover */}
                                <button
                                  type="button"
                                  onClick={() => startReply(m)}
                                  title="Reply"
                                  aria-label="Reply to message"
                                  className={`absolute top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/[0.08] text-white/70 opacity-0 transition hover:bg-white/15 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 md:grid ${
                                    alignRight ? "right-full mr-2" : "left-full ml-2"
                                  }`}
                                >
                                  <ReplyIcon size={16} />
                                </button>

                                {/* mobile: swipe right to reply */}
                                <SwipeToReply enabled={isMobile} onReply={() => startReply(m)}>
                                  {m.reply_to_id && (() => {
                                    const snip = getReplySnippet(replied)
                                    return (
                                      <ReplyQuote
                                        author={replied ? replyAuthorLabel(replied) : ""}
                                        kind={snip.kind}
                                        text={snip.text}
                                        alignRight={alignRight}
                                        onClick={replied ? () => jumpToMessage(replied.id) : undefined}
                                      />
                                    )
                                  })()}

                                  {isEscrow ? (
                                    <EscrowCard
                                      orderId={orderId!}
                                      loadEscrow={loadEscrow}
                                      supabase={supabase}
                                      viewerId={userId}
                                      onBuy={onBuy}
                                      onFundEscrow={onSellerFund}
                                      onMarkShipped={onMarkShipped}
                                      onRefund={(order)=>setRefundOrder(order)}
                                      onCancel={(order)=>setCancelOrder(order)}
                                      onReview={onReview}
                                      onRespond={(order)=>setRespondDisputeOrder(order)}
                                      onDisputeRefund={(order)=>setRefundDisputeOrder(order)}
                                      onRefundDiscuss={(order)=>setRefundDiscussOrder(order)}
                                      onPaySeller={(order)=>setPaySellerOrder(order)}
                                      onUploadFile={(order) => setUploadOrder(order)}
                                      onDownload={(order:any)=>{
                                        setDownloadOrder(order);
                                      }}
                                    />
                                  ) : isImg ? (
                                    <div
                                      className={[
                                        'flex items-end gap-2',
                                        mine ? 'flex-row-reverse' : 'flex-row',
                                      ].join(' ')}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openImageViewer(m)}
                                        className="relative inline-block rounded-[18px] overflow-hidden text-left"
                                        title="Open image"
                                      >
                                        <div className="md:w-auto md:max-w-[320px] md:h-auto">
                                          <ChatImage
                                            path={m.body.slice(8)}
                                            placeholderSrc={localImagePreviews[m.body.slice(8)]}
                                            getUrl={getSignedUrl}
                                            className="w-full h-full md:h-auto md:object-cover cursor-zoom-in"
                                            onLoaded={() => {
                                              if (pendingBottomScrollRef.current && pendingConvoRef.current === conversationId) {
                                                followBottomFor(400, true, 'auto');
                                                pendingBottomScrollRef.current = false;
                                              }
                                            }}
                                          />
                                        </div>
                                      </button>
                                      <div className="flex items-center gap-1 shrink-0 text-[12px] leading-none mb-1 text-white/40">
                                        <span>{timeText}</span>
                                        {mine && (
                                          <span className={m.read_at ? 'text-[#26D9D9]' : 'text-white/70'}>
                                            <ReadTicks read={!!m.read_at} />
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : isVoice ? (
                                    <div
                                      className={[
                                        'flex items-end gap-2',
                                        mine ? 'flex-row-reverse' : 'flex-row',
                                      ].join(' ')}
                                    >
                                      {(() => {
                                        const { path, duration, levels } = parseVoiceBody(m.body);
                                        return (
                                          <VoiceMessageBubble
                                            path={path}
                                            duration={duration}
                                            levels={levels}
                                            mine={mine}
                                            getUrl={getSignedUrl}
                                          />
                                        );
                                      })()}
                                      <div className="flex items-center gap-1 shrink-0 text-[12px] leading-none mb-1 text-white/40">
                                        <span>{timeText}</span>
                                        {mine && (
                                          <span className={m.read_at ? 'text-[#26D9D9]' : 'text-white/70'}>
                                            <ReadTicks read={!!m.read_at} />
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      className={[
                                        'flex items-end gap-2',
                                        mine ? 'flex-row-reverse' : 'flex-row',
                                      ].join(' ')}
                                    >
                                      {/* bubble */}
                                      <div
                                        className={[
                                          'px-3.5 py-2 md:px-4 md:py-3 rounded-[18px]',
                                          mine ? 'bg-white text-black' : 'bg-[#1f1f1f] text-white',
                                        ].join(' ')}
                                      >
                                        <div className="md:text-[18px] text-[16px] leading-snug break-words whitespace-pre-wrap">
                                          {m.body}
                                        </div>
                                      </div>

                                      {/* time outside bubble */}
                                      <div
                                        className={[
                                          'flex items-center gap-1 shrink-0',
                                          'text-[12px] leading-none mb-1',
                                          mine ? 'text-white/40' : 'text-white/40',
                                        ].join(' ')}
                                      >
                                        <span>{timeText}</span>
                                        {mine && (
                                          <span className={m.read_at ? 'text-[#26D9D9]' : 'text-black/35'}>
                                            <ReadTicks read={!!m.read_at} />
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </SwipeToReply>
                              </div>
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {pendingImages
                    .filter((p) => !p.path || !dbMessages.some((m) => m.body === `imgpath:${p.path}`))
                    .map((p) => (
                      <div key={p.id} className="flex w-full justify-end">
                        <div className="max-w-[82%] md:max-w-[680px] min-w-0">
                          <div className="relative inline-block overflow-hidden rounded-[18px]" aria-busy="true" aria-label="Uploading image">
                            <img
                              src={p.url}
                              alt="Uploading"
                              className="block w-full h-full md:h-auto md:max-w-[320px] md:object-cover"
                            />
                            <div className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                              <Spinner size={36} thickness={3} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* composer */}
            {activeContact && (
              <div className="sticky bottom-0 shrink-0 border-t border-white/10 bg-black 
                            px-3 md:px-6 py-4 md:py-5 
                            pb-[calc(env(safe-area-inset-bottom)+16px)] md:pb-[calc(env(safe-area-inset-bottom)+20px)]">
                
                {replyTo && (() => {
                  const snip = getReplySnippet(replyTo)
                  return (
                    <div className="mb-3 flex items-stretch gap-3 rounded-xl bg-[#262626] px-3 py-2">
                      <span className="w-[3px] shrink-0 rounded-full bg-[#26D9D9]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium text-[#26D9D9]">
                          Replying to {replyAuthorLabel(replyTo)}
                        </div>
                        <div className="flex items-center gap-1.5 text-[14px] text-white/60">
                          <ReplyKindIcon kind={snip.kind} />
                          <span className="truncate">{snip.text}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        title="Cancel reply"
                        aria-label="Cancel reply"
                        className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  )
                })()}

                <div className="flex items-center gap-3 w-full min-w-0 overflow-visible">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      e.target.value = '';
                      sendImage(f);
                    }}
                  />
                  <button
                    type="button"
                    title="Create Escrow"
                    disabled={isRecording}
                    onClick={() => {
                      resetEscrowDraft();
                      setEscrowStep('pickType');
                      setEscrowOpen(true);
                    }}
                    className={[
                      'shrink-0 h-[42px] w-[42px] md:h-[53px] md:w-[53px] rounded-[14px] border border-[#26D9D9] text-[#26D9D9] hover:bg-white/5 transition grid place-items-center',
                      isRecording ? 'opacity-40 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    </svg>
                  </button>

                  {isRecording ? (
                    <div className="relative z-10 flex-1 h-[42px] md:h-[53px]
                                    rounded-[12px] md:rounded-[14px] bg-[#262626] px-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={cancelRecording}
                        title="Cancel recording"
                        className="shrink-0 text-white/50 hover:text-white transition"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>

                      <span className="relative flex h-[9px] w-[9px] shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-[9px] w-[9px] bg-red-500" />
                      </span>

                      <div className="flex-1 min-w-0 flex items-end gap-[2px] h-[24px] overflow-hidden">
                        {recordingLevels.map((h, i) => (
                          <span
                            key={i}
                            className="w-[3px] rounded-full bg-[#26D9D9] shrink-0 transition-all duration-100"
                            style={{ height: `${Math.max(4, Math.min(24, Math.round((h / 100) * 24)))}px` }}
                          />
                        ))}
                      </div>

                      <span className="text-white/70 text-[13px] tabular-nums shrink-0">
                        {formatVoiceDuration(recordingTime)}
                      </span>
                    </div>
                  ) : (
                    <div className="relative z-10 flex-1  h-[42px] md:h-[53px] 
                                    rounded-[12px] md:rounded-[14px] rounded-[14px] bg-[#262626] px-4 flex items-center
                                    focus-within:ring-2 focus-within:ring-[#2FE4E4]/40">

                      <input
                        ref={chatInputRef}
                        value={chatDraft}
                        onChange={(e) => setChatDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape' && replyToRef.current) {
                            e.preventDefault();
                            setReplyTo(null);
                            return;
                          }
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (chatDraft.trim()) onSend();
                          }
                        }}
                        placeholder="Type a message..."
                        className="w-full bg-transparent text-white/90 outline-none placeholder:text-white/40 text-[15px] md:text-[17px]"
                      />
                    </div>
                  )}

                  {!isRecording && (
                    <button
                      type="button"
                      disabled={!activeContact || sendingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className={[
                        'shrink-0 h-[42px] w-[42px] md:h-[53px] md:w-[53px] rounded-[14px] transition grid place-items-center',
                        'bg-[#262626] hover:bg-[#303030] text-white/80',
                        sendingImage ? 'cursor-wait' : '',
                      ].join(' ')}
                      title="Send image"
                      aria-busy={sendingImage || undefined}
                    >
                      {sendingImage ? (
                        <Spinner size={22} />
                      ) : (
                        <Image src="/image.svg" width={24} height={24} alt="image" className="md:w-[25px] md:h-[25px]"/>
                      )}
                    </button>
                  )}

                  {isRecording ? (
                    <button
                      type="button"
                      onClick={stopAndSendRecording}
                      className="shrink-0 h-[42px] w-[42px] md:h-[53px] md:w-[53px] rounded-[14px] bg-white text-black transition grid place-items-center hover:opacity-90"
                      title="Send voice message"
                    >
                      <Image src="/send.svg" width={25} height={25} alt="send" className="md:w-[25px] md:h-[25px]"/>
                    </button>
                  ) : canSend ? (
                    <button
                      type="button"
                      className="shrink-0 h-[42px] w-[42px] md:h-[53px] md:w-[53px] rounded-[14px] text-black transition grid place-items-center bg-white hover:opacity-90"
                      title="Send"
                      onClick={onSend}
                    >
                      <Image src="/send.svg" width={25} height={25} alt="send" className="md:w-[25px] md:h-[25px]"/>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!activeContact || sendingVoice}
                      onClick={startRecording}
                      className={[
                        'shrink-0 h-[42px] w-[42px] md:h-[53px] md:w-[53px] rounded-[14px] text-white transition grid place-items-center',
                        'bg-[#262626] hover:bg-[#303030]',
                        sendingVoice ? 'opacity-60 cursor-not-allowed' : '',
                      ].join(' ')}
                      title="Record voice message"
                    >
                      {sendingVoice ? (
                        <span className="h-[16px] w-[16px] rounded-full border-2 border-current border-t-transparent animate-spin" />
                      ) : (
                        <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                          <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
                          <path d="M5 11a7 7 0 0014 0M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {addOpen && (
            <div className="absolute inset-0 z-[999] bg-black">
              {/* top bar */}
              <div className="h-[91px] border-b border-white/10 flex gap-7 px-8">
                <button type="button" onClick={closeAdd} className="text-white/80 hover:text-white">
                  <Image
                    src="/cancel-svgrepo-com.svg"
                    width={20}
                    height={20}
                    alt="X"
                  />
                </button>
                <div className="mt-[32px] text-white text-[18px] font-medium">Add Contact</div>
              </div>

              {/* body */}
              <div className="h-[calc(100vh-91px)] flex items-center justify-center px-6">
                <div className="w-full max-w-[520px] flex flex-col items-center">
                  {addStep === 'enter' ? (
                    <>
                      <div className="text-white text-[28px] mb-6">Enter Username</div>

                      <input
                        ref={addInputRef}
                        value={addUsername}
                        onLoad={() => {
                          const fit = calcFitZoom();
                          setMinZoom(fit);
                          setZoom(fit);
                          setPan({ x: 0, y: 0 });
                        }}
                        onChange={(e) => setAddUsername(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onNext();
                        }}
                        className="w-full max-w-[430px] h-[46px] rounded-[10px] bg-[#2f2f2f] text-white/90 outline-none px-4 focus-within:ring-2 focus-within:ring-[#2FE4E4]/40"
                      />

                      <button
                        type="button"
                        onClick={onNext}
                        disabled={searching}
                        className="mt-5 w-full max-w-[430px] h-[50px] rounded-[8px] bg-[#26D9D9] text-black font-semibold"
                      >
                        {searching ? <ButtonLoadingLabel label="Searching..." /> : 'Next'}
                      </button>

                      {addError && <div className="mt-4 text-red-400 text-[14px]">{addError}</div>}
                    </>
                  ) : (
                    <>
                      <img
                        src={found?.avatar || '/cat.png'}
                        alt="pfp"
                        className="h-[150px] w-[150px] rounded-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/cat.png';
                        }}
                      />

                      <div className="text-white text-[40px] mb-6">{found?.username}</div>

                      <button
                        type="button"
                        onClick={onAddContact}
                        disabled={adding}
                        className="w-full max-w-[430px] h-[52px] rounded-[8px] bg-[#26D9D9] text-black font-semibold disabled:opacity-70"
                      >
                        {adding ? <ButtonLoadingLabel label="Adding..." /> : 'Add Contact'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddStep('enter')}
                        className="mt-4 text-white/60 hover:text-white/80 text-[14px]"
                      >
                        Back
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          </>
        )}
        {showExitConfirm && (
          <div className="absolute inset-0 z-[9999] flex items-center justify-center px-6">

            {/* backdrop blur */}
            <div className="absolute inset-0 bg-black backdrop-blur-sm" />

            {/* popup */}
            <div className={`relative z-10 w-full max-w-[380px] ${UI.panel} p-6 text-center`}>

              <div className="text-white/85 text-[14.5px] leading-relaxed mb-5">
                If you exit this page the order info will be deleted
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className={`flex-1 ${UI.mutedButton}`}
                >
                  Cancel
                </button>

                <button
                  onClick={exitEscrowFlow}
                  className={`flex-1 ${UI.dangerButton}`}
                >
                  Exit
                </button>
              </div>

            </div>
          </div>
        )}
      </main>
      {showWalletGate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* backdrop blur */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* modal */}
          <div className="relative z-10 w-[420px] max-w-[90%] rounded-2xl bg-[#000000] p-8 text-center border border-white/10 shadow-2xl">
            <div className="mb-6 flex justify-center">
              <img
                src="wallet-svgrepo-com.svg"
                alt="" 
                aria-hidden="true"
                className="h-20 w-20 object-contain opacity-90"
              />
            </div>

            <div className="text-white text-[22px] font-semibold mb-3">
              Connect your wallet
            </div>
            <div className="text-white/60 text-[14px] mb-6">
              You must connect a wallet before using the chat.
            </div>

            <button
              onClick={connectPhantom}
              disabled={connectingWallet}
              aria-busy={connectingWallet}
              className="flex items-center justify-center gap-3 w-full h-[46px] rounded-xl bg-[#2FE4E4] text-black font-semibold hover:brightness-110 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2FE4E4]/50 transition-all duration-200 shadow-[0_10px_30px_rgba(47,228,228,0.12)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img
                src="phantom.webp"
                alt="" 
                aria-hidden="true"
                className="h-[18px] w-[21px] object-cover"
              />
              <span>{connectingWallet ? <ButtonLoadingLabel label="Connecting..." /> : "Connect Phantom"}</span>
            </button>

          </div>
        </div>
      )}
      {showEditProfile && (
        <div
          className="
            fixed inset-0 z-[9999]
            flex min-h-[100dvh] items-center justify-center
            px-4 py-6
          "
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setShowEditProfile(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-md"
            aria-label="Close edit profile"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 40 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="
              relative z-10
              flex w-full max-w-[480px] flex-col
              rounded-t-[32px] sm:rounded-[32px]
              border-t border-white/10 sm:border
              bg-[#09090b]/90
              backdrop-blur-xl
              p-6 sm:p-8
              shadow-[0_-8px_40px_rgba(0,0,0,0.4)] sm:shadow-[0_24px_80px_rgba(0,0,0,0.6)]
            "
          >
            {/* Header */}
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Edit Profile
                </h2>
                <p className="mt-1.5 text-sm text-white/50">
                  Update your profile picture and bio.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowEditProfile(false)}
                className="
                  group grid h-9 w-9 shrink-0 place-items-center
                  rounded-full bg-white/5 text-white/50
                  transition-all
                  hover:bg-white/10 hover:text-white
                  active:scale-90
                "
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Avatar Section */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="
                  group relative flex h-[120px] w-[120px] items-center justify-center
                  overflow-hidden rounded-full
                  border-2 border-white/10
                  bg-[#141414]
                  transition-all duration-300
                  hover:border-[#2FE4E4]/50
                  hover:shadow-[0_0_30px_rgba(47,228,228,0.15)]
                  focus-visible:outline-none
                  focus-visible:ring-4
                  focus-visible:ring-[#2FE4E4]/20
                "
              >
                <img
                  src={avatarSrc}
                  alt="Profile"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={() => setAvatarSrc("/cat.png")}
                />

                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>

                  <span className="text-xs font-semibold text-white">
                    Change Photo
                  </span>
                </div>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setLocalAvatarPreview(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            {/* Bio Section */}
            <div className="mt-8 flex flex-col">
              <label className="mb-2 text-sm font-semibold text-white/90">
                Bio
              </label>

              <div className="relative">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  placeholder="Tell people about yourself..."
                  className="
                    min-h-[120px] w-full resize-none
                    rounded-2xl
                    border border-white/10
                    bg-white/5
                    p-4
                    pr-16
                    text-sm text-white
                    shadow-inner
                    outline-none
                    placeholder:text-white/30
                    transition-all duration-300
                    focus-visible:ring-2
                    focus-visible:ring-[#2FE4E4]/30
                  "
                />

                <div
                  className={`absolute bottom-3 right-4 text-xs font-medium ${
                    bio.length >= 160 ? "text-red-400" : "text-white/40"
                  }`}
                >
                  {bio.length}/160
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="
                group relative mt-8 flex h-[52px] w-full items-center justify-center overflow-hidden
                rounded-2xl
                bg-[#2FE4E4]
                text-base font-bold text-black
                transition-all duration-300
                hover:bg-[#4ff3f3]
                hover:shadow-[0_0_30px_rgba(47,228,228,0.3)]
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-60
                disabled:hover:shadow-none
              "
            >
              {saving ? (
                <svg
                  className="h-5 w-5 animate-spin text-black"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                "Save Changes"
              )}
            </button>
          </motion.div>
        </div>
      )}
      {profileModal && (
        <ProfileViewModal
          uid={profileModal}
          supabase={supabase}
          onClose={() => setProfileModal(null)}
        />
      )}
      {showFeedback && (
        <SendFeedbackModal
          feedbackText={feedbackText}
          setFeedbackText={setFeedbackText}
          feedbackType={feedbackType}
          setFeedbackType={setFeedbackType}
          sendingFeedback={sendingFeedback}
          feedbackError={feedbackError}
          onSubmit={submitFeedback}
          onClose={() => {
            if (sendingFeedback) return;
            setFeedbackError("");
            setShowFeedback(false);
          }}
        />
      )}
      {/* Warning (Delete once deploy) */}
      <ToastContainer />
    </motion.div>
  );
}
