"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Suspense } from "react";

function ResetPasswordPageInner() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!token) {
      setStatus("error");
      setMessage("Missing reset token. Please use the email link.");
      return;
    }

    if (password !== confirm) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setStatus("loading");
    try {
      const response = await fetch(
        `/api/auth/password-reset/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        },
      );
      const raw = await response.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(
          (payload?.error as string | undefined) ||
            (raw ? raw.slice(0, 200) : undefined) ||
            "Unable to reset password.",
        );
      }
      setStatus("done");
      setMessage("Password updated. You can log in now.");
      setPassword("");
      setConfirm("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to reset password.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
          Set a new password
        </p>
        <h1 className="mt-3 font-serif text-3xl text-[#1e1a16]">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-[#5a5249]">
          Choose a strong password you have not used before.
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          required
          className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-full bg-[#1e1a16] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Updating..." : "Update password"}
        </button>
      </form>
      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </div>
      ) : null}
      <div className="text-center text-sm text-[#5a5249]">
        <Link href="/login" className="font-semibold text-[#0f766e]">
          Back to log in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordPageInner />
    </Suspense>
  );
}
