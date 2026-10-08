// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 1) refresh + read user (ห้ามใช้ getSession อย่างเดียว เพราะ user_metadata อาจ stale)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 2) allowlist (กันลูป / กัน auth พัง)
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/onboarding/username') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  // ถ้ายังไม่ login -> ไม่ต้องยุ่ง ปล่อยให้หน้า / ของคุณตัดสินใจเอง
  if (!user) return response;

  // 3) เช็ค display_name (trim กันเคส " ")
  const displayName = (user.user_metadata as any)?.display_name;
  const hasUsername = !!displayName && String(displayName).trim().length > 0;

  // ✅ login แล้ว แต่ยังไม่มี username
  if (!hasUsername && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/onboarding/username';
    url.search = ''; // กันการลาก query เก่าๆ มาทำให้ flow แปลก
    return NextResponse.redirect(url);
  }

  // ✅ มี username แล้ว แต่ยังพยายามเข้าหน้า onboarding -> ส่งกลับ /
  if (hasUsername && pathname.startsWith('/onboarding/username')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // ใช้ของเดิมคุณได้เลย
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
