import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "Dispute System | Nector",
  description:
    "Understand how Nector's dispute system works, including dispute initiation, response windows, economic penalties, and automated resolution without human intervention.",
  openGraph: {
    title: "Dispute System | Nector",
    description:
      "Understand how Nector's dispute system works, including dispute initiation, response windows, economic penalties, and automated resolution without human intervention.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dispute System | Nector",
    description:
      "Understand how Nector's dispute system works, including dispute initiation, response windows, economic penalties, and automated resolution without human intervention.",
  },
  alternates: {
    canonical: "/docs/dispute",
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
              Dispute System
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Dispute System
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            <span
              className="text-[#26D9D9]"
            >
              The Nector dispute system is designed to resolve conflicts without human intervention
            </span>
                , using time-based rules and economic incentives.
                Instead of relying on moderators or arbitration, disputes are handled through a structured process where outcomes are determined by user actions and deadlines.
          </p>

          {/* Section */}
          <h2 id="overview" className="mt-16 text-4xl font-bold text-white mb-5">
            Overview
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            A dispute can only be initiated by the buyer during the review phase if:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The item has not been received</li>
            <li>The item does not match the description</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
           Once a dispute is opened, the transaction enters a time-bound resolution flow involving both parties.
          </p>

          {/* Section */}
          <h2 id="dispute-initiation" className="mt-16 text-4xl font-bold text-white mb-5">
            1. Dispute Initiation
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer opens a dispute directly from the order interface.
            The reason for the dispute is automatically derived from the buyer’s review responses:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Item not received</li>
            <li>Item not as described</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
           Each order can only have one active dispute, preventing repeated or spam disputes.
          </p>

          {/* Section */}
          <h2 id="response-window" className="mt-16 text-4xl font-bold text-white mb-5">
            2. Seller Response Window
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            After a dispute is opened, the seller has 24 hours to respond.
            The seller has three options:
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Refund
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller may choose to cancel the transaction.
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Outcome:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer receives full refund (price + bond)</li>
            <li>Seller receives their bond back</li>
            <li>No penalties are applied</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This path is designed to encourage fast resolution without conflict.
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Respond
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller may choose to contest the dispute.
          </p>

          <p className="mt-4 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This moves the order into the discussion phase, where both parties can negotiate.
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            No Response
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the seller does not respond within 24 hours:
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Outcome:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The dispute is resolved in favor of the buyer</li>
            <li>The seller is penalized</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Penalty structure:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>20% of the product price is taken from the seller’s bond half of that goes to buyer and other will be burned</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All remaining funds are returned to their original owners.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This ensures that ignoring disputes is economically irrational.
          </p>

          {/* Section */}
          <h2 id="discussion-phase" className="mt-16 text-4xl font-bold text-white mb-5">
            3. Discussion Phase
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the seller responds, the dispute enters a 24-hour discussion window.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            During this phase:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Both parties can communicate and resolve the issue</li>
            <li>No funds move unless an action is taken</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Available Actions During Discussion
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Buyer:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Release payment to the seller (complete the order)</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Seller:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Issue a refund (cancel the order)</li>
          </ul>

          {/* Section */}
          <h2 id="draw-resolution" className="mt-16 text-4xl font-bold text-white mb-5">
            4. Draw Resolution
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the discussion period expires without any action:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The dispute results in a draw
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Outcome:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>All funds locked in escrow will be burned</li>
            <li>Both parties incur financial loss</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This mechanism discourages:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Endless negotiation</li>
            <li>Strategic stalling</li>
            <li>Bad-faith disputes</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            By making inaction costly, the system forces participants to actively resolve conflicts.
          </p>

          {/* Section */}
          <h2 id="final-outcomes" className="mt-16 text-4xl font-bold text-white mb-5">
            5. Final Outcomes
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Every dispute ends in one of the following:
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Refund
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Initiated by seller</li>
            <li>No penalties</li>
            <li>All funds returned</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Buyer Win
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Seller fails to respond</li>
            <li>Buyer receives compensation</li>
            <li>Seller is penalized</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Draw
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>No resolution during discussion</li>
            <li>Both parties lose funds</li>
          </ul>

          {/* Section */}
          <h2 id="abuse-prevention" className="mt-16 text-4xl font-bold text-white mb-5">
            6. Abuse Prevention
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The dispute system is designed to prevent manipulation:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Single dispute per order prevents spam</li>
            <li>Response deadlines prevent stalling</li>
            <li>Economic penalties discourage dishonest behavior</li>
            <li>Draw mechanism prevents infinite negotiation</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The system ensures that:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The most rational strategy for both parties is to act honestly and resolve disputes quickly.
          </p>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}