import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Documentation | Nector",
  description:
    "Nector documentation covering escrow protocol design, smart contract architecture, dispute systems, timeout logic, and developer tools to build escrow-powered applications on Solana.",
  openGraph: {
    title: "Documentation | Nector",
    description:
      "Nector documentation covering escrow protocol design, smart contract architecture, dispute systems, timeout logic, and developer tools to build escrow-powered applications on Solana.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documentation | Nector",
    description:
      "Nector documentation covering escrow protocol design, smart contract architecture, dispute systems, timeout logic, and developer tools to build escrow-powered applications on Solana.",
  },
  alternates: {
    canonical: "/docs",
  }
};

export default function Docs() {
  return (
    <div className="bg-black min-h-screen text-white flex flex-col">
      <NavbarDocs />

      {/* ================= MOBILE SIDEBAR ================= */}
      <div className="md:hidden">
        {/* checkbox control */}
        <input id="docs-menu" type="checkbox" className="peer hidden" />

        {/* ปุ่มเปิด menu (มุมซ้ายล่าง) */}
        <label
          htmlFor="docs-menu"
          className="fixed bottom-5 left-5 z-50 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2E2E2E] bg-[#111111] text-white shadow-lg cursor-pointer"
        >
          ☰
        </label>

        {/* overlay */}
        <label
          htmlFor="docs-menu"
          className="fixed inset-0 z-40 bg-black/50 opacity-0 pointer-events-none transition peer-checked:opacity-100 peer-checked:pointer-events-auto"
        />

        {/* sidebar slide */}
        <div className="fixed left-0 top-0 z-50 h-screen w-[280px] -translate-x-full bg-black transition-transform duration-300 peer-checked:translate-x-0">
          
          {/* ปุ่มปิด */}
          <div className="flex h-[70px] items-center justify-end border-b border-[#2E2E2E] px-4">
            <label htmlFor="docs-menu" className="cursor-pointer text-white text-xl">
              ✕
            </label>
          </div>

          {/* sidebar จริง */}
          <DocsSidebar className="!sticky !top-0 !h-[calc(100vh-70px)] !border-r-0" />
        </div>
      </div>

      {/* ================= LAYOUT ================= */}
      <div className="flex items-start">
        
        {/* Desktop sidebar */}
        <DocsSidebar className="hidden md:block" />

        {/* Content */}
        <main className="flex-1 pt-[110px] px-4 md:px-8 pb-16">
          <article className="max-w-5xl">
            
            {/* Breadcrumb */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-sm mb-5"
            >
              <Link
                href="/docs"
                className="text-[#1FFFE0] font-medium hover:opacity-80 transition"
              >
                Documentation
              </Link>
              
            </nav>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Documentation
            </h1>

            <div className="border-t border-[#1F2937] mb-5" />

            {/* Intro */}
            <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
              This documentation provides a complete guide to understanding and building with Nector.
            </p>

            <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
              It covers everything from core concepts and protocol design to developer tools and smart contract architecture, allowing you to quickly learn how the system works and how to integrate it into your own applications.
            </p>

          {/* Section */}
          <h2 id="learn" className="mt-16 text-4xl font-bold text-white mb-5">
            What You’ll Learn
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            By reading this documentation, you will understand:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>How Nector enables trustless transactions between strangers</li>
            <li>How the escrow lifecycle works from start to finish</li>
            <li>How disputes are handled without relying on centralized arbitration</li>
            <li>How economic incentives enforce honest behavior</li>
            <li>How to integrate Nector into your own applications</li>
          </ul>

          </article>
        </main>
      </div>

      <Footer />
    </div>
  );
}