'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) รอ session ให้มาติดก่อน (หลัง redirect บางครั้งต้องรอ 1-2 tick)
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) break;
        await new Promise((r) => setTimeout(r, 150));
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) router.replace('/auth?mode=signin');
        return;
      }

      // 2) มี session แล้วค่อย sync avatar
      await fetch('/api/profile/sync-avatar', { method: 'POST' }).catch(() => {});

      // 3) ไปหน้า home
      if (!cancelled) router.replace('/');
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      Signing you in…
    </div>
  );
}
