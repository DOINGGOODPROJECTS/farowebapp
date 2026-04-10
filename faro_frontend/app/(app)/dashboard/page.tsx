"use client";

import Link from "next/link";
import { cities, notifications } from "@/lib/data";
import { storage } from "@/lib/storage";
import { useLocalState } from "@/lib/useLocalState";
import { useAuthUser } from "../auth-gate";

export default function DashboardPage() {
  const [favorites] = useLocalState(storage.getFavorites, storage.setFavorites);
  const [searches] = useLocalState(storage.getSearches, storage.setSearches);
  const [profile] = useLocalState(storage.getProfile, storage.setProfile);
  const authUser = useAuthUser();

  const displayName =
    profile.name?.trim() ||
    authUser?.name?.trim() ||
    authUser?.email?.trim() ||
    "";

  const topCities = cities
    .slice()
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel rounded-3xl p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Welcome back
          </p>
          <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
            {displayName ? `Hi, ${displayName}` : "Founder Overview"}
          </h2>
          <p className="mt-3 text-sm text-[#5a5249]">
            Your profile is optimized for {profile.industry} founders with a
            {" "}
            {profile.relocationWindow} timeline. We prepared city matches based
            on your priorities.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#6a6056]">
            {profile.priorities.map((priority) => (
              <span
                key={priority}
                className="rounded-full border border-[#1e1a16]/15 bg-white/70 px-3 py-1"
              >
                {priority}
              </span>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            <Link
              href="/search"
              className="rounded-full bg-[#1e1a16] px-5 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
            >
              Explore cities
            </Link>
            <Link
              href="/profile"
              className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-5 py-3 text-xs font-semibold text-[#1e1a16] transition hover:border-[#0f766e] hover:text-[#0f766e]"
            >
              Update profile
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            AI pulse
          </p>
          <h3 className="mt-3 text-xl font-semibold text-[#1e1a16]">
            Recommended focus cities
          </h3>
          <div className="mt-4 space-y-4">
            {topCities.map((city) => (
              <div
                key={city.slug}
                className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/80 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1e1a16]">
                    {city.name}, {city.state}
                  </p>
                  <p className="text-xs text-[#5a5249]">
                    Opportunity score {city.opportunityScore}
                  </p>
                </div>
                <Link
                  href={`/cities/${city.slug}`}
                  className="text-xs font-semibold text-[#0f766e]"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Saved searches
          </p>
          <div className="mt-4 space-y-3 text-sm text-[#5a5249]">
            {searches.length === 0 && (
              <p className="text-[#8a7d70]">
                No saved searches yet. Start exploring city matches.
              </p>
            )}
            {searches.slice(0, 4).map((search) => (
              <div
                key={search.id}
                className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/80 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1e1a16]">
                    {search.query}
                  </p>
                  <p className="text-xs">{search.region}</p>
                </div>
                <span className="text-xs text-[#8a7d70]">
                  {search.createdAt}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Favorites
          </p>
          <div className="mt-4 space-y-3 text-sm text-[#5a5249]">
            {favorites.length === 0 && (
              <p className="text-[#8a7d70]">
                Heart a city to keep it here.
              </p>
            )}
            {favorites.map((slug) => {
              const city = cities.find((item) => item.slug === slug);
              if (!city) return null;
              return (
                <div
                  key={city.slug}
                  className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/80 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#1e1a16]">
                      {city.name}, {city.state}
                    </p>
                    <p className="text-xs">{city.region}</p>
                  </div>
                  <Link
                    href={`/cities/${city.slug}`}
                    className="text-xs font-semibold text-[#0f766e]"
                  >
                    Open
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
            Alerts
          </p>
          <div className="mt-4 space-y-3 text-sm text-[#5a5249]">
            {notifications.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-black/5 bg-white/80 p-3"
              >
                <p className="text-sm font-semibold text-[#1e1a16]">
                  {item.title}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-[#8a7d70]">
                  <span>{item.category}</span>
                  <span>{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
