"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
      const response = await fetch(`/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
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
            "Unable to create account.",
        );
      }

      router.push("/dashboard");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to create account.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
          Get started
        </p>
        <h1 className="mt-3 font-serif text-3xl text-[#1e1a16]">
          Create your founder account
        </h1>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
        />
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
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-full bg-[#1e1a16] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Creating..." : "Create account"}
        </button>
      </form>
      {message ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}
      <div className="text-center text-sm text-[#5a5249]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[#0f766e]">
          Log in
        </Link>
      </div>
    </div>
  );
}
