"use client";

import { useEffect, useState } from "react";

type PlanKey = "free" | "pro" | "max";

type SubscriptionState = {
  plan: PlanKey;
  planRenewsAt: string | null;
  chatCredits: number;
};

const PLANS = {
  pro: {
    name: "Pro",
    price: 17,
    credits: 50,
    description: "For founders actively exploring relocation options.",
    features: [
      "50 AI chat credits / month",
      "Full city comparison access",
      "Grant discovery & alerts",
      "Saved searches & favorites",
      "Priority AI responses",
    ],
  },
  max: {
    name: "Max",
    price: 25,
    credits: 70,
    description: "For founders ready to move fast and need more coverage.",
    features: [
      "70 AI chat credits / month",
      "Everything in Pro",
      "Extended chat history",
      "Advanced market intelligence",
      "Early access to new features",
    ],
  },
} as const;

const CREDIT_PACKS = [
  { key: "small", label: "10 credits", price: 5, credits: 10 },
  { key: "large", label: "25 credits", price: 10, credits: 25 },
] as const;

type CreditPackKey = "small" | "large";

function planLabel(p: PlanKey) {
  if (p === "free") return "Free";
  return PLANS[p].name;
}

function planTier(p: PlanKey): number {
  return p === "free" ? 0 : p === "pro" ? 1 : 2;
}

export default function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<"pro" | "max" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [buyingPack, setBuyingPack] = useState<CreditPackKey | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/subscription", { credentials: "include" })
      .then((r) => r.json())
      .then((data: SubscriptionState) => { if (active) setSub(data); })
      .catch(() => { if (active) setSub(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleSubscribe = async (plan: "pro" | "max") => {
    setSubscribing(plan);
    setMessage(null);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Subscription failed.");
      setSub({ plan: data.plan, planRenewsAt: data.planRenewsAt, chatCredits: data.chatCredits });
      const verb = sub?.plan === "free" ? "subscribed to" : "switched to";
      setMessage({ type: "success", text: `You've ${verb} the ${PLANS[plan].name} plan. Your credits are now ${data.chatCredits}.` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubscribing(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/subscription", { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cancellation failed.");
      setSub((prev) => prev ? { ...prev, plan: "free", planRenewsAt: null } : prev);
      setMessage({ type: "success", text: "Subscription cancelled. Your remaining credits stay active." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setCancelling(false);
    }
  };

  const handleBuyPack = async (pack: CreditPackKey) => {
    setBuyingPack(pack);
    setMessage(null);
    try {
      const res = await fetch("/api/subscription/credits", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed.");
      setSub((prev) => prev ? { ...prev, chatCredits: data.chatCredits } : prev);
      setMessage({ type: "success", text: `${data.creditsAdded} credits added. You now have ${data.chatCredits} credits.` });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBuyingPack(null);
    }
  };

  const currentPlan = sub?.plan ?? "free";
  const currentTier = planTier(currentPlan);

  const renewsAt = sub?.planRenewsAt
    ? new Date(sub.planRenewsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

  const getButtonLabel = (key: "pro" | "max") => {
    if (subscribing === key) return "Processing…";
    if (currentPlan === key) return "Current plan";
    const targetTier = planTier(key);
    if (currentTier === 0) return `Subscribe — $${PLANS[key].price}/mo`;
    if (targetTier > currentTier) return `Upgrade to ${PLANS[key].name} — $${PLANS[key].price}/mo`;
    return `Downgrade to ${PLANS[key].name} — $${PLANS[key].price}/mo`;
  };

  const getButtonStyle = (key: "pro" | "max") => {
    if (currentPlan === key) {
      return "border border-[#0f766e]/40 bg-[#0f766e]/10 text-[#0b4f4a] cursor-default";
    }
    const targetTier = planTier(key);
    if (targetTier < currentTier) {
      // downgrade — muted style
      return "border border-[#1e1a16]/20 bg-white/80 text-[#4f463c] hover:border-[#1e1a16]/40";
    }
    return "bg-[#1e1a16] text-white hover:bg-black";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">Account</p>
        <div className="h-8 w-48 animate-pulse rounded-xl bg-black/5" />
        <div className="h-32 animate-pulse rounded-3xl bg-black/5" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">Account</p>
        <h2 className="mt-2 font-serif text-3xl text-[#1e1a16]">Subscription</h2>
        <p className="mt-2 text-sm text-[#6a6056]">
          Manage your plan and credits. Each AI message costs 1 credit.
        </p>
      </div>

      {/* Current plan status */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.4em] text-[#8a7d70]">Current plan</p>
            <p className="text-2xl font-semibold text-[#1e1a16]">{planLabel(currentPlan)}</p>
            {renewsAt ? (
              <p className="text-xs text-[#8a7d70]">Renews {renewsAt}</p>
            ) : (
              <p className="text-xs text-[#8a7d70]">No active subscription</p>
            )}
            {currentPlan !== "free" && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="mt-3 text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel subscription"}
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-[#0f766e]/20 bg-[#0f766e]/10 px-8 py-4 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[#0b4f4a]">Credits remaining</p>
            <p className="mt-1 text-4xl font-bold text-[#0f766e]">
              {sub?.chatCredits.toFixed(0) ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          message.type === "success"
            ? "border-[#0f766e]/30 bg-[#0f766e]/10 text-[#0b4f4a]"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {message.text}
        </div>
      )}

      {/* Plan cards */}
      <div>
        <p className="mb-4 text-xs uppercase tracking-[0.4em] text-[#8a7d70]">Plans</p>
        <div className="grid gap-6 sm:grid-cols-2">
          {(["pro", "max"] as const).map((key) => {
            const plan = PLANS[key];
            const isActive = currentPlan === key;
            const targetTier = planTier(key);
            const isDowngrade = currentTier > 0 && targetTier < currentTier;

            return (
              <div
                key={key}
                className={`glass-panel rounded-3xl p-6 sm:p-8 transition ${
                  isActive ? "ring-2 ring-[#0f766e]" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
                    {plan.name}
                  </p>
                  {isActive && (
                    <span className="rounded-full bg-[#0f766e] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
                      Active
                    </span>
                  )}
                  {!isActive && isDowngrade && (
                    <span className="rounded-full border border-[#1e1a16]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a7d70]">
                      Downgrade
                    </span>
                  )}
                  {!isActive && !isDowngrade && currentTier > 0 && (
                    <span className="rounded-full bg-[#c59a4a]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a5c1a]">
                      Upgrade
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-end gap-1">
                  <span className="font-serif text-4xl font-bold text-[#1e1a16]">
                    ${plan.price}
                  </span>
                  <span className="mb-1 text-sm text-[#8a7d70]">USD / month</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#0f766e]">
                  {plan.credits} credits included
                </p>
                <p className="mt-3 text-sm text-[#6a6056]">{plan.description}</p>

                <ul className="mt-5 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#4f463c]">
                      <span className="mt-0.5 text-[#0f766e]">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !isActive && handleSubscribe(key)}
                  disabled={isActive || subscribing !== null}
                  className={`mt-6 w-full rounded-full px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${getButtonStyle(key)}`}
                >
                  {getButtonLabel(key)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Buy extra credits */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">Buy extra credits</p>
        <h3 className="mt-2 font-serif text-xl text-[#1e1a16]">Need more credits this month?</h3>
        <p className="mt-1 text-sm text-[#6a6056]">
          Top up anytime. Extra credits are added on top of your current balance and never expire.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.key}
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/80 px-5 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-[#1e1a16]">{pack.label}</p>
                <p className="text-xs text-[#8a7d70]">${pack.price} one-time</p>
              </div>
              <button
                onClick={() => handleBuyPack(pack.key)}
                disabled={buyingPack !== null}
                className="rounded-full bg-[#1e1a16] px-4 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {buyingPack === pack.key ? "Adding…" : `Buy — $${pack.price}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Free tier note */}
      <div className="rounded-2xl border border-black/5 bg-white/60 px-5 py-4 text-sm text-[#6a6056]">
        <strong className="text-[#1e1a16]">Free plan</strong> — New accounts start with 10 free
        credits. Subscribe to a monthly plan or buy extra credits whenever you need more.
      </div>
    </div>
  );
}
