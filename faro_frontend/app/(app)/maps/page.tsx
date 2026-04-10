"use client";

import { useState } from "react";
import { cities } from "@/lib/data";

const overlays = [
  "Cost of living",
  "Business climate",
  "Underrepresented entrepreneurs",
  "Grant density",
] as const;

export default function MapsPage() {
  const [overlay, setOverlay] = useState<(typeof overlays)[number]>(
    overlays[0]
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Interactive Maps
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              Visualize relocation signals by region.
            </h2>
          </div>
          <select
            value={overlay}
            onChange={(event) =>
              setOverlay(event.target.value as (typeof overlays)[number])
            }
            className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-xs font-semibold text-[#1e1a16]"
          >
            {overlays.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid h-[420px] place-items-center rounded-3xl border border-dashed border-[#1e1a16]/15 bg-white/60 text-sm text-[#6a6056]">
          <div className="text-center">
            <p className="text-lg font-semibold text-[#1e1a16]">
              Map overlay: {overlay}
            </p>
            <p className="mt-2">
              Placeholder map layer ready for Mapbox or Leaflet integration.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {cities.slice(0, 6).map((city) => (
                <span
                  key={city.slug}
                  className="rounded-full border border-[#1e1a16]/10 bg-white/70 px-3 py-1 text-xs"
                >
                  {city.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <aside className="glass-panel rounded-3xl p-6">
        <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
          Overlay insights
        </p>
        <div className="mt-4 space-y-4 text-sm text-[#5a5249]">
          {cities.slice(0, 4).map((city) => (
            <div
              key={city.slug}
              className="rounded-2xl border border-black/5 bg-white/80 p-4"
            >
              <p className="font-semibold text-[#1e1a16]">
                {city.name}, {city.state}
              </p>
              <p className="mt-2">Opportunity score: {city.opportunityScore}</p>
              <p className="text-xs text-[#8a7d70]">
                Highlight: {city.highlights[0]}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
