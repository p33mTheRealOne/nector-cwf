import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "Security Model | Nector",
  description:
    "Learn how Nector secures escrow transactions through deterministic state transitions, time-based constraints, economic penalties, and a non-custodial smart contract design.",
  openGraph: {
    title: "Security Model | Nector",
    description:
      "Learn how Nector secures escrow transactions through deterministic state transitions, time-based constraints, economic penalties, and a non-custodial smart contract design.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Security Model | Nector",
    description:
      "Learn how Nector secures escrow transactions through deterministic state transitions, time-based constraints, economic penalties, and a non-custodial smart contract design.",
  },
  alternates: {
    canonical: "/docs/security",
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
              Security Model
            </div>

          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Security Model
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            <span
              className="text-[#26D9D9]"
            >
              The Nector protocol is designed to operate in a trust-minimized environment
            </span>
                , where participants may act dishonestly and no central authority exists to resolve disputes.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Instead of relying on verification of real-world events, Nector enforces security through:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Deterministic state transitions</li>
            <li>Time-based constraints</li>
            <li>Economic penalties</li>
          </ul>

          {/* Section */}
          <h2 id="threat-model" className="mt-16 text-4xl font-bold text-white mb-5">
            Threat Model
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The primary adversaries in the system are:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyers attempting to obtain goods without paying</li>
            <li>Sellers attempting to receive payment without delivering</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol does not assume honest behavior from either party.
          </p>

          {/* Section */}
          <h2 id="constraints" className="mt-16 text-4xl font-bold text-white mb-5">
           Constraints
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Attackers are limited by:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Strict state machine enforcement</li>
            <li>Time-based execution rules</li>
            <li>On-chain validation of all transitions</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Unauthorized actions, invalid state transitions, or early timeout triggers are rejected at the contract level.
          </p>

          {/* Section */}
          <h2 id="trust-assumptions" className="mt-16 text-4xl font-bold text-white mb-5">
            Trust Assumptions
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol makes minimal assumptions:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>block.timestamp is reasonably accurate</li>
            <li>Users understand and accept risk warnings before funding</li>
            <li>The underlying blockchain (Solana) is secure</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            There is:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>No admin key</li>
            <li>No upgrade authority (if deployed as immutable)</li>
            <li>No privileged access to escrow funds</li>
          </ul>

          {/* Section */}
          <h2 id="non-custodial" className="mt-16 text-4xl font-bold text-white mb-5">
            Non-Custodial Design
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All funds are stored in program-derived escrow accounts (PDAs).
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Properties:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>No private key controls the escrow</li>
            <li>Funds can only move via program instructions</li>
            <li>Configure environment variables</li>
            <li>The platform cannot arbitrarily withdraw funds</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This ensures:
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol is non-custodial by design.
          </p>

          {/* Section */}
          <h2 id="buyer-fraud" className="mt-16 text-4xl font-bold text-white mb-5">
            Buyer Fraud
          </h2>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            Scenario:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Buyer receives the item but falsely claims non-delivery and escalates to dispute.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Outcome:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>If the dispute reaches draw = buyer loses bond + payment</li>
            <li>If seller does not respond = buyer wins but seller is penalized</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Analysis:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Attempting to cheat introduces financial risk.
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The buyer cannot guarantee profit from dishonest behavior.
          </p>

          {/* Section */}
          <h2 id="seller-fraud" className="mt-16 text-4xl font-bold text-white mb-5">
            Seller Fraud
          </h2>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            Scenario:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Seller marks item as shipped without actually delivering.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Outcome:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Buyer can open dispute</li>
            <li>If unresolved → draw → seller loses bond</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Analysis:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            False shipment claims are economically discouraged.
          </p>

          {/* Section */}
          <h2 id="collusion-attack" className="mt-16 text-4xl font-bold text-white mb-5">
            Collusion Attack
          </h2>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            Scenario:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Buyer and seller collude to manipulate the system (e.g., fake orders → force draw).
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Outcome:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Both parties lose funds in draw</li>
            <li>All funds will be burned</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Analysis:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Collusion is self-destructive and does not yield profit.
          </p>

          {/* Section */}
          <h2 id="timeout-attack" className="mt-16 text-4xl font-bold text-white mb-5">
            Timeout Attack
          </h2>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            Scenario:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            A participant refuses to act (e.g., does nothing to delay outcome).
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Outcome:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Seller inactivity = buyer win + penalty</li>
            <li>Buyer inactivity = seller gets paid</li>
            <li>Both inactive → draw → both lose</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Analysis:
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Inaction is always penalized.
          </p>

          {/* Section */}
          <h2 id="bot-risk" className="mt-16 text-4xl font-bold text-white mb-5">
            Keeper / Bot Risk
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol relies on external actors to trigger timeouts.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Risk:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>If no one triggers = order remains in current state</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Mitigation:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Permissionless execution (anyone can trigger)</li>
            <li>Open-source keeper bots</li>
            <li>Incentive for third-party automation</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Reality Check:
          </h3>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Liveness depends on off-chain actors.</li>
          </ul>

          {/* Section */}
          <h2 id="contract-attack" className="mt-16 text-4xl font-bold text-white mb-5">
            Smart Contract Attack Surface
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The contract’s attack surface includes:
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            1. State Transition Validation
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Incorrect state checks could allow:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Skipping phases</li>
            <li>Triggering unauthorized payouts</li>
          </ul>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Mitigation:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Strict state matching in every instruction</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            2. Lamport Manipulation
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Direct lamport transfers (try_borrow_mut_lamports) must ensure:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>No underflow / overflow</li>
            <li>No double-spend via reentrancy-like patterns</li>
          </ul>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Mitigation:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Solana runtime prevents reentrancy</li>
            <li>Explicit balance accounting required</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            3. PDA Integrity
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Incorrect seeds or account substitution could allow:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Escrow hijacking</li>
            <li>Unauthorized fund movement</li>
          </ul>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Mitigation:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Deterministic PDA derivation</li>
            <li>Anchor account constraints</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            4. Missing Field Separation (Critical)
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The contract currently overwrites bond_lamports.
          </p>

          <h4 className="mt-7 text-xl font-bold text-white mb-2">
            Risk:
          </h4>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Loss of distinction between buyer and seller bond</li>
            <li>Incorrect payout logic in edge cases</li>
          </ul>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            5. Time Validation
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Reliance on block.timestamp introduces:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Minor manipulation risk by validators</li>
          </ul>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            However:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Impact is limited to small timing shifts</li>
            <li>Does not enable economic exploits</li>
          </ul>

          {/* Section */}
          <h2 id="economic-security" className="mt-16 text-4xl font-bold text-white mb-5">
            Economic Security
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The protocol is secured primarily through economic design.
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            Core Principle
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Dishonest behavior must be less profitable than honest behavior.
            Current Reality (Brutal Truth)
          </p>

          <h3 className="mt-7 text-2xl font-bold text-white mb-2">
            Conclusion
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The system reduces fraud, but does not eliminate all profitable attack scenarios.
          </p>

          {/* Section */}
          <h2 id="griefing-attacks" className="mt-16 text-4xl font-bold text-white mb-5">
            Griefing Attacks
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Attackers may attempt to:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Force disputes</li>
            <li>Waste counterparty time</li>
            <li>Trigger draw intentionally</li>
          </ul>

          <h3 className="mt-5 text-2xl font-bold text-white mb-2">
            Outcome:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Attacker incurs financial loss</li>
            <li>No asymmetric gain</li>
          </ul>

          {/* Section */}
          <h2 id="platform-incentives" className="mt-16 text-4xl font-bold text-white mb-5">
            Platform Incentives
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The platform receives:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Transaction fees</li>
          </ul>

          {/* Section */}
          <h2 id="security-philosophy" className="mt-16 text-4xl font-bold text-white mb-5">
            Security Philosophy
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector does not attempt to determine truth.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Instead, it enforces the following rule:
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Every participant must commit capital, and failure to resolve conflicts results in loss.
          </p>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}