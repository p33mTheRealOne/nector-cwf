// app/api/profile/sync-avatar/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "MISSING_ENV" }, { status: 500 });
  }

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { error: "NOT_LOGGED_IN", detail: userErr?.message ?? null },
      { status: 401 }
    );
  }

  const rawAvatar =
    (user.user_metadata?.avatar_url as string) ||
    (user.user_metadata?.picture as string) ||
    "";

  if (!rawAvatar) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const avatarUrl = rawAvatar.includes("?") ? rawAvatar : `${rawAvatar}?sz=256`;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const imgRes = await fetch(avatarUrl, { cache: "no-store" });
  if (!imgRes.ok) {
    return NextResponse.json(
      { error: "FETCH_AVATAR_FAILED", status: imgRes.status },
      { status: 400 }
    );
  }

  const contentType = imgRes.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await imgRes.arrayBuffer();
  const file = new Uint8Array(arrayBuffer);

  const filePath = `${user.id}.jpg`;

  const { error: upErr } = await admin.storage.from("profiles").upload(filePath, file, {
    upsert: true,
    contentType,
    cacheControl: "3600",
  });

  if (upErr) {
    return NextResponse.json(
      { error: "UPLOAD_FAILED", detail: upErr.message },
      { status: 400 }
    );
  }

  const { data: pub } = admin.storage.from("profiles").getPublicUrl(filePath);
  const publicUrl = pub.publicUrl;

  const { error: profErr } = await admin
    .from("profiles")
    .upsert({ id: user.id, avatar_url: publicUrl }, { onConflict: "id" });

  if (profErr) {
    return NextResponse.json(
      { error: "PROFILE_UPSERT_FAILED", detail: profErr.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, avatar_url: publicUrl });
}
