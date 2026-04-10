"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch(
        `/api/auth/password-reset/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
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
        const detail =
          payload?.details && typeof payload.details === "string"
            ? ` (${payload.details as string})`
            : "";
        throw new Error(
          payload?.error
            ? `${payload.error as string}${detail}`
            : raw
              ? raw.slice(0, 200)
              : "Unable to send reset email.",
        );
      }
      setStatus("sent");
      setMessage(
        "Check your email for a reset link. If the address exists, we sent it.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to send reset email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
          Reset access
        </p>
        <h1 className="mt-3 font-serif text-3xl text-[#1e1a16]">
          Forgot your password?
        </h1>
        <p className="mt-2 text-sm text-[#5a5249]">
          Enter your email and we will send you a reset link.
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "idle") {
              setStatus("idle");
              setMessage("");
            }
          }}
          required
          className="w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[#1e1a16] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Sending..."
            : status === "sent"
              ? "Send again"
              : "Send reset link"}
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
        Remembered your password?{" "}
        <Link href="/login" className="font-semibold text-[#0f766e]">
          Log in
        </Link>
      </div>
    </div>
  );
}
