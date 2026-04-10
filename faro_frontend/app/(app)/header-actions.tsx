"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthUser } from "./auth-gate";

export default function HeaderActions() {
  const router = useRouter();
  const user = useAuthUser();

  if (!user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/login"
          className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-xs font-semibold text-[#1e1a16] transition hover:border-[#0f766e] hover:text-[#0f766e]"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-[#1e1a16] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
        >
          Create account
        </Link>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        fetch(`/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        }).finally(() => {
          router.replace("/login");
        });
      }}
      className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-xs font-semibold text-[#1e1a16] transition hover:border-[#0f766e] hover:text-[#0f766e]"
    >
      Log out
    </button>
  );
}
