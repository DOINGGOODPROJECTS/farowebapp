import Link from "next/link";
import AuthGate from "./auth-gate";
import HeaderActions from "./header-actions";
import MarketingFooter from "../marketing-footer";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/search", label: "Search" },
  { href: "/chat", label: "AI Chat" },
  { href: "/comparison", label: "Comparison" },
  { href: "/notifications", label: "Notifications" },
  { href: "/profile", label: "Profile" },
  { href: "/subscription", label: "Subscription" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <AuthGate>
        <div className="relative z-10 flex min-h-screen">
          <aside className="hidden w-64 flex-col border-r border-black/10 bg-white/70 p-6 lg:flex">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Faro"
                width={44}
                height={44}
                className="h-11 w-11 rounded-full border border-black/10 bg-white object-contain"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">
                  Faro
                </p>
                <p className="text-sm font-semibold text-[#1e1a16]">
                  Founder Console
                </p>
              </div>
            </div>
            <nav className="mt-10 space-y-2 text-sm font-semibold text-[#4f463c]">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 transition hover:bg-white/80 hover:text-[#0f766e]"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-[#a19487]">→</span>
                </Link>
              ))}
            </nav>
            <div className="mt-auto rounded-2xl border border-[#0f766e]/20 bg-[#0f766e]/10 p-4 text-xs text-[#0b4f4a]">
              <p className="font-semibold">Founder Status</p>
              <p className="mt-2">
                Your workspace is ready for city discovery and planning.
              </p>
            </div>
          </aside>

          <main className="flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-10">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
                  Founder Workspace
                </p>
                <h1 className="font-serif text-2xl text-[#1e1a16] sm:text-3xl">
                  AI-powered decision intelligence for underrepresented entrepreneurs.
                </h1>
              </div>
              <HeaderActions />
            </header>
            <nav className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-[#4f463c] lg:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-[#1e1a16]/10 bg-white/70 px-4 py-2 transition hover:border-[#0f766e] hover:text-[#0f766e]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-10">{children}</div>
            <MarketingFooter />
          </main>
        </div>
      </AuthGate>
    </div>
  );
}
