import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "Draw Dispute Mode | Nector",
  description:
    "Learn how Nector's Draw Dispute Mode works, including BTR and STR risk allocation, bond structure, draw outcomes, and economic incentives in escrow disputes.",
  openGraph: {
    title: "Draw Dispute Mode | Nector",
    description:
      "Learn how Nector's Draw Dispute Mode works, including BTR and STR risk allocation, bond structure, draw outcomes, and economic incentives in escrow disputes.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Draw Dispute Mode | Nector",
    description:
      "Learn how Nector's Draw Dispute Mode works, including BTR and STR risk allocation, bond structure, draw outcomes, and economic incentives in escrow disputes.",
  },
  alternates: {
    canonical: "/docs/mode",
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
              Core Concepts
            </div>

            <Image
              src="/back-svgrepo-com.svg"
              width={10}
              height={10}
              alt="breadcrumb arrow"
              className="rotate-180 opacity-60"
            />

            <span className="text-[#9CA3AF] font-medium">
              Draw Dispute Mode
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Draw Dispute Mode
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            <span
              className="text-[#26D9D9]"
            >
              The Draw Dispute Mode defines how financial risk is distributed between the buyer and seller{" "}
            </span>
              in the event of an unresolved dispute.
              Instead of relying on trust or reputation alone, Nector uses programmable economic incentives to determine which party bears greater risk when a dispute ends in a draw.
          </p>

          {/* Section */}
          <h2 id="purpose" className="mt-16 text-4xl font-bold text-white mb-5">
            Purpose
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Draw Dispute Mode exists to:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Force both parties to pre-commit to risk before a transaction begins.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            In Nector, a transaction will only happen if at least one party is willing to take on more risk.
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If neither side accepts the risk conditions, the deal does not proceed.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This mechanism ensures that:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Risk is explicitly priced into every transaction</li>
            <li>Both parties understand the consequences of failure</li>
            <li>No trade occurs without mutual agreement on risk</li>
          </ul>

          {/* Section */}
          <h2 id="mode-types" className="mt-16 text-4xl font-bold text-white mb-5">
            Mode Types
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector supports two modes for physical products:
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Buyer Take Risk (BTR)
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer bears the greater financial loss if the dispute ends in a draw.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Seller Take Risk (STR)
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller bears the greater financial loss if the dispute ends in a draw.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Digital Products
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            For digital products, the system defaults to:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Buyer Take Risk (BTR)
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This is because delivery is immediate via file upload, making it impossible for the seller to falsely claim shipment.
          </p>

          {/* Section */}
          <h2 id="bond-structure" className="mt-16 text-4xl font-bold text-white mb-5">
            Bond Structure
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The bond structure determines how much each party must stake.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Let P = product price
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Buyer Take Risk (BTR)
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer deposits: P + 20% of P</li>
            <li>Seller deposits: 20% of P</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Seller Take Risk (STR)
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer deposits: P + 20% of P</li>
            <li>Seller deposits: 120% of P</li>
          </ul>

          {/* Section */}
          <h2 id="draw-outcome" className="mt-16 text-4xl font-bold text-white mb-5">
            Draw Outcome
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If a dispute reaches a draw:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All funds locked in escrow will be burned
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This includes:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Product price</li>
            <li>Buyer bond</li>
            <li>Seller bond</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All funds will be burned.
          </p>

          {/* Section */}
          <h2 id="economic" className="mt-16 text-4xl font-bold text-white mb-5">
            Economic Consequences
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The system is intentionally asymmetric.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            In Buyer Take Risk (BTR)
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer loses significantly more than the seller in a draw</li>
            <li>Seller’s downside is limited</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            In Seller Take Risk (STR)
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Seller loses significantly more than the buyer in a draw</li>
            <li>Buyer’s downside is limited</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This asymmetry is not a flaw. It is the core mechanism that enables:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Risk negotiation between strangers
          </p>

          {/* Section */}
          <h2 id="decision-logic" className="mt-16 text-4xl font-bold text-white mb-5">
            User Decision Logic
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller selects the Draw Dispute Mode when creating an order.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer is shown a clear warning before funding the escrow, including:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Who bears more risk</li>
            <li>Exact bond amounts</li>
            <li>Total potential loss in a draw</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the buyer does not agree with the selected mode:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>They simply do not fund the escrow.</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This creates a natural negotiation loop where:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Sellers adjust risk to attract buyers</li>
            <li>Buyers choose deals based on acceptable risk</li>
          </ul>

          {/* Section */}
          <h2 id="incentive-design" className="mt-16 text-4xl font-bold text-white mb-5">
            Incentive Design
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Draw Dispute Mode discourages dishonest behavior by making disputes financially costly.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Key properties:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Both parties lose funds in a draw</li>
            <li>One party always loses more</li>
            <li>No party benefits from escalating conflict</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This ensures that:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The optimal strategy is to resolve disputes early rather than escalate.</li>
          </ul>

          {/* Section */}
          <h2 id="example" className="mt-16 text-4xl font-bold text-white mb-5">
            Example Scenarios
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Assume a product priced at $100.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Buyer Take Risk (BTR)
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer deposits: $120</li>
            <li>Seller deposits: $20</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the dispute ends in a draw:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer loses $120</li>
            <li>Seller loses $20</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Seller Take Risk (STR)
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer deposits: $120</li>
            <li>Seller deposits: $120</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the dispute ends in a draw:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer loses $120</li>
            <li>Seller loses $120</li>
          </ul>

          {/* Section */}
          <h2 id="security" className="mt-16 text-4xl font-bold text-white mb-5">
            Security Philosophy
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector does not attempt to determine truth. Instead, it ensures that:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Lying, delaying, or refusing to resolve a dispute results in financial loss.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This creates a system where:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Honest behavior is the most rational strategy</li>
            <li>Dishonest behavior is economically discouraged</li>
            <li>Disputes are resolved through incentives, not judgment</li>
          </ul>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}