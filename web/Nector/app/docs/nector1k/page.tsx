import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Nector1K | Nector",
  description:
    "Get reward $1k for building an open-source project with Nector Mini or Nector Smart Contract",
  openGraph: {
    title: "Nector1K | Nector",
    description:
      "Get reward $1k for building an open-source project with Nector Mini or Nector Smart Contract",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nector1K | Nector",
    description:
      "Get reward $1k for building an open-source project with Nector Mini or Nector Smart Contract",
  },
  alternates: {
    canonical: "/docs/nector1k",
  }
};

export default function Docs() {
  return (
    <div className="bg-black min-h-screen text-white flex flex-col">
      <div className="bg-black min-h-screen text-white">
        <NavbarDocs />
      <div className="md:hidden">
        <input id="docs-mobile-menu" type="checkbox" className="peer hidden" />

        {/* ปุ่มเปิด menu มุมล่างซ้าย */}
        <label
          htmlFor="docs-mobile-menu"
          className="fixed bottom-5 left-5 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-[#2E2E2E] bg-[#111111] text-white shadow-lg"
        >
          <span className="text-2xl leading-none">☰</span>
        </label>

        {/* overlay */}
        <label
          htmlFor="docs-mobile-menu"
          className="fixed inset-0 z-40 bg-black/50 opacity-0 pointer-events-none transition-opacity duration-300 peer-checked:opacity-100 peer-checked:pointer-events-auto"
        />

        {/* sidebar slide from left */}
        <div
          className="fixed left-0 top-0 z-50 h-screen w-[280px] -translate-x-full bg-black transition-transform duration-300 peer-checked:translate-x-0"
        >
          {/* ปุ่มปิด */}
          <div className="flex h-[70px] items-center justify-end border-b border-[#2E2E2E] px-4">
            <label
              htmlFor="docs-mobile-menu"
              className="cursor-pointer rounded-lg px-3 py-2 text-white hover:bg-[#111111]"
            >
              <Image src="/cancel-svgrepo-com.svg" width={18} height={18} alt="X" />
            </label>
          </div>

          <DocsSidebar className="!sticky !top-0 !h-[calc(100vh-70px)] !border-r-0" />
        </div>
      </div>
      <div className="flex items-start">
        <DocsSidebar className="hidden md:block" />

      <main className="flex-1 pt-[110px] px-4 md:px-8 pb-16">
        <article className="max-w-5xl">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm mb-5">
            <div
              className="text-[#26D9D9] font-medium hover:opacity-80 transition"
            >
              Developer
            </div>

            <Image
              src="/back-svgrepo-com.svg"
              width={10}
              height={10}
              alt="breadcrumb arrow"
              className="rotate-180 opacity-60"
            />

            <span className="text-[#9CA3AF] font-medium">
              Nector1K
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Nector1K
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            Get rewarded $1,000 for building an open-source project using Nector Mini or the Nector Smart Contract. Develop innovative escrow-powered applications, share your work publicly, and contribute to the future of trustless online transactions.
          </p>

          <div className="mt-10 flex flex-col items-start gap-2">
            <button
              disabled
              className="px-6 py-2 rounded-xl border border-[#26D9D9]/30 bg-[#26D9D9] text-black font-bold cursor-not-allowed"
            >
              Coming Soon
            </button>

            <p className="mt-2 text-sm text-[#A6A6A6]">
              Submissions will open soon. Stay tuned.
            </p>
          </div>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}