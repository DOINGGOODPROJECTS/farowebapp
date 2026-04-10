"use client";

import { useState } from "react";
import { storage } from "@/lib/storage";
import { useLocalState } from "@/lib/useLocalState";

const steps = ["Founder", "Business", "Relocation", "Priorities"] as const;

export default function ProfilePage() {
  const [profile, setProfile] = useLocalState(
    storage.getProfile,
    storage.setProfile
  );
  const [step, setStep] = useState<(typeof steps)[number]>(steps[0]);

  const togglePriority = (value: string) => {
    setProfile((prev) => {
      const exists = prev.priorities.includes(value);
      return {
        ...prev,
        priorities: exists
          ? prev.priorities.filter((item) => item !== value)
          : [...prev.priorities, value],
      };
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
      <aside className="glass-panel rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
          Profile builder
        </p>
        <h2 className="mt-3 font-serif text-2xl text-[#1e1a16]">
          Personalize your relocation plan.
        </h2>
        <div className="mt-6 space-y-3 text-sm">
          {steps.map((item) => (
            <button
              key={item}
              onClick={() => setStep(item)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                step === item
                  ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0b4f4a]"
                  : "border-[#1e1a16]/10 bg-white/70 text-[#4f463c]"
              }`}
            >
              <span>{item}</span>
              <span>→</span>
            </button>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-[#1e1a16]/10 bg-white/70 p-4 text-xs text-[#6a6056]">
          Changes autosave and update AI recommendations instantly.
        </div>
      </aside>

      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
          {step} details
        </p>
        <div className="mt-6 space-y-5">
          {step === "Founder" && (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
                  Founder name
                </label>
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
                  Business name
                </label>
                <input
                  value={profile.business}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      business: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
                  placeholder="Business name"
                />
              </div>
            </>
          )}

          {step === "Business" && (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
                  Stage
                </label>
                <select
                  value={profile.stage}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      stage: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
                >
                  <option>Idea</option>
                  <option>Early revenue</option>
                  <option>Growth</option>
                  <option>Scaling</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
                  Industry
                </label>
                <select
                  value={profile.industry}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      industry: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
                >
                  <option>Tech</option>
                  <option>Retail</option>
                  <option>Healthcare</option>
                  <option>Manufacturing</option>
                  <option>Finance</option>
                </select>
              </div>
            </>
          )}

          {step === "Relocation" && (
            <>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
                  Relocation window
                </label>
                <select
                  value={profile.relocationWindow}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      relocationWindow: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
                >
                  <option>0-3 months</option>
                  <option>3-6 months</option>
                  <option>6-12 months</option>
                  <option>12+ months</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8a7d70]">
                  Budget range
                </label>
                <select
                  value={profile.budget}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      budget: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm"
                >
                  <option>$25k-$50k</option>
                  <option>$50k-$150k</option>
                  <option>$150k-$300k</option>
                  <option>$300k+</option>
                </select>
              </div>
            </>
          )}

          {step === "Priorities" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Cost",
                "Network",
                "Grants",
                "Business climate",
                "Talent",
                "Lifestyle",
              ].map((priority) => (
                <button
                  key={priority}
                  onClick={() => togglePriority(priority)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    profile.priorities.includes(priority)
                      ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0b4f4a]"
                      : "border-[#1e1a16]/10 bg-white/70 text-[#4f463c]"
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
