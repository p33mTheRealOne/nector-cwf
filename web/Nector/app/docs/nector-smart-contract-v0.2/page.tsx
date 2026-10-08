import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "Nector Smart Contract V0.2 | Nector",
  description:
    "Explore the Nector Smart Contract V0.2 architecture, including state machine design, escrow lifecycle, PDAs, instructions, fee model, penalty burning, and security model.",
  openGraph: {
    title: "Nector Smart Contract V0.2 | Nector",
    description:
      "Explore the Nector Smart Contract V0.2 architecture, including state machine design, escrow lifecycle, PDAs, instructions, fee model, penalty burning, and security model.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nector Smart Contract V0.2 | Nector",
    description:
      "Explore the Nector Smart Contract V0.2 architecture, including state machine design, escrow lifecycle, PDAs, instructions, fee model, penalty burning, and security model.",
  },
  alternates: {
    canonical: "/docs/nector-smart-contract-v0.1",
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
              Nector Smart Contract V0.2
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Nector Smart Contract V0.2
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            <span
              className="text-[#26D9D9]"
            >
              Nector is implemented as a single on-chain program that manages the full lifecycle of an escrow order
            </span>
              , including funding, delivery, dispute resolution, and timeout enforcement.

              The program is designed as a deterministic state machine, where every transition is governed by strict rules, access controls, time constraints, and economic conditions.

              A key change in V0.2 is the treatment of penalties. Penalties are no longer sent to the Nector platform or its fee wallet. Instead, penalty funds are permanently burned.

              Nector generates protocol revenue through predefined escrow fees rather than user penalties. This removes the platform's financial incentive to benefit from disputes, timeouts, or other penalty-triggering outcomes.

              All source code is open-source and publicly verifiable.
          </p>

          {/* GitHub CTA */}
          <div className="mt-8 max-w-4xl rounded-2xl border border-[#2E2E2E] bg-[#0D0D0D] p-6 flex items-start justify-between gap-6">
            <div>
              <Image
                src="/github-svgrepo-com.svg"
                width={20}
                height={20}
                alt="github"
              />
              <p className="mt-4 text-white font-semibold text-lg mb-2">
                View Nector Smart Contract V0.2 Code
              </p>
              <p className="text-[#A6A6A6] text-sm leading-6 max-w-[520px]">
                The complete Nector Smart Contract V0.2 source code (Rust, TypeScript and Keeper bots) is publicly accessible here.
                The V0.2 program is designed to operate under the deterministic rules described in this documentation.
              </p>

              <Link
                href="https://github.com/p33mTheRealOne/nector-smart-contract-V0.2" // ใส่ repo จริง
                target="_blank"
                className="inline-block mt-4 text-[#26D9D9] font-medium hover:opacity-80 transition"
              >
                View on GitHub →
              </Link>
            </div>
          </div>

          {/* Section */}
          <h2 id="program-scope" className="mt-16 text-4xl font-bold text-white mb-5">
            Program Scope
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The Nector smart contract handles the complete escrow lifecycle within a single on-chain program.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Core responsibilities include:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Order creation and initialization</li>
            <li>Escrow funding (buyer and seller)</li>
            <li>Delivery tracking (physical and digital)</li>
            <li>Dispute initiation and resolution</li>
            <li>Timeout enforcement</li>
            <li>Bond and penalty logic</li>
            <li>Fee collection</li>
            <li>Fund distribution and settlement</li>
            <li>Permanent burning of penalty funds</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The program is modular at the instruction level but operates as a unified escrow system.
          </p>

          {/* Section */}
          <h2 id="core-accounts" className="mt-16 text-4xl font-bold text-white mb-5">
           Core Accounts
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol relies on three primary accounts:
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            SellerAccount
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            A minimal seller profile used for:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Tracking order count</li>
            <li>Deriving deterministic PDAs</li>
            <li>Associating orders with a seller</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Order
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The main state container for each transaction.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Stores:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer and seller addresses</li>
            <li>Product type and mode</li>
            <li>Price and bond configuration</li>
            <li>Current state</li>
            <li>Timestamps for each phase</li>
            <li>Order index</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This account represents the full lifecycle of a transaction.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            EscrowAccount
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            A PDA-controlled account that holds locked funds.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Stores:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Associated order</li>
            <li>Buyer address</li>
            <li>Total amount locked</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All escrowed lamports are held directly in this account until a valid state transition determines their final destination.
          </p>

          {/* Section */}
          <h2 id="state-machine" className="mt-16 text-4xl font-bold text-white mb-5">
            State Machine
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Each order follows a strict state transition model:
          </p>

          <ol className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-decimal pl-6 space-y-2">
            <li>Created</li>
            <li>BuyerFunded</li>
            <li>SellerFunded</li>
            <li>MarkShipped</li>
            <li>Completed</li>
          </ol>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Alternative Paths
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Cancellation
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>BuyerFunded → Cancelled</li>
            <li>SellerFunded → Cancelled</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Shipping Timeout
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>SellerFunded → ShippingTimedOut</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Any applicable penalty is permanently burned rather than transferred to Nector.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Dispute Flow
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>MarkShipped → OpenDispute</li>
            <li>OpenDispute → SellerResponded</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            From here:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>No response → BuyerWonDispute</li>
            <li>Seller refunds → Refunded</li>
            <li>Buyer pays → Completed</li>
            <li>No resolution → Draw</li>
          </ul>

          {/* Section */}
          <h2 id="instruction-set" className="mt-16 text-4xl font-bold text-white mb-5">
            Instruction Set
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The program exposes the following instructions:
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Initialization
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>init_seller</li>
            <li>create_order</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Funding
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>buyer_fund_escrow</li>
            <li>seller_fund_escrow</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Order Control
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>buyer_cancel</li>
            <li>seller_cancel</li>
            <li>mark_shipped</li>
            <li>confirm_delivery</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Dispute
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>open_dispute</li>
            <li>respond_dispute</li>
            <li>refund_buyer</li>
            <li>refund_during_discuss</li>
            <li>pay_seller_during_discuss</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Timeout & Resolution
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>shipping_timeout</li>
            <li>confirm_timeout</li>
            <li>buyer_win</li>
            <li>draw</li>
          </ul>

          {/* Section */}
          <h2 id="fund-flow" className="mt-16 text-4xl font-bold text-white mb-5">
            Fund Flow
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol uses native SOL (lamports) for all transactions.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Escrow Entry
          </h3>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Buyer funding:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Transfers product price + 20% bond to escrow</li>
            <li>Pays predefined protocol fee separately</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Seller funding:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Transfers bond based on mode</li>
            <li>Pays predefined protocol fee</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Protocol fees are the source of Nector's revenue.
          </p>

          <h3 className="mt-10 text-2xl font-bold text-white mb-5">
            Escrow Exit
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Funds are released based on outcome:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Completion → seller receives payment</li>
            <li>Refund → eligible funds returned</li>
            <li>Buyer win → applicable penalty is permanently burned</li>
            <li>Timeout → applicable penalty is permanently burned</li>
            <li>Draw → funds are handled according to the draw settlement rules, while applicable penalties are burned</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Penalty funds are not redirected to Nector's treasury or fee wallet.
          </p>

          {/* Section */}
          <h2 id="pda-design" className="mt-16 text-4xl font-bold text-white mb-5">
            PDA Design
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The program uses deterministic PDA derivation:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>SellerAccount → [b"seller", seller_pubkey]</li>
            <li>Order → [b"order", seller_pubkey, order_index]</li>
            <li>Escrow → [b"escrow", order_pubkey]</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Anchor handles bump validation internally.
          </p>

          {/* Section */}
          <h2 id="time-tracking" className="mt-16 text-4xl font-bold text-white mb-5">
            Time Tracking
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All timing logic is stored on-chain within the Order account.
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Tracked timestamps include:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>seller_funded_at</li>
            <li>mark_shipped_at</li>
            <li>open_dispute_at</li>
            <li>seller_respond_at</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            These timestamps are used to validate timeout conditions.
          </p>

          {/* Section */}
          <h2 id="access-control" className="mt-16 text-4xl font-bold text-white mb-5">
            Access Control
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Access is enforced at the instruction level:
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Buyer-only actions:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>fund escrow</li>
            <li>cancel (early)</li>
            <li>confirm delivery</li>
            <li>open dispute</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Seller-only actions:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>create order</li>
            <li>fund escrow</li>
            <li>mark shipped</li>
            <li>respond to dispute</li>
            <li>refund</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Public actions (anyone can trigger):
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>timeout functions</li>
            <li>dispute resolution transitions</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This allows both users and external bots to execute state transitions.
          </p>

          {/* Section */}
          <h2 id="timeout-execution" className="mt-16 text-4xl font-bold text-white mb-5">
            Timeout Execution
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Smart contracts cannot execute transactions autonomously.
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All timeout transitions require an external transaction.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Nector supports:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Keeper bots that monitor deadlines</li>
            <li>Permissionless execution (anyone can trigger)</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Each timeout is implemented as a separate instruction:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>shipping_timeout</li>
            <li>confirm_timeout</li>
            <li>buyer_win</li>
            <li>draw</li>
          </ul>

          {/* Section */}
          <h2 id="security-model" className="mt-16 text-4xl font-bold text-white mb-5">
            Security Model
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The contract does not attempt to verify real-world events.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Instead, it operates under the following assumptions:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Shipment is not verifiable on-chain</li>
            <li>Product quality cannot be objectively validated</li>
            <li>Users may act dishonestly</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            To compensate, the system relies on:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Bond staking</li>
            <li>Time-based penalties</li>
            <li>Economic loss in unresolved disputes</li>
            <li>Permanent penalty burning</li>
            <li>Predefined protocol fees</li>
          </ul>

          {/* Section */}
          <h2 id="limitations" className="mt-16 text-4xl font-bold text-white mb-5">
            Limitations
          </h2>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            The contract intentionally does not solve:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Proof of delivery</li>
            <li>Product authenticity verification</li>
            <li>Off-chain fraud</li>
            <li>Subjective dispute resolution</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Instead, it enforces:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Financial consequences for dishonest or inactive behavior.</li>
            <li>Permanent burning of applicable penalties.</li>
          </ul>

          {/* Section */}
          <h2 id="design-choices" className="mt-16 text-4xl font-bold text-white mb-5">
            Critical Design Choices
          </h2>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            1. Penalties Are Burned
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            V0.2 permanently burns penalty funds instead of transferring them to the Nector platform or its fee wallet.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This means:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Penalties are not protocol revenue</li>
            <li>Nector cannot claim burned penalty funds</li>
            <li>The platform does not financially benefit from disputes or timeout penalties</li>
            <li>Penalty-triggering outcomes do not directly increase platform revenue</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            2. Revenue Comes From Fees
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector's protocol revenue comes from predefined escrow fees.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Fees are separate from penalties and are collected as part of the normal operation of the protocol.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This creates a clearer economic separation:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Normal escrow activity → protocol fees</li>
            <li>User misconduct or timeout → burned penalties</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            3. No Incentive to Create Penalties
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Because penalties are burned, Nector does not receive the penalty funds.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The platform therefore has no direct economic incentive to:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Encourage disputes</li>
            <li>Prefer timeout outcomes</li>
            <li>Increase penalty amounts</li>
            <li>Create artificial penalty-triggering conditions</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            4. Deterministic Settlement
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All fund movements and state transitions are governed by the smart contract.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol does not rely on a centralized operator to manually decide when funds should be released.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            5. Non-Custodial Escrow
          </h3>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Escrowed funds are controlled by the smart contract and its deterministic rules rather than by a centralized Nector wallet.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector does not need custody of user escrow funds to operate the protocol.
          </p>
        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}