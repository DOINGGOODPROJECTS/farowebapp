"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leadFormSchema, type LeadFormValues } from "./lead-form-schema";
import { BASE_PATH } from "@/lib/basePath";

export function LeadForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeadFormValues>({ resolver: zodResolver(leadFormSchema) });

  async function onSubmit(values: LeadFormValues) {
    setStatus("submitting");
    try {
      const res = await fetch(`${BASE_PATH}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, sourceCode: "website" }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        Thanks — we&apos;ve got your details and will be in touch shortly.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">First name</label>
          <input {...register("firstName")} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" />
          {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Last name</label>
          <input {...register("lastName")} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" />
          {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Email</label>
        <input {...register("email")} type="email" className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Phone (optional)</label>
          <input {...register("phone")} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" />
        </div>
        <div>
          <label className="text-sm font-medium">Job title (optional)</label>
          <input {...register("jobTitle")} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">How can we help? (optional)</label>
        <textarea {...register("message")} rows={4} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2" />
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">Something went wrong — please try again.</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
