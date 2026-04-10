import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="mt-24 grid gap-8 border-t border-black/10 pt-8 text-sm text-[#5a5249] lg:grid-cols-[1.2fr_1fr_1.2fr_1fr]">
      <div>
        <p className="text-sm uppercase tracking-[0.4em] font-black">FARO</p>
        <p className="mt-3 text-xs text-[#1e1a16]">
          AI-powered decision intelligence for underrepresented entrepreneurs.
        </p>
        <p className="mt-3 text-sm text-[#5a5249]">
          Choose where to start, relocate, or expand with clear guidance on
          location, funding, networks, and next steps.
        </p>
      </div>
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
          Navigation
        </p>
        <div className="flex flex-col gap-2 text-sm font-semibold text-[#4f463c]">
          <Link className="transition hover:text-[#0f766e]" href="/chat">
            Chat with Faro
          </Link>
          <Link className="transition hover:text-[#0f766e]" href="/search">
            Explore Cities
          </Link>
          <span>Funding Finder</span>
          <span>Network Builder</span>
          <span>Generate Opportunity Map</span>
          <span>Generate Action Plan</span>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
          Explore Cities Across the U.S.
        </p>
        <p className="text-sm text-[#5a5249]">
          Atlanta, GA · Houston, TX · Detroit, MI · New York, NY · Los Angeles,
          CA · Chicago, IL · San Francisco, CA · Oakland, CA · San Jose, CA ·
          Austin, TX · Dallas, TX · San Antonio, TX · Miami, FL · Orlando, FL ·
          Tampa, FL · Washington, DC · Baltimore, MD · Silver Spring, MD ·
          Philadelphia, PA · Newark, NJ · Boston, MA · Cambridge, MA ·
          Seattle, WA · Tacoma, WA · Portland, OR · Denver, CO · Aurora, CO ·
          Phoenix, AZ · Tempe, AZ · Las Vegas, NV · Minneapolis, MN ·
          St. Paul, MN · St. Louis, MO · Kansas City, MO · Columbus, OH ·
          Cleveland, OH · Cincinnati, OH · Nashville, TN · Memphis, TN ·
          Charlotte, NC · Raleigh, NC · Durham, NC · Atlanta Metro · Houston
          Metro · Detroit Metro
        </p>
      </div>
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
          Contact
        </p>
        <div className="flex flex-col gap-2 text-sm font-semibold text-[#4f463c]">
          <span>ask@faro.com</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6 text-sm text-[#5a5249] lg:col-span-4">
        <p>© Faro. All rights reserved.</p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#4f463c]">
          <span>Privacy</span>
          <span>Terms</span>
        </div>
      </div>
    </footer>
  );
}
