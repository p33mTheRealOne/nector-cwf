import Navbar from "@/components/navbar";
import Image from "next/image";
import Footer from '@/components/Footer';

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
            Privacy & Terms
          </h1>

          {/* Divider */}
          <div className="border-t border-[#1F2937] mb-5" />

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            1. Information We Collect
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector collects limited information necessary to operate the platform:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Wallet addresses (on-chain)</li>
            <li>Username and profile data</li>
            <li>Chat messages between users</li>
            <li>Uploaded files (Digital files, Images messages)</li>
          </ul>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            2. How We Use Information
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            We use collected data to:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Facilitate transactions between users</li>
            <li>Display user profiles and transaction details</li>
            <li>Enable communication through chat</li>
            <li>Support dispute flows and system integrity</li>
          </ul>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            3. Data Storage
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Data is stored across:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>On-chain (public blockchain data such as transactions)</li>
            <li>Off-chain infrastructure (e.g. Supabase for user data and chat)</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Blockchain data is immutable and cannot be modified or deleted.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            4. Data Sharing
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            We do not sell or share user data with third parties.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Data may be exposed only when:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Required by law</li>
            <li>Necessary to maintain platform integrity</li>
          </ul>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            5. Data Deletion
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Users may request deletion of off-chain data such as:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Profile data</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            However:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>On-chain transaction data cannot be deleted</li>
            <li>Certain records related to transactions may be retained for fraud prevention</li>
          </ul>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            6. Cookies
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector does not rely on traditional cookies for tracking.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            7. Nature of the Service
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector is:
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            A chat-based, non-custodial escrow protocol
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            It also provides tools for developers to build on top of the system.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            8. Responsibility & Guarantees
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector does not:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Guarantee product quality</li>
            <li>Verify shipment or delivery</li>
            <li>Act as a dispute arbitrator</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            All transactions occur directly between users.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            9. Funds & Transactions
          </h2>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Funds are controlled by smart contracts</li>
            <li>Transactions are irreversible</li>
            <li>Nector cannot access or reverse user funds</li>
          </ul>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            10. Dispute Responsibility
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Disputes are resolved through protocol logic and user actions.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector does not intervene or make subjective judgments.
          </p>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Users are fully responsible for their decisions.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            11. Prohibited Use
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            The platform may not be used for:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Illegal goods or services</li>
            <li>Fraudulent activity</li>
            <li>Restricted or harmful content</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Accounts violating these rules may be suspended.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            12. Age Requirement
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Users must be at least 13 years old to use the platform.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            13. Jurisdiction
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector operates as a decentralized protocol and may not be tied to a single legal jurisdiction.
          </p>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Users are responsible for complying with local laws.
          </p>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            14. Limitation of Liability
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            To the maximum extent permitted by law:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Nector is not liable for losses resulting from transactions</li>
            <li>Nector does not guarantee outcomes</li>
            <li>Users assume all risks associated with using the platform</li>
          </ul>

          <h2 className="mt-7 text-4xl font-bold text-white mb-5">
            15. Account Termination
          </h2>

          <p className="max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            Nector reserves the right to:
          </p>

          <ul className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6] list-disc pl-6 space-y-2">
            <li>Restrict or suspend accounts</li>
            <li>Prevent access to the platform</li>
          </ul>

          <p className="mt-5 max-w-4xl text-[18px] leading-10 text-[#A6A6A6]">
            In cases of misuse or violation of terms.
          </p>

        </article>
      </main>
      </div>
      <Footer/>
      </div>
    </div>
  );
}