"use client";

import { useState } from "react";
import { notifications } from "@/lib/data";

const categories = ["All", "Grants", "City Data", "Network"] as const;

export default function NotificationsPage() {
  const [filter, setFilter] = useState<(typeof categories)[number]>("All");

  const visible = notifications.filter((item) =>
    filter === "All" ? true : item.category === filter
  );

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-[#c59a4a]">
              Notification Center
            </p>
            <h2 className="mt-3 font-serif text-3xl text-[#1e1a16]">
              Stay on top of grants, updates, and matches.
            </h2>
          </div>
          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as (typeof categories)[number])
            }
            className="rounded-full border border-[#1e1a16]/20 bg-white/70 px-4 py-2 text-xs font-semibold text-[#1e1a16]"
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="grid gap-4">
        {visible.map((item) => (
          <div
            key={item.id}
            className="glass-panel flex items-center justify-between rounded-3xl p-6"
          >
            <div>
              <p className="text-sm font-semibold text-[#1e1a16]">
                {item.title}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[#8a7d70]">
                {item.category}
              </p>
            </div>
            <span className="text-xs text-[#8a7d70]">{item.time}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
