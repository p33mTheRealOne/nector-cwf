import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bs58 from "bs58";
import { randomBytes } from "crypto";
import { NONCE_TTL_MS, buildSignInMessage, getSiteInfo } from "@/lib/siws";
import { getClientIp, hashIp } from "@/lib/clientIp";

export const runtime = "nodejs";

// Max nonces one IP address can request within one nonce lifetime (5 minutes).
// Limiting by IP, not wallet, so nobody can lock another person's wallet out.
const MAX_NONCES_PER_IP = 20;

function isValidWallet(wallet: unknown): wallet is string {
  if (typeof wallet !== "string" || wallet.length < 32 || wallet.length > 44) {
    return false;
  }
  try {
    return bs58.decode(wallet).length === 32;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const wallet = body?.wallet;

  if (!isValidWallet(wallet)) {
    return NextResponse.json({ error: "INVALID_WALLET" }, { status: 400 });
  }

  const site = getSiteInfo(req);

  if (!site) {
    return NextResponse.json({ error: "SITE_NOT_CONFIGURED" }, { status: 500 });
  }

  const ip = getClientIp(req);

  if (!ip && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "NONCE_FAILED" }, { status: 500 });
  }

  const ipHash = ip ? hashIp(ip) : null;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const now = new Date();

  // Housekeeping: remove nonces that expired more than an hour ago.
  await admin
    .from("auth_nonces")
    .delete()
    .lt("expires_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString());

  // Rate limit per IP. Rows expire 5 minutes after creation, so rows that are
  // still unexpired were all created within the last 5 minutes.
  if (ipHash) {
    const { count, error: countErr } = await admin
      .from("auth_nonces")
      .select("nonce", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gt("expires_at", now.toISOString());

    if (countErr) {
      return NextResponse.json({ error: "NONCE_FAILED" }, { status: 500 });
    }

    if ((count ?? 0) >= MAX_NONCES_PER_IP) {
      return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
    }
  }

  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(now.getTime() + NONCE_TTL_MS);

  const message = buildSignInMessage({
    domain: site.domain,
    origin: site.origin,
    address: wallet,
    nonce,
    issuedAt: now,
    expiresAt,
  });

  const { error: insertErr } = await admin.from("auth_nonces").insert({
    nonce,
    wallet,
    domain: site.domain,
    message,
    ip_hash: ipHash,
    expires_at: expiresAt.toISOString(),
  });

  if (insertErr) {
    return NextResponse.json({ error: "NONCE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ nonce, message });
}
