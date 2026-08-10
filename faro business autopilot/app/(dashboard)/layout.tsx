import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-black/[0.02]">
      <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-4">
        <div>
          <h1 className="text-sm font-semibold">Faro Autopilot — Dashboard</h1>
          <p className="text-xs text-black/50">{user.email}</p>
        </div>
        <SignOutButton />
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
