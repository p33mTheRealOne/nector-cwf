import Link from "next/link";
import NavbarDocs from "@/components/docs/navbarDocs";
import DocsSidebar from "@/components/docs/DocsSidebar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "Introduction | Nector",
  description:
    "Learn what Nector is, how it works, and how it solves escrow problems in modern online transactions.",
  openGraph: {
    title: "Introduction | Nector",
    description:
      "Learn what Nector is, how it works, and how it solves escrow problems in modern online transactions.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Introduction | Nector",
    description:
      "Learn what Nector is, how it works, and how it solves escrow problems in modern online transactions.",
  },
  alternates: {
    canonical: "/docs/introduction",
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
              Introduction
            </span>
          </nav>

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            Introduction
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          {/* Intro text */}
          <p className="max-w-4xl text-[18px] leading-10 text-[#E5E7EB]">
            This page provides a complete overview of Nector. What it is, why it exists, and how it redefines escrow for modern online transactions. You’ll learn about the problems with traditional escrow systems, why trust is a core challenge in peer-to-peer commerce, and how Nector solves it through a chat-native, non-custodial approach.{" "}
            <span
              className="text-[#26D9D9]"
            >
              By the end of this page, you will understand how Nector works, what makes it different, and how it enables safe, simple, and trustless transactions for both users and developers
            </span>
          </p>

          {/* Section */}
          <h2 id="what-is-nector" className="mt-16 text-4xl font-bold text-white mb-5">
            What is Nector (Escrow Platform)?
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            <span
              className="text-[#26D9D9]"
            >
              Nector is a chat-native, non-custodial escrow platform{" "}
            </span>
              that allows people to safely trade digital and physical products. Even with complete strangers. Unlike traditional escrow services, Nector is designed to be simple enough for everyday users who have no knowledge of crypto or escrow systems. The platform removes complex terminology, confusing workflows, and mandatory KYC processes that often prevent people from using escrow tools. Users can negotiate deals directly in chat and create an escrow order inside the conversation. Funds are locked in a smart contract and automatically released according to predefined rules. Nector also introduces Nector Mini, a developer toolkit that allows marketplaces, communities, and applications to integrate escrow functionality directly into their own platforms. In short, Nector makes safe online transactions as easy as sending a message.
          </p>

          {/* Section */}
          <h2 id="problem" className="mt-16 text-4xl font-bold text-white mb-5">
            Problem Nector solves
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Buyers fear paying and never receiving the product.
            Sellers fear delivering the product and never getting paid.
            Although escrow services exist today, fraud still happens frequently. The problem is not the lack of escrow technology. It is accessibility and usability.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Most existing escrow solutions suffer from several issues:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Complex interfaces that normal users do not understand</li>
            <li>Technical language that requires prior knowledge of escrow systems</li>
            <li>Mandatory KYC processes that create friction</li>
            <li>Centralized administrators who manually resolve disputes</li>
            <li>Slow dispute resolution processes</li>
          </ul>

          <p className="mt-4 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Because of these barriers, many people especially younger online entrepreneurs and small sellers choose not to use escrow at all.
            As a result, scams continue to occur even though escrow services exist.
            Nector solves this by making escrow simple, automatic, and accessible to anyone.
          </p>

          {/* Section */}
          <h2 id="why-escrow" className="mt-16 text-4xl font-bold text-white mb-5">
            Why Escrow is Needed?
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Escrow is one of the most fundamental mechanisms for enabling safe transactions between parties that do not trust each other.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Without escrow, one side must take the risk first:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>The buyer risks paying before receiving the product</li>
            <li>The seller risks delivering the product before receiving payment</li>
          </ul>

          <p className="mt-4 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Escrow removes this problem by introducing a neutral mechanism that holds funds until the terms of the agreement are satisfied.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            This is particularly important for:
          </h3>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>freelance work</li>
            <li>digital product sales</li>
            <li>peer-to-peer trading</li>
            <li>marketplace transactions</li>
            <li>online communities</li>
          </ul>

          <p className="mt-4 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            As the internet continues to expand global commerce, the ability to transact safely with strangers becomes increasingly important.
          </p>

          {/* Section */}
          <h2 id="why-nector" className="mt-16 text-4xl font-bold text-white mb-5">
            Why Nector is different?
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector rethinks escrow from the ground up. Instead of building another complex financial tool, Nector focuses on user experience, automation, and decentralization. Key differences include:
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Chat-Native Escrow
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Escrow orders are created directly inside a conversation.
            Users can negotiate terms and finalize transactions in the same interface.
            No switching apps. No complicated forms.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            No Admin Dispute Resolution
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Traditional escrow platforms rely on human moderators to resolve disputes.
            Nector removes the need for centralized decision makers by using deterministic smart contract rules and incentive bonds.
            Disputes resolve automatically based on protocol rules rather than human judgment.
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Designed for Normal Users
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Most crypto products assume the user understands wallets, signatures, and smart contracts.
            Nector is built for people who have never used crypto before.
            The interface hides complexity and focuses on simple actions such as: Create order, Fund escrow, Ship item, Confirm delivery
          </p>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            Built for Developers
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector is not only a platform. It is also infrastructure.
            Through Nector Mini, developers can integrate escrow functionality into their own applications using:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>open-source smart contracts</li>
            <li>SDKs and APIs</li>
            <li>reference implementations</li>
          </ul>

          <p className="mt-4 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This allows marketplaces, communities, and trading platforms to embed trustless escrow directly into their products.
          </p>

          {/* Section */}
          <h2 id="vision" className="mt-16 text-4xl font-bold text-white mb-5">
            Vision
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector aims to become the escrow infrastructure of the internet, simplifying secure transactions between strangers. In the future, any application enabling the trade of goods, services, or digital assets will be able to integrate Nector's escrow protocol. Looking ahead, we will consolidate revenue from transaction fees and penalties to fund Nector1k. This initiative will reward developers with $1,000 each for building open-source projects using Nector Mini or Nector Smart Contracts, fostering a community-driven ecosystem for secure digital trade. The long-term goal is simple: to make safe online transactions universal, automatic, and trustless
          </p>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}