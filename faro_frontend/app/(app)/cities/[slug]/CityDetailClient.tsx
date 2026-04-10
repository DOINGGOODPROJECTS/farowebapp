"use client";

import { useEffect, useState } from "react";
import type { City } from "@/lib/data";
import Link from "next/link";
import { storage } from "@/lib/storage";

const tabs = [
  "Overview",
  "Economy",
  "Demographics",
  "Incentives",
  "Networks",
  "Living Costs",
] as const;

type Props = {
  city: City;
};

export default function CityDetailClient({ city }: Props) {
  const [active, setActive] = useState<(typeof tabs)[number]>("Overview");
  const [population, setPopulation] = useState<string>(city.population);
  const [medianIncome, setMedianIncome] = useState<string>(city.medianIncome);
  const [highlights, setHighlights] = useState<string[]>(
    city.highlights.length > 0 ? city.highlights : ["Profile details coming soon."]
  );
  const [grants, setGrants] = useState<City["grants"]>(city.grants);
  const [businessScore, setBusinessScore] = useState<number>(
    city.businessScore
  );
  const [opportunityScore, setOpportunityScore] = useState<number>(
    city.opportunityScore
  );
  const [networkStrength, setNetworkStrength] = useState<number>(
    city.networkStrength
  );
  const [blackPopulationPct, setBlackPopulationPct] = useState<number>(
    city.blackPopulationPct
  );
  const [demographicsHousingIndex, setDemographicsHousingIndex] =
    useState<number>(city.housingIndex);
  const [costIndex, setCostIndex] = useState<number>(city.costIndex);
  const [livingCostsHousingIndex, setLivingCostsHousingIndex] =
    useState<number>(city.housingIndex);
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";
  const cacheKey = `${city.name}|${city.state}|${city.country}`;
  const cacheTtlMs = 1000 * 60 * 60 * 24 * 7;

  useEffect(() => {
    let activeRequest = true;
    const loadOverview = async () => {
      try {
        const params = new URLSearchParams({
          city: city.name,
          country: city.country,
          state: city.state,
        });
        const response = await fetch(
          `${backendUrl}/api/cities/overview?${params.toString()}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!activeRequest) return;
        if (payload?.population != null) {
          setPopulation(Number(payload.population).toLocaleString());
        }
        if (payload?.medianIncome != null) {
          setMedianIncome(Number(payload.medianIncome).toLocaleString());
        }
        if (payload?.notes) {
          setHighlights([payload.notes]);
        }
      } catch {
        return;
      }
    };
    loadOverview();
    return () => {
      activeRequest = false;
    };
  }, [backendUrl, city.country, city.name, city.state]);


  useEffect(() => {
    let activeRequest = true;
    const loadEconomy = async () => {
      try {
        const params = new URLSearchParams({
          city: city.name,
          country: city.country,
          state: city.state,
        });
        const response = await fetch(
          `${backendUrl}/api/cities/economy?${params.toString()}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (
          activeRequest &&
          payload?.businessScore != null &&
          payload?.opportunityScore != null &&
          payload?.networkStrength != null
        ) {
          const value = {
            businessScore: Number(payload.businessScore),
            opportunityScore: Number(payload.opportunityScore),
            networkStrength: Number(payload.networkStrength),
          };
          setBusinessScore(value.businessScore);
          setOpportunityScore(value.opportunityScore);
          setNetworkStrength(value.networkStrength);
        }
      } catch {
        return;
      }
    };
    loadEconomy();
    return () => {
      activeRequest = false;
    };
  }, [backendUrl, cacheKey, city.country, city.name, city.state]);

  useEffect(() => {
    let activeRequest = true;
    const loadIncentives = async () => {
      try {
        const params = new URLSearchParams({
          city: city.name,
          country: city.country,
          state: city.state,
        });
        const response = await fetch(
          `${backendUrl}/api/cities/incentives?${params.toString()}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!activeRequest || !Array.isArray(payload?.incentives)) return;
        const mapped = payload.incentives.map((entry: string) => ({
          name: entry,
          deadline: "TBD",
          amount: "TBD",
        }));
        if (mapped.length > 0) {
          setGrants(mapped);
        }
      } catch {
        return;
      }
    };
    loadIncentives();
    return () => {
      activeRequest = false;
    };
  }, [backendUrl, city.country, city.name, city.state]);

  useEffect(() => {
    let activeRequest = true;
    const loadDemographics = async () => {
      try {
        const params = new URLSearchParams({
          city: city.name,
          country: city.country,
          state: city.state,
        });
        const response = await fetch(
          `${backendUrl}/api/cities/demographics?${params.toString()}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!activeRequest) return;
        if (payload?.blackPopulationPct != null) {
          setBlackPopulationPct(Number(payload.blackPopulationPct));
        }
        if (payload?.housingIndex != null) {
          setDemographicsHousingIndex(Number(payload.housingIndex));
        }
      } catch {
        return;
      }
    };
    loadDemographics();
    return () => {
      activeRequest = false;
    };
  }, [backendUrl, city.country, city.name, city.state]);

  useEffect(() => {
    let activeRequest = true;
    const loadLivingCosts = async () => {
      try {
        const params = new URLSearchParams({
          city: city.name,
          country: city.country,
          state: city.state,
        });
        const response = await fetch(
          `${backendUrl}/api/cities/living-costs?${params.toString()}`
        );
        if (!response.ok) return;
        const payload = await response.json();
        if (!activeRequest) return;
        if (payload?.costIndex != null) {
          setCostIndex(Number(payload.costIndex));
        }
        if (payload?.housingIndex != null) {
          setLivingCostsHousingIndex(Number(payload.housingIndex));
        }
      } catch {
        return;
      }
    };
    loadLivingCosts();
    return () => {
      activeRequest = false;
    };
  }, [backendUrl, city.country, city.name, city.state]);

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              City profile
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              {city.name}, {city.state}
            </h2>
            <p className="mt-2 text-sm text-[#5a5249]">
              Opportunity score {opportunityScore} • Business score{" "}
              {businessScore}
            </p>
          </div>
          <Link
            href="/comparison"
            className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-xs font-semibold text-[#1e1a16] transition hover:border-[#0f766e] hover:text-[#0f766e]"
          >
            Add to comparison
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActive(tab)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                active === tab
                  ? "border-[#0f766e] bg-[#0f766e]/10 text-[#0b4f4a]"
                  : "border-[#1e1a16]/15 bg-white/60 text-[#4f463c]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {active === "Overview" && (
        <section className="grid gap-6 lg:grid-cols-3">
          <div className="glass-panel rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Snapshot
            </p>
            <div className="mt-4 space-y-3 text-sm text-[#5a5249]">
              <div>
                <p className="text-[#8a7d70]">Population</p>
                <p className="text-lg font-semibold text-[#1e1a16]">
                  {population}
                </p>
              </div>
              <div>
                <p className="text-[#8a7d70]">Median income</p>
                <p className="text-lg font-semibold text-[#1e1a16]">
                  {medianIncome}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-panel rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Interpretation
            </p>
            <div className="mt-4 space-y-2 text-sm text-[#5a5249]">
              <p>
                Population {population} signals market size and customer depth.
              </p>
              <p>
                Median income {medianIncome} reflects local purchasing power.
              </p>
            </div>
          </div>
          <div className="glass-panel rounded-3xl p-6 lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Highlights
            </p>
            <ul className="mt-4 space-y-3 text-sm text-[#5a5249]">
              {highlights.map((highlight) => (
                <li key={highlight} className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[#c59a4a]" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {active === "Economy" && (
        <section className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Industry focus
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {city.industries.map((industry) => (
              <span
                key={industry}
                className="rounded-full border border-[#1e1a16]/10 bg-white/70 px-4 py-2 text-xs font-semibold text-[#4f463c]"
              >
                {industry}
              </span>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Business score", value: businessScore },
              { label: "Opportunity score", value: opportunityScore },
              { label: "Network strength", value: networkStrength },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-black/5 bg-white/80 p-4"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#1e1a16]">
                  {metric.value}
                </p>
                <p className="mt-2 text-xs text-[#8a7d70]">
                  {metric.label === "Business score" &&
                    "Business climate and market readiness (0-100)."}
                  {metric.label === "Opportunity score" &&
                    "Growth potential and market momentum (0-100)."}
                  {metric.label === "Network strength" &&
                    "Access to mentors, accelerators, and orgs (0-100)."}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-black/5 bg-white/80 p-5 text-sm text-[#5a5249]">
            <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
              Interpretation
            </p>
            <div className="mt-3 space-y-2">
              <p>
                Business score {businessScore} means the local business climate is{" "}
                {businessScore >= 85
                  ? "very strong"
                  : businessScore >= 70
                  ? "solid"
                  : "emerging"}
                .
              </p>
              <p>
                Opportunity score {opportunityScore} signals{" "}
                {opportunityScore >= 85
                  ? "high growth potential"
                  : opportunityScore >= 70
                  ? "steady momentum"
                  : "limited near-term upside"}
                .
              </p>
              <p>
                Network strength {networkStrength} indicates{" "}
                {networkStrength >= 85
                  ? "dense mentor and org access"
                  : networkStrength >= 70
                  ? "reliable ecosystem access"
                  : "a thinner support network"}
                .
              </p>
            </div>
          </div>
        </section>
      )}

      {active === "Demographics" && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="glass-panel rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
                Underrepresented entrepreneurs
              </p>
              <p className="mt-4 text-3xl font-semibold text-[#1e1a16]">
                {blackPopulationPct}%
              </p>
              <p className="mt-2 text-sm text-[#5a5249]">
                Represents the share of residents who identify as underrepresented entrepreneurs.
              </p>
          </div>
          <div className="glass-panel rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Housing index
            </p>
            <p className="mt-4 text-3xl font-semibold text-[#1e1a16]">
              {demographicsHousingIndex}
            </p>
            <p className="mt-2 text-sm text-[#5a5249]">
              Higher values indicate higher housing costs.
            </p>
          </div>
          <div className="glass-panel rounded-3xl p-6 lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Interpretation
            </p>
            <div className="mt-4 space-y-2 text-sm text-[#5a5249]">
              <p>
                Underrepresented entrepreneurs {blackPopulationPct}% suggests{" "}
                {blackPopulationPct >= 30
                  ? "a strong cultural network"
                  : blackPopulationPct >= 15
                  ? "a visible community presence"
                  : "a smaller community footprint"}
                .
              </p>
              <p>
                Housing index {demographicsHousingIndex} means housing costs are{" "}
                {demographicsHousingIndex <= 70
                  ? "affordable"
                  : demographicsHousingIndex <= 95
                  ? "mid-range"
                  : "expensive"}
                .
              </p>
            </div>
          </div>
        </section>
      )}

      {active === "Incentives" && (
        <section className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Grants & incentives
          </p>
          <div className="mt-4 space-y-4 text-sm text-[#5a5249]">
            {grants.map((grant) => (
              <div
                key={grant.name}
                className="rounded-2xl border border-black/5 bg-white/80 p-4"
              >
                <p className="font-semibold text-[#1e1a16]">{grant.name}</p>
                <p className="text-xs text-[#8a7d70]">
                  Deadline {grant.deadline} • {grant.amount}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {active === "Networks" && (
        <section className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Network strength
          </p>
          <p className="mt-4 text-3xl font-semibold text-[#1e1a16]">
                  {networkStrength}
                </p>
          <p className="mt-2 text-sm text-[#5a5249]">
            Based on Black business organizations, mentors, and accelerators.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {city.incentives.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[#1e1a16]/10 bg-white/70 px-4 py-2 text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        </section>
      )}

      {active === "Living Costs" && (
        <section className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Cost of living
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                Cost index
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#1e1a16]">
                {costIndex}
              </p>
              <p className="mt-2 text-xs text-[#8a7d70]">
                Lower values mean lower overall living costs.
              </p>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                Housing index
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#1e1a16]">
                {livingCostsHousingIndex}
              </p>
              <p className="mt-2 text-xs text-[#8a7d70]">
                Higher values indicate higher housing costs.
              </p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-black/5 bg-white/80 p-5 text-sm text-[#5a5249]">
            <p className="text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
              Interpretation
            </p>
            <div className="mt-3 space-y-2">
              <p>
                Cost index {costIndex} means overall living costs are{" "}
                {costIndex <= 70
                  ? "low"
                  : costIndex <= 95
                  ? "moderate"
                  : "high"}
                .
              </p>
              <p>
                Housing index {livingCostsHousingIndex} means housing costs are{" "}
                {livingCostsHousingIndex <= 70
                  ? "affordable"
                  : livingCostsHousingIndex <= 95
                  ? "mid-range"
                  : "expensive"}
                .
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
