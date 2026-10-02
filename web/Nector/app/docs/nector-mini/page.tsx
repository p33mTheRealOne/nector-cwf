import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "Nector Mini | Nector",
  description:
    "Nector Mini is an open-source escrow SDK for developers. Build escrow-powered apps with web UI, timeout bots, Solana smart contract support, and escrow-protected NFT trading.",
  openGraph: {
    title: "Nector Mini | Nector",
    description:
      "Nector Mini is an open-source escrow SDK for developers. Build escrow-powered apps with web UI, timeout bots, Solana smart contract support, and escrow-protected NFT trading.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nector Mini | Nector",
    description:
      "Nector Mini is an open-source escrow SDK for developers. Build escrow-powered apps with web UI, timeout bots, Solana smart contract support, and escrow-protected NFT trading.",
  },
  alternates: {
    canonical: "/docs/nector-mini",
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
              Nector Mini
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Nector Mini
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            <span
              className="text-[#26D9D9]"
            >
              Nector Mini is an open-source starter kit{" "}
            </span>
                that enables developers to launch a fully functional chat-based escrow platform without building from scratch, including escrow-protected NFT buying and selling without the usual buyer and seller bonds.
                It combines frontend, backend integration, and automation tooling into a single package, allowing rapid deployment and customization.
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
                View Nector Mini on Github
              </p>
              <p className="text-[#A6A6A6] text-sm leading-6 max-w-[520px]">
                The complete Nector Mini source code (including Next.js and Timeout bots) is publicly accessible here. This repo contains all the guides to getting started with Nector Mini.
              </p>

              <Link
                href="https://github.com/p33mTheRealOne/nector-mini" // ใส่ repo จริง
                target="_blank"
                className="inline-block mt-4 text-[#26D9D9] font-medium hover:opacity-80 transition"
              >
                View on GitHub →
              </Link>
            </div>
          </div>

          {/* Section */}
          <h2 id="what-is" className="mt-16 text-4xl font-bold text-white mb-5">
            What is Nector Mini?
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector Mini is a pre-built escrow application layer built on top of the Nector smart contract. It includes:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>A working chat-based escrow UI</li>
            <li>Integrated transaction flows</li>
            <li>Timeout automation (keeper bot)</li>
            <li>Ready-to-use smart contract interface (IDL)</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Developers can clone the repository, run it locally, and immediately interact with a live escrow system.
          </p>

          {/* Section */}
          <h2 id="target" className="mt-16 text-4xl font-bold text-white mb-5">
           Target Users
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector Mini is designed for:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Developers building marketplaces</li>
            <li>Founders launching escrow-based platforms</li>
            <li>Teams that need secure transaction flows without deep blockchain expertise</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            It is especially useful for developers who:
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Want to build an escrow platform, NFT marketplace, or trading system, but do not want to implement smart contracts, bots, escrow protection, and UI from scratch.
          </p>

          {/* Section */}
          <h2 id="core" className="mt-16 text-4xl font-bold text-white mb-5">
            Core Use Case
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The primary use case is:
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Launching a custom chat-based escrow platform or escrow-protected NFT trading platform quickly.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Examples include:
          </p>

          <ol className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-decimal pl-6 space-y-2">
            <li>Freelance marketplaces</li>
            <li>Digital goods and NFT platforms</li>
            <li>Peer-to-peer trading and NFT buy &amp; sell systems</li>
            <li>Service-based transactions</li>
          </ol>

          {/* Section */}
          <h2 id="integration-model" className="mt-16 text-4xl font-bold text-white mb-5">
            Integration Model
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Integration is designed to be frictionless:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Clone the GitHub repository</li>
            <li>Install dependencies</li>
            <li>Configure environment variables</li>
            <li>Run the application</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This results in a fully functional escrow platform connected to the Nector smart contract, including protected NFT transactions without the usual buyer and seller bonds.
          </p>

          {/* Section */}
          <h2 id="abstraction-level" className="mt-16 text-4xl font-bold text-white mb-5">
            Abstraction Level
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector Mini abstracts away blockchain complexity. Developers do not need to:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Write smart contracts</li>
            <li>Handle low-level transaction logic</li>
            <li>Build timeout automation</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The included IDL provides a ready-to-use interface for interacting with the contract.
          </p>

          {/* Section */}
          <h2 id="features" className="mt-16 text-4xl font-bold text-white mb-5">
            Features
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector Mini includes:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Chat-based transaction interface</li>
            <li>Escrow creation, funding, and escrow-protected NFT buy &amp; sell flows</li>
            <li>Dispute handling UI with penalties burned instead of sent to a wallet</li>
            <li>Integrated API layer</li>
            <li>Automated timeout bot</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All components are designed to work together out of the box.
          </p>

          {/* Section */}
          <h2 id="permission-model" className="mt-16 text-4xl font-bold text-white mb-5">
            Permission Model
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector Mini is fully open-source.
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>No approval required</li>
            <li>No API keys required</li>
            <li>confirm delivery</li>
            <li>No platform dependency</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Developers can fork, modify, and deploy independently.
          </p>

          {/* Section */}
          <h2 id="customization" className="mt-16 text-4xl font-bold text-white mb-5">
            Customization
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Developers can customize at multiple levels:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>UI Layer</li>
            <li>Modify layout, branding, and UX</li>
            <li>Application Logic</li>
            <li>Adjust flows and interaction design</li>
            <li>Protocol Layer</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Modify fees, dispute logic, penalty behavior, and transaction rules by editing the smart contract
            Because the system is modular:
            Developers can replace or extend any layer without breaking the core system.
          </p>

          {/* Section */}
          <h2 id="revenue-model" className="mt-16 text-4xl font-bold text-white mb-5">
            Revenue Model
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector Mini is completely free to use.
            Developers are free to:
          </p>

          <ul className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Monetize their own platforms</li>
            <li>Modify fee structures</li>
            <li>Integrate custom business logic</li>
          </ul>

          {/* Section */}
          <h2 id="why-not" className="mt-16 text-4xl font-bold text-white mb-5">
            Why Not Build From Scratch?
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Building an escrow system independently requires:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Smart contract development</li>
            <li>Secure fund management</li>
            <li>Timeout automation infrastructure</li>
            <li>Dispute resolution logic</li>
            <li>Frontend and backend integration</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This significantly increases complexity, cost, and risk.
            Nector Mini eliminates this overhead by providing:
            A production-ready foundation that can be deployed immediately.
            Design Philosophy
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector Mini is built on a simple principle:
            Developers should focus on building their product — not reinventing escrow infrastructure.
          </p>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}
