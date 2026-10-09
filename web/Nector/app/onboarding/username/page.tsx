'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function UsernameOnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // กันคนยังไม่ login แอบเข้ามา
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) router.replace('/auth?mode=signin');

      const display = (data.user?.user_metadata as any)?.display_name;
      if (display && String(display).trim()) {
        router.replace('/'); // มีแล้ว ไม่ต้อง onboarding
      }
    })();
  }, [router, supabase]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const u = username.trim();
    if (!u) return setMsg('Please enter a username.');

    setLoading(true);
    try {
      // ยิง API ที่จะ "จอง username" และ set display_name (แข็งสุด)
      const res = await fetch('/api/auth/set-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.error === 'USERNAME_TAKEN') return setMsg('Username is already taken.');
        if (data?.error === 'INVALID_USERNAME') return setMsg('Invalid username (3-20 chars: a-z 0-9 . _).');
        return setMsg(data?.error ?? 'Failed to save username.');
      }

      router.replace('/'); // เสร็จแล้วเข้าระบบ
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-[520px] rounded-[18px] bg-black/60 border border-white/10 px-10 py-10">
        <h1 className="text-center text-white text-[34px] font-medium">Choose a username</h1>
        <p className="mt-2 text-center text-white/70 text-[14px]">
          This will be your display name.
        </p>

        <form onSubmit={onSave} className="mt-8 space-y-5">
          <div className="space-y-2">
            <div className="text-white text-[14px] font-medium">Username</div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="w-full h-[46px] rounded-[8px] bg-[#222222] text-white px-4 outline-none"
              placeholder="e.g. peem_15"
            />
          </div>

          {msg && <div className="text-center text-[13px] text-white/80">{msg}</div>}

          <button
            disabled={loading}
            className="w-full h-[52px] rounded-[8px] bg-[#2FE4E4] text-black font-semibold text-[16px] disabled:opacity-70"
          >
            {loading ? 'Saving…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
