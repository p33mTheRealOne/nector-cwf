import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "How Nector works | Nector",
  description:
    "Learn how Nector works, including escrow funding, order creation, dispute modes, and how trustless transactions are executed.",
  openGraph: {
    title: "How Nector works | Nector",
    description:
      "Learn how Nector works, including escrow funding, order creation, dispute modes, and how trustless transactions are executed.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Nector works | Nector",
    description:
      "Learn how Nector works, including escrow funding, order creation, dispute modes, and how trustless transactions are executed.",
},
  alternates: {
    canonical: "/docs/how-it-works",
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
              Getting Started
            </div>

            <Image
              src="/back-svgrepo-com.svg"
              width={10}
              height={10}
              alt="breadcrumb arrow"
              className="rotate-180 opacity-60"
            />

            <span className="text-[#9CA3AF] font-medium">
              How Nector Works
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            How Nector Works
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            <span
              className="text-[#26D9D9]"
            >
              Nector enables safe transactions between strangers by combining chat-based interaction, non-custodial escrow, and deterministic dispute resolution.{" "}
            </span>
            Each transaction follows a structured lifecycle where funds are locked in a smart contract and released based on predefined rules, deadlines, and user actions.
          </p>

          {/* Section */}
          <h2 id="order-creation" className="mt-16 text-4xl font-bold text-white mb-5">
            1. Order Creation
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            A transaction begins when the seller creates an escrow order.
          </p>

          <p className="mt-2 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller must define:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Product type (Physical or Digital)</li>
            <li>Product details (Images, Description and Name)</li>
            <li>Price (In $ dollars)</li>
            <li>Shipping date (for physical Maximum: 30 Days) or Shipping time (for digital Maximum: 48 Hours)</li>
            <li>Draw Dispute mode (BTR: Buyer Take Risk or STR: Seller Take Risk)</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Before funding the escrow, the buyer is shown a clear breakdown of:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Total payment required</li>
            <li>Bond amounts for both parties</li>
            <li>Platform fees (1%)</li>
            <li>Draw dispute warning based on the selected mode</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            For example:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer Take Risk (BTR): Buyer loses more if a dispute ends in a draw</li>
            <li>Seller Take Risk (STR): Seller loses more if a dispute ends in a draw</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This ensures both parties understand the economic consequences before entering the deal.
          </p>

          {/* Section */}
          <h2 id="escrow-funding" className="mt-16 text-4xl font-bold text-white mb-5">
            2. Escrow Funding (Smart Contract Deposit Process)
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The escrow is funded in two steps:
          </p>

          <ol className="mt-2 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-decimal pl-6 space-y-4">
            <li>
              The buyer deposits:
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li>Product price (in dollars)</li>
                <li>Buyer bond (20% of product price)</li>
              </ul>
            </li>
            <li>
              The seller deposits:
              <ul className="mt-3 list-disc pl-6 space-y-2">
                <li>Seller bond (depends on draw dispute mode)</li>
              </ul>
            </li>
          </ol>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Draw dispute mode determines bond structure:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-4">
            <li>
              BTR:
              <ul className="mt-2 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
                <li>Buyer bond = 20% of product price</li>
                <li>Seller bond = 20% of product price</li>
              </ul>
            </li>
            <li>
              STR:
              <ul className="mt-2 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
                <li>Buyer bond = 20% of product price</li>
                <li>Seller bond = 120% of product price</li>
              </ul>
            </li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the seller does not fund the escrow, the buyer can withdraw all funds.
            Once both parties have funded, the escrow becomes active and the shipping timer begins.
          </p>

          {/* Section */}
          <h2 id="shipping" className="mt-16 text-4xl font-bold text-white mb-5">
            3. Shipping / Delivery
          </h2>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Physical Products
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller must mark the item as shipped within the defined shipping time.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller can also cancel the order at any time during the shipment, in which case the order is terminated and all funds are fully refunded to both parties.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the seller fails to do so:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The seller loses 20% of the product price. half of that is given to the buyer and the other half is burned.</li>
            <li>All remaining funds are refunded</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            No proof is required at this stage. The system relies on economic incentives and penalties.
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Digital Products
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller uploads the digital file after funding the escrow.
          </p>

          <p className="mt-1 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer can access the file before confirming the order.
          </p>

          {/* Section */}
          <h2 id="review-phase" className="mt-16 text-4xl font-bold text-white mb-5">
            4. Review Phase
          </h2>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Physical Products
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            After the item is marked as shipped (or delivered digitally), the buyer enters the review phase.
          </p>

          <p className="mt-1 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer must respond within 24 hours.
          </p>

          <p className="mt-1 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer is asked two questions:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Have you received the item?</li>
            <li>Is the item as described?</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Outcomes:
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the buyer confirms both:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The seller receives the payment</li>
            <li>Both parties receive their bonds back</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the buyer does nothing:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The payment is automatically released to the seller</li>
            <li>Bonds are returned</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the buyer reports an issue:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>A dispute is opened</li>
          </ul>

          {/* Section */}
          <h2 id="dispute-system" className="mt-16 text-4xl font-bold text-white mb-5">
            5. Dispute System
          </h2>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            When a dispute is opened, the seller must act within 24 hours.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The seller has three options:
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Refund
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>All funds are returned to both parties</li>
            <li>No penalties are applied</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Respond
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The dispute enters a discussion phase</li>
            <li>Both parties can negotiate</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            During this phase:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The buyer can release payment manually</li>
            <li>The seller can still choose to refund</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            No Response
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the seller does not respond:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The dispute is automatically resolved in favor of the buyer</li>
            <li>The seller loses their bond</li>
            <li>A portion of the bond is transferred to the buyer and burned</li>
          </ul>

          {/* Section */}
          <h2 id="discussion-phase" className="mt-16 text-4xl font-bold text-white mb-5">
            6. Discussion Phase
          </h2>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the seller responds, both parties enter a timed discussion window.
          </p>

          <p className="mt-1 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            During this phase:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer and seller can resolve the issue manually</li>
            <li>Either party can finalize the deal (payment or refund)</li>
          </ul>

          {/* Section */}
          <h2 id="draw-resolution" className="mt-16 text-4xl font-bold text-white mb-5">
            7. Draw Resolution
          </h2>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            If the discussion period expires without resolution:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The dispute results in a draw
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            In a draw:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>All funds in escrow will be burned</li>
            <li>Both parties lose their entire locked balance</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This mechanism ensures that:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Prolonging disputes without resolution is economically irrational.
          </p>

          {/* Section */}
          <h2 id="timeout-system" className="mt-16 text-4xl font-bold text-white mb-5">
            8. Timeout System
          </h2>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector enforces deadlines at every stage to prevent stalling:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Shipping timeout : seller must ship within time</li>
            <li>Review timeout : buyer must review within 24h</li>
            <li>Response timeout : seller must respond to disputes within 24h</li>
            <li>Discussion timeout : dispute must resolve within 24h</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All timeouts are enforced by the smart contract and can be triggered automatically.
          </p>

          {/* Section */}
          <h2 id="final-outcomes" className="mt-16 text-4xl font-bold text-white mb-5">
            9. Final Outcomes
          </h2>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Every transaction ends in one of three outcomes:
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Complete
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer confirms the order</li>
            <li>Seller receives payment</li>
            <li>Bonds are returned</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Buyer Wins
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Seller fails to respond</li>
            <li>Buyer receives refund + compensation</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-5">
            Draw
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Both parties fail to resolve the dispute</li>
            <li>All funds will be burned</li>
          </ul>

          {/* Section */}
          <h2 id="digital-physical" className="mt-16 text-4xl font-bold text-white mb-5">
            10. Digital vs Physical Flow
          </h2>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The core flow remains the same, with one key difference:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Physical products: require shipping confirmation</li>
            <li>Digital products: are delivered instantly via file upload</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            For digital goods, the system cannot verify correctness directly.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Instead, Nector relies on economic incentives:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Attempting to cheat leads to financial loss, making fraud irrational.</li>
          </ul>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}