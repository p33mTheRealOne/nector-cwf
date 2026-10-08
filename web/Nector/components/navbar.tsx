//vvvvvvvvvvvvvvvvvvvvv Show username vvvvvvvvvvvvvvvvvvvvvv

//const { data } = await supabase.auth.getUser();
//const displayName = data.user?.user_metadata?.display_name;


import Link from 'next/link';
import Image from 'next/image';
import HamburgerMenu from '@/components/HamburgerMenu';

export default function Navbar() {
  return (
    <nav className="
      fixed
      top-0
      left-0
      w-full
      bg-black
      h-[70px]
      border-b-2
      border-[#2E2E2E]
      z-50
    ">

      {/* ================= MOBILE / TABLET ================= */}
      <div className="flex lg:hidden items-center justify-between h-full px-4">
        {/* Logo */}
        <Link href="/">
          <Image
            src="/1103.jpg"
            width={40}
            height={40}
            alt="logo"
            className="absolute left-[24.05px] top-1/2 -translate-y-1/2"
          />
        </Link>

        {/* Hamburger */}
        <HamburgerMenu />
      </div>

      {/* ================= DESKTOP ================= */}
      <div className="hidden lg:block">
        <Link href="/">
          <Image
            src="/1103.jpg"
            width={46.487}
            height={46.487}
            alt="logo"
            className="absolute left-[24.05px] top-1/2 -translate-y-1/2"
          />
        </Link>

        <a href='/#howitworks' className="absolute left-[104.3px] top-1/2 -translate-y-1/2 text-[16.8px] text-[#A6A6A6] hover:text-gray-300">
          How it Works?
        </a>

        <a href="/#features" className="absolute left-[252.7px] top-1/2 -translate-y-1/2 text-[16.8px] text-[#A6A6A6] hover:text-gray-300">
          Features
        </a>

        <a href="/#FAQ" className="absolute left-[357px] top-1/2 -translate-y-1/2 text-[16.8px] text-[#A6A6A6] hover:text-gray-300">
          FAQ
        </a>

        <Link href="/docs/nector-mini" className="absolute left-[424.2px] top-1/2 -translate-y-1/2 text-[16.8px] text-[#A6A6A6] hover:text-gray-300">
          Developers
        </Link>

        <Link href="/docs" className="absolute left-[549.5px] top-1/2 -translate-y-1/2 text-[16.8px] text-[#A6A6A6] hover:text-gray-300">
          Documentation
        </Link>

        <div className="absolute right-[32.9px] top-1/2 -translate-y-1/2 flex items-center gap-[23.1px]">
          <Link href="/auth?mode=signin" className="text-white text-[16.8px] hover:text-gray-300">
            Sign in
          </Link>

          <Link
            href="/auth"
            className="bg-[#2FE4E4] text-black text-[16.8px]
                       w-[77px] h-[32.9px] rounded-[7px]
                       flex items-center justify-center
                       hover:bg-[#29d0d0] transition"
          >
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}
