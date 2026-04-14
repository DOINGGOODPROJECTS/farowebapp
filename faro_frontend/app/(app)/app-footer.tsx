"use client";

import { usePathname } from "next/navigation";

export default function AppFooter() {
  const pathname = usePathname();
  if (pathname === "/") {
    return null;
  }

  return (
    <footer className="mt-16 grid gap-8 border-t border-black/10 pt-8 text-xs text-[#6a6056] lg:grid-cols-[1.2fr_1fr_1fr]">
      <div>
          <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
          Faro
        </p>
        <p className="mt-3 text-sm font-semibold text-[#1e1a16]">
           AI-powered decision intelligence for underrepresented entrepreneurs.
        </p>
        <p className="mt-3 text-xs text-[#6a6056]">
          Choose where to start, relocate, or expand with clear guidance on location, funding, networks, and next steps.
        </p>
      </div>
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
          Navigation
        </p>
        <div className="flex flex-col gap-2 font-semibold text-[#4f463c]">
          <a className="transition hover:text-[#0f766e]" href="/">
            Chat with Faro
          </a>
          <a className="transition hover:text-[#0f766e]" href="/search">
            City Discovery
          </a>
          <a className="transition hover:text-[#0f766e]" href="/comparison">
            Market Comparison
          </a>
          <a className="transition hover:text-[#0f766e]" href="/">
            Adinkra AI
          </a>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
          Company
        </p>
        <div className="flex flex-col gap-2 font-semibold text-[#4f463c]">
          <a className="transition hover:text-[#0f766e]" href="/profile">
            Account Settings
          </a>
          <a className="transition hover:text-[#0f766e]" href="/notifications">
            Notifications
          </a>
          <a className="transition hover:text-[#0f766e]" href="/maps">
            Opportunity Maps
          </a>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6 text-xs text-[#6a6056] lg:col-span-3">
        <p>© 2025 Faro. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 font-semibold text-[#4f463c]">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Contact</span>
        </div>
      </div>
    </footer>
  );
}
