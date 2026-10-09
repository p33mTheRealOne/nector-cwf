import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { getSiteInfo } from "@/lib/siws";

export const runtime = "nodejs";

function verifySignature(message: string, signature: string, wallet: string) {
  try {
    const sig = bs58.decode(signature);
    const pub = bs58.decode(wallet);

    if (sig.length !== 64 || pub.length !== 32) return false;

    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      sig,
      pub
    );
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

  const { wallet, signature, nonce } = body ?? {};

  if (
    typeof wallet !== "string" ||
    typeof signature !== "string" ||
    typeof nonce !== "string" ||
    !wallet ||
    !signature ||
    !nonce
  ) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const site = getSiteInfo(req);

  if (!site) {
    return NextResponse.json({ error: "SITE_NOT_CONFIGURED" }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1) Load the nonce the server issued. Every failure here returns the
  //    same error so callers can't tell why a nonce was rejected.
  const { data: row } = await admin
    .from("auth_nonces")
    .select("nonce, wallet, domain, message, expires_at, used_at")
    .eq("nonce", nonce)
    .maybeSingle();

  const nonceOk =
    !!row &&
    row.used_at === null &&
    row.wallet === wallet &&
    row.domain === site.domain &&
    new Date(row.expires_at).getTime() > Date.now();

  if (!nonceOk || !row) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_NONCE" },
      { status: 401 }
    );
  }

  // 2) The wallet must have signed exactly the message the server stored.
  if (!verifySignature(row.message, signature, wallet)) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  // 3) Use the nonce once. This update succeeds for only one request,
  //    even if two requests arrive at the same time.
  const { data: consumed, error: consumeErr } = await admin
    .from("auth_nonces")
    .update({ used_at: new Date().toISOString() })
    .eq("nonce", nonce)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("nonce");

  if (consumeErr || !consumed || consumed.length !== 1) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_NONCE" },
      { status: 401 }
    );
  }

  const email = `wallet-${wallet.toLowerCase()}@phantom.local`;
  const password = crypto.randomUUID() + crypto.randomUUID();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      wallet_address: wallet,
      auth_provider: "phantom",
    },
  });

  // ถ้ามีอยู่แล้วให้ข้าม
  if (createErr && !createErr.message.toLowerCase().includes("already")) {
    return NextResponse.json({ error: createErr.message }, { status: 400 });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkErr) {
    return NextResponse.json({ error: linkErr.message }, { status: 400 });
  }

  // The wallet was just proven with a signed one-time message, so save it on
  // the profile. Without this row the chat asks the user to connect again.
  const authUserId = created?.user?.id ?? link.user?.id;

  if (authUserId) {
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert({ id: authUserId, wallet_address: wallet }, { onConflict: "id" });

    if (profileErr) {
      console.warn("PHANTOM_PROFILE_UPSERT_WARNING:", profileErr.message);
    }
  }

  return NextResponse.json({
    ok: true,
    token_hash: link.properties?.hashed_token,
  });
}