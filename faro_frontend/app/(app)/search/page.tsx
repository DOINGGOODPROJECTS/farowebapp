"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cities } from "@/lib/data";
import { storage } from "@/lib/storage";
import { useLocalState } from "@/lib/useLocalState";

const regions = [
  "All",
  "U.S. South",
  "DMV",
  "U.S. Midwest",
] as const;
const sortOptions = [
  { label: "Opportunity Score", key: "opportunityScore" },
  { label: "Business Score", key: "businessScore" },
  { label: "Cost Index (Low to High)", key: "costIndex" },
] as const;

export default function SearchPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof regions)[number]>("All");
  const [sortKey, setSortKey] = useState<(typeof sortOptions)[number]["key"]>(
    "opportunityScore"
  );
  const [favorites, setFavorites] = useLocalState(
    storage.getFavorites,
    storage.setFavorites
  );
  const [searches, setSearches] = useLocalState(
    storage.getSearches,
    storage.setSearches
  );
  const [populationBySlug, setPopulationBySlug] = useState<
    Record<string, string>
  >({});
  const [medianIncomeBySlug, setMedianIncomeBySlug] = useState<
    Record<string, string>
  >({});
  const [costIndexBySlug, setCostIndexBySlug] = useState<Record<string, number>>(
    {}
  );
  const [economyBySlug, setEconomyBySlug] = useState<
    Record<
      string,
      { businessScore: number; opportunityScore: number; networkStrength: number }
    >
  >({});
  const populationRef = useRef<Record<string, string>>({});
  const medianIncomeRef = useRef<Record<string, string>>({});
  const costIndexRef = useRef<Record<string, number>>({});
  const economyRef = useRef<Record<string, { businessScore: number; opportunityScore: number; networkStrength: number }>>(
    {}
  );
  const cacheTtlMs = 1000 * 60 * 60 * 24 * 7;

  const filteredCities = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return cities
      .filter((city) =>
        region === "All" ? true : city.region === region
      )
      .filter((city) =>
        lower.length === 0
          ? true
          : `${city.name} ${city.state}`.toLowerCase().includes(lower)
      )
      .sort((a, b) => {
        if (sortKey === "costIndex") {
          return a.costIndex - b.costIndex;
        }
        return b[sortKey] - a[sortKey];
      });
  }, [query, region, sortKey]);

  useEffect(() => {
    populationRef.current = populationBySlug;
  }, [populationBySlug]);

  useEffect(() => {
    medianIncomeRef.current = medianIncomeBySlug;
  }, [medianIncomeBySlug]);

  useEffect(() => {
    costIndexRef.current = costIndexBySlug;
  }, [costIndexBySlug]);

  useEffect(() => {
    economyRef.current = economyBySlug;
  }, [economyBySlug]);

  useEffect(() => {
    const controller = new AbortController();
    const loadPopulations = async () => {
      const cache = storage.getPopulationCache();
      const cachedEntries: Record<string, string> = {};
      filteredCities.forEach((city) => {
        const cacheKey = `${city.name}|${city.state}|${city.country}`;
        const cached = cache[cacheKey];
        if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) {
          cachedEntries[city.slug] = cached.value;
        }
      });
      const hasNewCached = Object.keys(cachedEntries).some(
        (slug) => populationRef.current[slug] !== cachedEntries[slug]
      );
      if (hasNewCached) {
        setPopulationBySlug((prev) => ({ ...prev, ...cachedEntries }));
      }

      const targets = filteredCities.filter(
        (city) =>
          !populationRef.current[city.slug] && !cachedEntries[city.slug]
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
            const response = await fetch(
              `${backendUrl}/api/cities/population?${params.toString()}`,
              { credentials: "include", signal: controller.signal }
            );
            if (!response.ok) return;
            const payload = await response.json();
            if (!payload?.population) return;
            const formatted = Number(payload.population).toLocaleString();
            setPopulationBySlug((prev) => ({
              ...prev,
              [city.slug]: formatted,
            }));
            const cacheKey = `${city.name}|${city.state}|${city.country}`;
            storage.setPopulationCache({
              ...cache,
              [cacheKey]: { value: formatted, fetchedAt: Date.now() },
            });
          } catch (error) {
            if ((error as Error).name !== "AbortError") {
              return;
            }
          }
        })
      );
    };

    loadPopulations();
    return () => controller.abort();
  }, [backendUrl, filteredCities]);

  useEffect(() => {
    const controller = new AbortController();
    const loadOverview = async () => {
      const targets = filteredCities.filter(
        (city) =>
          !medianIncomeRef.current[city.slug] ||
          costIndexRef.current[city.slug] == null
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
            const [overviewRes, livingRes] = await Promise.all([
              fetch(`${backendUrl}/api/cities/overview?${params.toString()}`, {
                credentials: "include",
                signal: controller.signal,
              }),
              fetch(`${backendUrl}/api/cities/living-costs?${params.toString()}`, {
                credentials: "include",
                signal: controller.signal,
              }),
            ]);

            if (overviewRes.ok) {
              const payload = await overviewRes.json();
              if (payload?.medianIncome != null) {
                const formatted = Number(payload.medianIncome).toLocaleString();
                setMedianIncomeBySlug((prev) => ({
                  ...prev,
                  [city.slug]: formatted,
                }));
              }
            }

            if (livingRes.ok) {
              const payload = await livingRes.json();
              if (payload?.costIndex != null) {
                setCostIndexBySlug((prev) => ({
                  ...prev,
                  [city.slug]: Number(payload.costIndex),
                }));
              }
            }
          } catch (error) {
            if ((error as Error).name !== "AbortError") {
              return;
            }
          }
        })
      );
    };

    loadOverview();
    return () => controller.abort();
  }, [backendUrl, filteredCities]);

  useEffect(() => {
    const controller = new AbortController();
    const loadEconomy = async () => {
      const targets = filteredCities.filter(
        (city) => !economyRef.current[city.slug]
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
            const response = await fetch(
              `${backendUrl}/api/cities/economy?${params.toString()}`,
              { credentials: "include", signal: controller.signal }
            );
            if (!response.ok) return;
            const payload = await response.json();
            if (
              payload?.businessScore == null ||
              payload?.opportunityScore == null ||
              payload?.networkStrength == null
            ) {
              return;
            }
            const value = {
              businessScore: Number(payload.businessScore),
              opportunityScore: Number(payload.opportunityScore),
              networkStrength: Number(payload.networkStrength),
            };
            setEconomyBySlug((prev) => ({
              ...prev,
              [city.slug]: value,
            }));
          } catch (error) {
            if ((error as Error).name !== "AbortError") {
              return;
            }
          }
        })
      );
    };

    loadEconomy();
    return () => controller.abort();
  }, [backendUrl, filteredCities]);

  const toggleFavorite = (slug: string) => {
    setFavorites((prev) =>
      prev.includes(slug)
        ? prev.filter((item) => item !== slug)
        : [...prev, slug]
    );
  };

  const saveSearch = () => {
    if (!query && region === "All") return;
    setSearches((prev) => [
      {
        id: crypto.randomUUID(),
        query: query || "All cities",
        region,
        createdAt: "Just now",
      },
      ...prev,
    ]);
  };

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              City Discovery
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              Find the right market for your business.
            </h2>
          </div>
          <button
            onClick={saveSearch}
            className="rounded-full bg-[#1e1a16] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
          >
            Save this search
          </button>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.4fr_0.4fr]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cities, states"
            className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 text-sm text-[#1e1a16] outline-none focus:border-[#0f766e]"
          />
          <select
            value={region}
            onChange={(event) =>
              setRegion(event.target.value as (typeof regions)[number])
            }
            className="rounded-2xl border border-black/10 bg-white/80 px-3 py-3 text-sm text-[#1e1a16] outline-none focus:border-[#0f766e]"
          >
            {regions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={sortKey}
            onChange={(event) =>
              setSortKey(
                event.target.value as (typeof sortOptions)[number]["key"]
              )
            }
            className="rounded-2xl border border-black/10 bg-white/80 px-3 py-3 text-sm text-[#1e1a16] outline-none focus:border-[#0f766e]"
          >
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredCities.map((city) => {
          const isFavorite = favorites.includes(city.slug);
          return (
            <div
              key={city.slug}
              className="glass-panel flex h-full flex-col rounded-3xl p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-[#1e1a16]">
                    {city.name}, {city.state}
                  </h3>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                    {city.region}
                  </p>
                </div>
                <button
                  onClick={() => toggleFavorite(city.slug)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    isFavorite
                      ? "border-[#c59a4a] bg-[#c59a4a]/15 text-[#8a5a16]"
                      : "border-[#1e1a16]/15 bg-white/60 text-[#1e1a16]"
                  }`}
                >
                  {isFavorite ? "★ Saved" : "☆ Save"}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#5a5249]">
                {(() => {
                  const economy = economyBySlug[city.slug];
                  const businessScore =
                    economy?.businessScore ?? city.businessScore;
                  const opportunityScore =
                    economy?.opportunityScore ?? city.opportunityScore;
                  const costIndex =
                    costIndexBySlug[city.slug] ?? city.costIndex;
                  const medianIncome =
                    medianIncomeBySlug[city.slug] ?? city.medianIncome;

                  return (
                    <>
                      <div>
                        <p className="text-[#8a7d70]">Population</p>
                        <p className="text-sm font-semibold text-[#1e1a16]">
                          {populationBySlug[city.slug] || city.population}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8a7d70]">Median income</p>
                        <p className="text-sm font-semibold text-[#1e1a16]">
                          {medianIncome}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8a7d70]">Cost index</p>
                        <p className="text-sm font-semibold text-[#1e1a16]">
                          {costIndex}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8a7d70]">Business score</p>
                        <p className="text-sm font-semibold text-[#1e1a16]">
                          {businessScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#8a7d70]">Opportunity score</p>
                        <p className="text-sm font-semibold text-[#1e1a16]">
                          {opportunityScore}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {city.industries.slice(0, 3).map((industry) => (
                  <span
                    key={industry}
                    className="rounded-full border border-[#1e1a16]/10 bg-white/70 px-3 py-1 text-xs text-[#4f463c]"
                  >
                    {industry}
                  </span>
                ))}
              </div>
              <div className="mt-auto pt-6">
                <Link
                  href={`/cities/${city.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f766e]"
                >
                  View city profile <span>→</span>
                </Link>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
