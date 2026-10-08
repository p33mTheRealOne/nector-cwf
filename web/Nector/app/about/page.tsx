import Navbar from "@/components/navbar";
import Image from "next/image";
import Footer from '@/components/Footer';

export const metadata = {
  title: "About | Nector",
  description:
    "Nector is a chat-native escrow platform built on Solana that makes secure transactions simple, trustless, and easy to use. Open-source tools for developers included.",
  openGraph: {
    title: "About | Nector",
    description:
      "Nector is a chat-native escrow platform built on Solana that makes secure transactions simple, trustless, and easy to use. Open-source tools for developers included.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "About | Nector",
    description:
      "Nector is a chat-native escrow platform built on Solana that makes secure transactions simple, trustless, and easy to use. Open-source tools for developers included.",
  },
  alternates: {
    canonical: "/docs/about",
  }
};

export default function Docs() {
  return (
    <div className="bg-black min-h-screen text-white flex flex-col">
      <div className="bg-black min-h-screen text-white">
        <Navbar/>
      <div className="flex items-start">

      <main className="flex-1 pt-[110px] px-4 md:px-8 pb-16">
        <article className="max-w-5xl">

          {/* Title */}
          <h1 className="text-6xl font-bold tracking-tight text-white mb-6">
            About Nector
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          <h2 id="what-is" className="mt-7 text-4xl font-bold text-white mb-5">
            What is Nector?
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector is a chat-native escrow platform built on Solana that makes secure transactions as simple as sending a message.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Instead of dealing with complex financial tools, confusing terms, or slow processes, Nector lets users negotiate, create deals, and complete transactions directly inside chat with funds secured by smart contracts.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            At the same time, Nector is not just a product. It is also a toolkit for developers.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            With Nector Smart Contract, Keeper Bots, and Nector Mini, developers can build their own escrow platforms, fully open-source and ready to run locally.
          </p>

          <h2 id="problem" className="mt-16 text-4xl font-bold text-white mb-5">
            The Problem
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Escrow already exists. But the problem hasn’t gone away.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Most escrow platforms today:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Feel like financial tools instead of user-friendly apps</li>
            <li>Use complex terminology that everyday users don’t understand</li>
            <li>Have slow and manual dispute processes</li>
            <li>Still fail to prevent common scams</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            In short. They are not built for normal people.
          </p>

          <h2 id="our-approach" className="mt-16 text-4xl font-bold text-white mb-5">
            Our Approach
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector is built differently.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            We combine chat + escrow into one simple experience:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>You talk</li>
            <li>You agree</li>
            <li>You create an escrow</li>
            <li>The smart contract handles the rest</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            No complicated steps. No confusing UI.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Just a simple, intuitive flow anyone can use.
          </p>

          <h2 id="different" className="mt-16 text-4xl font-bold text-white mb-5">
            What Makes Nector Different
          </h2>

          <h3 className="mt-5 text-2xl font-bold text-white mb-5">
            1. Simple, Easy-to-Use UI
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector removes complexity completely.
            No financial jargon. No steep learning curve.
            Anyone can use it even without prior knowledge of escrow or crypto.
          </p>

          <h3 className="mt-10 text-2xl font-bold text-white mb-5">
            2. No Admin, Fully Trustless
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            There is no central authority controlling funds.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All transactions are handled by smart contracts.
            No one including Nector can access or interfere with user funds.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            This makes the system more secure by design.
          </p>

          <h3 className="mt-10 text-2xl font-bold text-white mb-5">
            3. Built for Developers
          </h3>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector is also a developer platform.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Everything is open source:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Nector Smart Contract</li>
            <li>Keeper Bots</li>
            <li>Nector Mini</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Developers can:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Run everything locally</li>
            <li>Customize the logic</li>
            <li>Build their own escrow platforms</li>
            <li>Extend Nector into new use cases</li>
          </ul>

          <h2 id="mission" className="mt-10 text-4xl font-bold text-white mb-5">
            Our Mission
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            We believe escrow should be Easy to use, Accessible to everyone, Trustless by default. Our goal is to become “escrow for the internet” a simple standard that anyone can use, anywhere.
          </p>

          <h2 id="coming" className="mt-10 text-4xl font-bold text-white mb-5">
            What’s Coming Next
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            We are building Nector1K. a program to support developers.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Developers will be able to earn $1,000 rewards for building open-source projects using:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Nector Mini</li>
            <li>Nector Smart Contract</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            We want to grow an ecosystem where anyone can build on top of Nector.
          </p>

          <h2 id="final-thought" className="mt-10 text-4xl font-bold text-white mb-5">
            Final Thought
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector is not just about safer transactions. It’s about making trust simple.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Because sending money safely should feel as easy as sending a message.
          </p>

            {/* Contact */}
            <div className="border-t border-[#1F2937] mt-20 px-4 md:px-8 py-12">
            <div className="max-w-5xl mx-auto">
                
                <h2 id="contact" className="text-4xl font-bold text-white mb-8">
                Contact
                </h2>

                <div className="flex items-center gap-6 flex-wrap">
                
                {/* Gmail */}
                <a
                    href="mailto:nector.0330@gmail.com"
                    className="flex items-center gap-3 hover:opacity-80 transition"
                >
                    <img src="/gmail.svg" alt="gmail" className="w-9 h-9" />
                    <span className="text-[18px] text-[#A6A6A6]">
                    nector.0330@gmail.com
                    </span>
                </a>

                {/* X */}
                <a href="https://x.com/nectorchat_" target="_blank">
                    <img src="/x.avif" alt="x" className="w-8 h-8 hover:scale-110 transition" />
                </a>

                {/* Instagram */}
                <a href="https://instagram.com/nector.chat" target="_blank">
                    <img src="/instagram.svg" alt="instagram" className="w-8 h-8 hover:scale-110 transition" />
                </a>

                {/* TikTok */}
                <a href="https://tiktok.com/@nector.chat" target="_blank">
                    <img src="/tiktok.svg" alt="tiktok" className="w-8 h-8 hover:scale-110 transition" />
                </a>

                {/* YouTube */}
                <a href="https://youtube.com/channel/UCLkxMCKVc_jJvLU6JxcfpNA" target="_blank">
                    <img src="/youtube.svg" alt="youtube" className="w-8 h-8 hover:scale-110 transition" />
                </a>

                </div>
            </div>
            </div>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}
