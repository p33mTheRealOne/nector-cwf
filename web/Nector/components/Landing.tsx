import Navbar from '@/components/navbar';
import TrustBadges from '@/components/NON-CUSTODIAL';
import RiskCards from '@/components/RiskCards';
import EscrowSteps from '@/components/EscrowSteps';
import EscrowBenefits from '@/components/EscrowBenefits';
import TrustTransparency from '@/components/TrustTransparency';
import UseCases from '@/components/UseCases';
import Footer from '@/components/Footer';
import FAQ from '@/components/FAQ';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <>
      {/* Hidden checkbox for toggling the banner via pure CSS */}
      <input type="checkbox" id="banner-toggle" className="peer hidden" />

      {/* ================= ANNOUNCEMENT BANNER WITH GRADIENT MASKED BLUR ================= */}
      <div 
        className="
          peer-checked:hidden 
          fixed top-0 left-0 w-full z-[9999] 
          flex justify-center items-start 
          pt-4 pb-12 
          bg-black/20 backdrop-blur-[3px] 
          [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] 
          pointer-events-none
        "
      >
        <div className="pointer-events-auto relative inline-flex items-center gap-2 bg-[#111111]/90 border border-[#2FE4E4]/40 text-[#2FE4E4] text-[12px] lg:text-[13px] font-medium px-4 py-1.5 rounded-full shadow-2xl transition hover:border-[#2FE4E4]">
          <a
            href="https://kickstart.easya.io/token/qUyQ5aWzwREDhBk48rRVK2gMHiXPdDLqkkKVbmiEASY"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-2"
          >
            Our token is live. Check it out!
          </a>

          {/* Close Button */}
          <label
            htmlFor="banner-toggle"
            className="ml-1 cursor-pointer text-[#2FE4E4]/70 hover:text-[#2FE4E4] transition-colors p-0.5 rounded-full hover:bg-white/10 flex items-center justify-center"
            aria-label="Close banner"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </label>
        </div>
      </div>

      <Navbar />

      {/* ================= HERO ================= */}
      <section className="relative bg-black overflow-hidden">
        <div
          className="
            max-w-[1200px]
            mx-auto
            px-6
            pt-[100px]
            lg:pt-[120px]
            pb-[80px]
            grid
            grid-cols-1
            lg:grid-cols-2
            gap-[64px]
            items-start
          "
        >
          {/* ===== LEFT CONTENT ===== */}
          <div>
            <h1 className="text-white text-[32px] lg:text-[44px] leading-[1.15] font-medium">
              Buy & Sell
              <br />
              Safely
              <br />
              Inside Chat
            </h1>

            <p className="font-medium mt-5 text-[#A6A6A6] text-[16px] leading-[1.6] max-w-[400px]">
              No more paying upfront to strangers.
              Lock payments until both buyer and
              seller confirm. Fair, fast, and safe
              online transactions.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex gap-4">
              <Link
                href="/auth"
                className="bg-[#2FE4E4] text-black text-[15px] px-6 py-2.5 rounded-[9px] hover:bg-[#29d0d0] transition"
              >
                Create Escrow
              </Link>

              <Link
                href="/docs"
                className="bg-[#2A2A2A] text-white text-[15px] px-6 py-2.5 rounded-[9px] hover:bg-[#333] transition"
              >
                See How It Works
              </Link>
            </div>

            {/* Badges */}
            <div className="mt-12 flex justify-start">
              <TrustBadges />
            </div>
          </div>
        </div>

        {/* ===== FLOATING IMAGE ===== */}
        <div
          className="
            absolute
            right-[5%]
            top-[-90px]
            lg:block mt-[-40px]
            hidden
            pointer-events-none
          "
        >
          <Image
            src="/5201.png"
            alt="Escrow illustration"
            width={500}
            height={500}
            priority
            className="
              rotate-[15deg]
              w-[700px]
              xl:w-[700px] mt-[100px] ml-[420px]
              2xl:w-[900px]
              h-auto
            "
          />
        </div>
      </section>

      {/* ================= SECTION 2 ================= */}
      <section className="bg-black top-[716.8px]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-white text-[24px] lg:text-[32px] font-medium text-center">
            Online payments are risky without protection
          </h2>
          <h2 className="mt-3 text-[#A6A6A6] text-[14px] lg:text-[16.8px] font-medium text-center">
            Traditional payment methods rely on trust. In a global economy, trust isn't enough to prevent fraud.
          </h2>
          <div className="mt-16 lg:mt-12">
            <RiskCards/>
          </div>
        </div>
      </section>

      {/* ================= SECTION 3 ================= */}
      <section id="howitworks" className="bg-black mt-[71.4px]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="text-[#26D9D9] text-[14px] lg:text-[16.8px] font-bold text-center">
            THE SOLUTION
          </h2>
          <h2 className="mt-[10px] text-white text-[24px] lg:text-[32px] font-medium text-center">
            How it Works?
          </h2>
          <div className="mt-16 lg:mt-12">
            <EscrowSteps/>
          </div>
        </div>
      </section>

      {/* ================= SECTION 3 ================= */}
      <section className="bg-black mt-[71.4px]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="mt-[10px] text-white text-[24px] lg:text-[32px] font-medium text-center">
            Built for Trust, Not Promises
          </h2>
          <h2 className="mt-3 text-[#A6A6A6] text-[14px] lg:text-[16.8px] font-medium text-center">
            We utilize immutable code to ensure fairness. Nector acts as a neutral protocol, not a bank.
          </h2>
          <div className="mt-16 lg:mt-12">
            <EscrowBenefits/>
          </div>
        </div>
      </section>

      {/* ================= SECTION 4 ================= */}
      <section className="bg-black mt-[-50px]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="mt-16 lg:mt-12">
            <TrustTransparency/>
          </div>
        </div>
      </section>

      {/* ================= SECTION 5 ================= */}
      <section id="features" className="bg-black mt-[0px]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="mt-[10px] text-white text-[24px] lg:text-[32px] font-medium text-center">
            Who is this escrow platform for?
          </h2>
          <div className="mt-[-17] lg:mt-[-17]">
            <UseCases/>
          </div>
        </div>
      </section>

      {/* ================= SECTION 6 ================= */}
      <section id="FAQ" className="bg-black mt-[0px]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="mt-[10px] text-white text-[24px] lg:text-[32px] font-medium text-center">
            Frequently Asked Questions
          </h2>
          <div className="mt-[60] lg:mt-[60]">
            <FAQ/>
          </div>
        </div>
      </section>

      {/* ================= SECTION 7 ================= */}
      <section className="bg-black mt-[80px]">
        <div className="max-w-[1200px] mx-auto px-6">
          <h2 className="mt-[10px] text-white text-[24px] lg:text-[32px] font-medium text-center">
            Start safer online transactions today
          </h2>
          <h2 className="mt-6 text-[#A6A6A6] text-[14px] lg:text-[16.8px] font-medium text-center">
            Join users who trust Nector for their high-value payments. Transparent, secure, and built for the modern web.
          </h2>
          <div className="flex items-center justify-center mt-12">
            <Link
              href="/auth"
              className="
                inline-flex
                items-center
                justify-center
                px-8
                py-3
                rounded-[10px]
                bg-[#2FE4E4]
                text-black
                text-[16px]
                font-medium
                hover:bg-[#29d0d0]
                transition-colors
                duration-200
              "
            >
              Create Escrow
            </Link>
          </div>
          <h2 className="mt-2 text-[#A6A6A6] text-[11px] lg:text-[12px] font-medium text-center">
            No credit card required. Secure by design.
          </h2>
        </div>
      </section>
      <div className="mt-20">
        <Footer/>
      </div>
    </>
  );
}
