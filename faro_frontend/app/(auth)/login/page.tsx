"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const raw = await response.text();
      let payload: any = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }
      if (!response.ok) {
        if (response.status === 500) {
          throw new Error("Server error. Please try again in a moment.");
        }
        const detail =
          (payload?.error as string | undefined) ||
          (payload?.message as string | undefined) ||
          (payload?.details as string | undefined) ||
          (raw ? raw.slice(0, 200) : "Something went wrong.");
        throw new Error(detail);
      }

      router.push("/dashboard");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to sign in.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
          Welcome back
        </p>
          <h1 className="mt-3 font-serif text-3xl text-[#1e1a16]">
          Log in to Faro
        </h1>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
        />
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="font-semibold text-[#0f766e]">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-full bg-[#1e1a16] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Signing in..." : "Log in"}
        </button>
      </form>
      {message ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}
      <div className="text-center text-sm text-[#5a5249]">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-[#0f766e]">
          Create an account
        </Link>
      </div>
    </div>
  );
}
