// components/Footer.tsx
import Link from "next/link";
import Image from "next/image";

type FooterLink = { label: string; href: string };

const columns: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Platform",
    links: [
      { label: "How it works", href: "/#howitworks" },
      { label: "Features", href: "/#features" },
      { label: "FAQ", href: "/#FAQ" },
    ],
  },
  {
    title: "Developers",
    links: [{ label: "Documentation", href: "/docs" }],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/about/#contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy & Terms", href: "/privacy-terms" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#141414] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        {/* Top grid */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold tracking-wide text-white/90">
                {col.title}
              </h3>

              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/60 transition hover:text-white/85"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex items-center gap-4 border-t border-white/10 pt-8">
          {/* Logo badge */}
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/70 ring-1 ring-white/10">
            {/* Replace this with your real logo if needed */}
            <Image
            src="/1103.jpg"
            alt="Nector logo"
            width={32}
            height={32}
            className="opacity-90"
            />
          </div>

          <p className="text-sm text-white/50">
            © {year} Nector Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
