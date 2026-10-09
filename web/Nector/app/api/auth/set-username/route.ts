import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

function normalizeUsername(raw: string) {
  return raw.trim().toLowerCase();
}

function isValidUsername(u: string) {
  // lowercase only
  return /^[a-z0-9._]{3,20}$/.test(u);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const u = normalizeUsername(String(body?.username ?? ''));

  if (!isValidUsername(u)) {
    return NextResponse.json({ error: 'INVALID_USERNAME' }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  // reserve (atomic)
  const { error: reserveErr } = await supabase
    .from('usernames')
    .insert({ username: u, user_id: user.id });

  if (reserveErr) {
    return NextResponse.json({ error: 'USERNAME_TAKEN' }, { status: 409 });
  }

  // update auth metadata -> store lowercase only
  const { error: updateErr } = await supabase.auth.updateUser({
    data: {
      display_name: u,
      full_name: u,
      name: u,
    },
  });

  if (updateErr) {
    await supabase.from('usernames').delete().eq('username', u); // rollback กันชื่อค้าง
    return NextResponse.json({ error: updateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, username: u });
}
