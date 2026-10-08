import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "Timeout System | Nector",
  description:
    "Learn how Nector's Timeout System works, including shipping, review, response, and discussion deadlines, and how automated rules enforce transaction progress.",
  openGraph: {
    title: "Timeout System | Nector",
    description:
      "Learn how Nector's Timeout System works, including shipping, review, response, and discussion deadlines, and how automated rules enforce transaction progress.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Timeout System | Nector",
    description:
      "Learn how Nector's Timeout System works, including shipping, review, response, and discussion deadlines, and how automated rules enforce transaction progress.",
  },
  alternates: {
    canonical: "/docs/timeout",
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
              Timeout System
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Timeout System
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            <span
              className="text-[#26D9D9]"
            >
              The Timeout System enforces deadlines across the entire transaction lifecycle.{" "}
            </span>
              It ensures that:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#E5E7EB] list-disc pl-6 space-y-2">
            <li>No party can stall the process</li>
            <li>All actions must be taken within defined time windows</li>
            <li>Inaction leads to automatic and deterministic outcomes</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            Timeouts are a core part of Nector’s design, replacing the need for manual intervention or dispute moderators.
          </p>

          {/* Section */}
          <h2 id="overview" className="mt-16 text-4xl font-bold text-white mb-5">
            Overview
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector defines four types of timeouts:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Shipping Timeout</li>
            <li>Review Timeout</li>
            <li>Response Timeout</li>
            <li>Discussion Timeout</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Each timeout corresponds to a specific phase of the transaction and enforces strict deadlines.
          </p>

          {/* Section */}
          <h2 id="shipping-timeout" className="mt-16 text-4xl font-bold text-white mb-5">
            1. Shipping Timeout
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The shipping timer begins once both parties have fully funded the escrow.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller must complete the required delivery action within the defined shipping time:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Physical products = mark as shipped</li>
            <li>Digital products = upload the file</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            If the seller fails to act in time:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>20% of the product price is deducted from the seller’s bond half of that goes to the buyer and the other half will be burned</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All remaining funds are returned to their original owners.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Key Property
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Delaying shipment is economically penalized, making inactivity irrational for the seller.
          </p>

          {/* Section */}
          <h2 id="review-timeout" className="mt-16 text-4xl font-bold text-white mb-5">
            2. Review Timeout
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The review timer begins when:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The seller marks the item as shipped (physical), or</li>
            <li>The digital file is delivered</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer has 24 hours to take one of the following actions:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Confirm the order</li>
            <li>Open a dispute</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            If the buyer confirms:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Payment is released to the seller</li>
            <li>Bonds are returned</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            If the buyer does nothing:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Payment is automatically released to the seller</li>
            <li>Bonds are returned</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Key Property
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Buyers cannot delay indefinitely. Inaction benefits the seller.
          </p>

          {/* Section */}
          <h2 id="response-timeout" className="mt-16 text-4xl font-bold text-white mb-5">
            3. Response Timeout
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The response timer begins when the buyer opens a dispute.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller has 24 hours to respond by choosing one of the following:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Refund the buyer</li>
            <li>Respond and enter discussion</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            If the seller does not respond:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The dispute is resolved in favor of the buyer</li>
            <li>The seller is penalized</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Penalty structure:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>20% of the product price is deducted from the seller’s bond half of that goes to the buyer and the other half will be burned</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All remaining funds are returned.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Key Property
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Ignoring disputes results in guaranteed financial loss for the seller.
          </p>

          {/* Section */}
          <h2 id="discussion-timeout" className="mt-16 text-4xl font-bold text-white mb-5">
            4. Discussion Timeout
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The discussion timer begins when the seller chooses to respond to a dispute.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Both parties enter a 24-hour negotiation window.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            During this phase:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer can release payment to the seller</li>
            <li>Seller can issue a refund</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            If no action is taken:
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The dispute resolves as a draw
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Draw Outcome:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>All funds in escrow will be burned</li>
            <li>Funds will be burned</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Key Property
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Prolonging disputes without resolution results in losses for both parties.
          </p>

          {/* Section */}
          <h2 id="trigger-mechanism" className="mt-16 text-4xl font-bold text-white mb-5">
            Trigger Mechanism
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Smart contracts cannot execute actions autonomously.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All timeout transitions must be triggered by an external transaction.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector uses a keeper bot system that continuously monitors orders and triggers timeout functions when deadlines are reached.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            However:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Any external party can trigger a timeout</li>
            <li>The smart contract enforces that execution is only valid after the deadline</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            This ensures that:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The system remains decentralized and does not rely on a single trusted actor.
          </p>

          {/* Section */}
          <h2 id="automation-reliability" className="mt-16 text-4xl font-bold text-white mb-5">
            Automation and Reliability
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The keeper bot ensures that timeouts are executed even if:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Users are offline</li>
            <li>No manual action is taken</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Because the contract logic is public, anyone can run their own bot to monitor and trigger timeouts.
          </p>

          {/* Section */}
          <h2 id="time-source" className="mt-16 text-4xl font-bold text-white mb-5">
            Time Source
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All time-based logic relies on:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>block.timestamp</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This ensures consistent and verifiable timing across all transactions.
          </p>

          {/* Section */}
          <h2 id="anti-abuse" className="mt-16 text-4xl font-bold text-white mb-5">
            Anti-Abuse Design
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The timeout system is designed to eliminate stalling strategies:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Sellers cannot delay shipping without penalty</li>
            <li>Buyers cannot delay review without benefiting the seller</li>
            <li>Sellers cannot ignore disputes without losing funds</li>
            <li>Both parties cannot stall indefinitely during disputes</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Each phase introduces time pressure combined with financial consequences, ensuring that:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The rational strategy is always to act within the allowed timeframe.
          </p>

          {/* Section */}
          <h2 id="edge-case" className="mt-16 text-4xl font-bold text-white mb-5">
            Edge Case Handling
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Even in edge cases, such as:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Seller marking shipment at the last possible moment</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The system remains safe:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The buyer still receives a full review window</li>
            <li>No timing exploit provides economic advantage</li>
          </ul>

          {/* Section */}
          <h2 id="design-philosophy" className="mt-16 text-4xl font-bold text-white mb-5">
            Design Philosophy
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector does not rely on user honesty.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Instead, it enforces behavior through constraints:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Every action has a deadline. Every delay has a cost.
          </p>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}