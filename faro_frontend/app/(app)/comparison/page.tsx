"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cities } from "@/lib/data";

const metrics = [
  { key: "opportunityScore", label: "Opportunity" },
  { key: "businessScore", label: "Business climate" },
  { key: "costIndex", label: "Cost index" },
  { key: "blackPopulationPct", label: "Black population" },
  { key: "networkStrength", label: "Network strength" },
  { key: "housingIndex", label: "Housing index" },
] as const;

export default function ComparisonPage() {
  const [selection, setSelection] = useState(["atlanta-ga", "houston-tx"]);
  const [metricsBySlug, setMetricsBySlug] = useState<
    Record<
      string,
      Partial<{
        businessScore: number;
        opportunityScore: number;
        networkStrength: number;
        costIndex: number;
        housingIndex: number;
        blackPopulationPct: number;
      }>
    >
  >({});
  const metricsRef = useRef(metricsBySlug);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const selectedCities = useMemo(
    () => cities.filter((city) => selection.includes(city.slug)),
    [selection]
  );

  useEffect(() => {
    metricsRef.current = metricsBySlug;
  }, [metricsBySlug]);

  useEffect(() => {
    const controller = new AbortController();
    const loadMetrics = async () => {
      const targets = selectedCities.filter(
        (city) => !metricsRef.current[city.slug]
      );
      if (targets.length === 0) return;

      await Promise.all(
        targets.map(async (city) => {
          try {
            const params = new URLSearchParams({
              city: city.name,
              country: city.country,
              state: city.state,
            });
            const [economyRes, demoRes, livingRes] = await Promise.all([
              fetch(`${backendUrl}/api/cities/economy?${params.toString()}`, {
                credentials: "include",
                signal: controller.signal,
              }),
              fetch(`${backendUrl}/api/cities/demographics?${params.toString()}`, {
                credentials: "include",
                signal: controller.signal,
              }),
              fetch(`${backendUrl}/api/cities/living-costs?${params.toString()}`, {
                credentials: "include",
                signal: controller.signal,
              }),
            ]);

            const nextMetrics: Partial<{
              businessScore: number;
              opportunityScore: number;
              networkStrength: number;
              costIndex: number;
              housingIndex: number;
              blackPopulationPct: number;
            }> = {};

            if (economyRes.ok) {
              const payload = await economyRes.json();
              if (payload?.businessScore != null) {
                nextMetrics.businessScore = Number(payload.businessScore);
              }
              if (payload?.opportunityScore != null) {
                nextMetrics.opportunityScore = Number(payload.opportunityScore);
              }
              if (payload?.networkStrength != null) {
                nextMetrics.networkStrength = Number(payload.networkStrength);
              }
            }

            if (demoRes.ok) {
              const payload = await demoRes.json();
              if (payload?.blackPopulationPct != null) {
                nextMetrics.blackPopulationPct = Number(payload.blackPopulationPct);
              }
              if (payload?.housingIndex != null) {
                nextMetrics.housingIndex = Number(payload.housingIndex);
              }
            }

            if (livingRes.ok) {
              const payload = await livingRes.json();
              if (payload?.costIndex != null) {
                nextMetrics.costIndex = Number(payload.costIndex);
              }
              if (payload?.housingIndex != null) {
                nextMetrics.housingIndex = Number(payload.housingIndex);
              }
            }

            if (Object.keys(nextMetrics).length > 0) {
              setMetricsBySlug((prev) => ({
                ...prev,
                [city.slug]: { ...prev[city.slug], ...nextMetrics },
              }));
            }
          } catch (error) {
            if ((error as Error).name !== "AbortError") {
              return;
            }
          }
        })
      );
    };

    loadMetrics();
    return () => controller.abort();
  }, [backendUrl, selectedCities]);

  const toggleCity = (slug: string) => {
    setSelection((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((item) => item !== slug);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, slug];
    });
  };

  const exportCsv = () => {
    const header = ["Metric", ...selectedCities.map((c) => c.name)].join(",");
    const rows = metrics.map((metric) => {
      const values = selectedCities.map((city) => {
        const override = metricsBySlug[city.slug]?.[metric.key];
        return override ?? city[metric.key];
      });
      return [metric.label, ...values].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "faro-comparison.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const scoredCities = useMemo(() => {
    return selectedCities.map((city) => {
      const metricsForCity = metricsBySlug[city.slug] || {};
      const opportunity =
        metricsForCity.opportunityScore ?? city.opportunityScore;
      const business = metricsForCity.businessScore ?? city.businessScore;
      const network = metricsForCity.networkStrength ?? city.networkStrength;
      const blackPopulation =
        metricsForCity.blackPopulationPct ?? city.blackPopulationPct;
      const costIndex = metricsForCity.costIndex ?? city.costIndex;
      const housingIndex = metricsForCity.housingIndex ?? city.housingIndex;

      const costScore = 140 - Number(costIndex || 0);
      const housingScore = 140 - Number(housingIndex || 0);
      const total =
        Number(opportunity || 0) * 0.22 +
        Number(business || 0) * 0.22 +
        Number(network || 0) * 0.18 +
        Number(blackPopulation || 0) * 0.12 +
        costScore * 0.13 +
        housingScore * 0.13;

      return {
        city,
        total: Math.round(total),
        details: {
          opportunity: Number(opportunity || 0),
          business: Number(business || 0),
          network: Number(network || 0),
          blackPopulation: Number(blackPopulation || 0),
          costIndex: Number(costIndex || 0),
          housingIndex: Number(housingIndex || 0),
        },
      };
    });
  }, [selectedCities, metricsBySlug]);

  const rankedCities = [...scoredCities].sort((a, b) => b.total - a.total);
  const topCity = rankedCities[0];
  const runnerUp = rankedCities[1];

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Comparison Matrix
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              Compare up to 4 cities side-by-side.
            </h2>
          </div>
          <button
            onClick={exportCsv}
            className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-xs font-semibold text-[#1e1a16] transition hover:border-[#0f766e] hover:text-[#0f766e]"
          >
            Export CSV
          </button>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          {cities.map((city) => (
            <button
              key={city.slug}
              onClick={() => toggleCity(city.slug)}
              className={`rounded-full border px-4 py-2 font-semibold transition ${
                selection.includes(city.slug)
                  ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0b4f4a]"
                  : "border-[#1e1a16]/15 bg-white/60 text-[#4f463c]"
              }`}
            >
              {city.name}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-panel overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/80 text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
              <tr>
                <th className="px-6 py-4">Metric</th>
                {selectedCities.map((city) => (
                  <th key={city.slug} className="px-6 py-4">
                    {city.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.key} className="border-t border-black/5">
                  <td className="px-6 py-4 font-semibold text-[#1e1a16]">
                    {metric.label}
                  </td>
                  {selectedCities.map((city) => {
                    const value =
                      metricsBySlug[city.slug]?.[metric.key] ??
                      city[metric.key];
                    const isLowBetter = metric.key === "costIndex";
                    const normalized = isLowBetter
                      ? 140 - Number(value)
                      : Number(value);
                    const bg =
                      normalized >= 85
                        ? "bg-emerald-100/70"
                        : normalized >= 70
                        ? "bg-amber-100/70"
                        : "bg-rose-100/70";
                    return (
                      <td key={city.slug} className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold text-[#1e1a16] ${bg}`}
                        >
                          {value}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {topCity && (
        <section className="glass-panel rounded-3xl p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
                Recommendation
              </p>
              <h3 className="mt-3 font-serif text-3xl text-[#1e1a16]">
                Best city for underrepresented entrepreneurs relocation
              </h3>
            </div>
            <span className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-2 text-xs font-semibold text-[#0b4f4a]">
              Score {topCity.total}
            </span>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                Best city
              </p>
              <p className="mt-3 text-xl font-semibold text-[#1e1a16]">
                {topCity.city.name}
              </p>
              <p className="mt-2 text-sm text-[#5a5249]">
                Highest weighted score using opportunity, business climate,
                network strength, Underrepresented entrepreneurs, and cost factors.
              </p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                How we rank
              </p>
              <p className="mt-3 text-sm text-[#5a5249]">
                Weighted blend of opportunity (22%), business climate (22%),
                network strength (18%), Underrepresented entrepreneurs (12%), cost index
                (13%), and housing index (13%). Lower cost/housing scores rank
                higher.
              </p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                What this means
              </p>
              <p className="mt-3 text-sm text-[#5a5249]">
                This is the best relocation choice among the cities you selected.
                Adjust selections to compare new options.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
