"use client";

import { useState } from "react";
import Link from "next/link";

export default function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden flex flex-col justify-between w-6 h-5 z-50"
        aria-label="Toggle Menu"
      >
        <span
          className={`h-[2px] bg-white transition-all duration-300
            ${isOpen ? "rotate-45 translate-y-[9px]" : ""}`}
        />
        <span
          className={`h-[2px] bg-white transition-all duration-300
            ${isOpen ? "opacity-0" : ""}`}
        />
        <span
          className={`h-[2px] bg-white transition-all duration-300
            ${isOpen ? "-rotate-45 -translate-y-[9px]" : ""}`}
        />
      </button>

      {/* Mobile Menu */}
      <div
        className={`fixed inset-0 bg-black/95 text-white flex flex-col items-center justify-center gap-8
          transition-all duration-300
          ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
        `}
      >
        <a href="/#howitworks" onClick={() => setIsOpen(false)} className="text-xl">
          How it Works?
        </a>
        <a href="/#features" onClick={() => setIsOpen(false)} className="text-xl">
          Features
        </a>
        <a href="/#FAQ" onClick={() => setIsOpen(false)} className="text-xl">
          FAQ
        </a>
        <Link href="/docs/nector-mini" onClick={() => setIsOpen(false)} className="text-xl">
          Developers
        </Link>
        <Link href="/docs" onClick={() => setIsOpen(false)} className="text-xl">
          Documentation
        </Link>

        <div className="flex gap-6 mt-6">
          <div className="mt-2">
            <Link href="/auth?mode=signin" onClick={() => setIsOpen(false)}>
              Sign in
            </Link>
          </div>
          <Link
            href="/auth"
            onClick={() => setIsOpen(false)}
            className="bg-[#2FE4E4] text-black px-6 py-2 rounded-md"
          >
            Sign up
          </Link>
        </div>
      </div>
    </>
  );
}
