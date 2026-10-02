import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { wallet, signature, message } = await req.json();

  if (!wallet || !signature || !message) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const ok = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    bs58.decode(signature),
    bs58.decode(wallet)
  );

  if (!ok) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const email = `wallet-${wallet.toLowerCase()}@phantom.local`;
  const password = crypto.randomUUID() + crypto.randomUUID();

  const { error: createErr } = await admin.auth.admin.createUser({
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

  return NextResponse.json({
    ok: true,
    token_hash: link.properties?.hashed_token,
  });
}