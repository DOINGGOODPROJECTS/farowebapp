import { getOverviewData } from "@/lib/dashboard/getOverviewData";
import { StatCard } from "./stat-card";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    amount,
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium capitalize text-black/70">
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default async function DashboardPage() {
  const data = await getOverviewData();

  return (
    <div className="flex flex-col gap-8">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total leads" value={String(data.leads.total)} />
        <StatCard
          label="Qualified leads"
          value={String(data.leads.byStatus.qualified ?? 0)}
          sub={`${data.leads.byStatus.new ?? 0} new`}
        />
        <StatCard
          label="Open deals"
          value={String(data.deals.openCount)}
          sub={formatMoney(data.deals.openValue) + " pipeline"}
        />
        <StatCard
          label="Report requests"
          value={String(data.reportRequests.total)}
          sub={`${data.reportRequests.byStatus.completed ?? 0} completed`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold">Recent leads</h2>
          <div className="mt-3 flex flex-col gap-2">
            {data.leads.recent.length === 0 && <p className="text-sm text-black/40">No leads yet.</p>}
            {data.leads.recent.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between border-b border-black/5 pb-2 text-sm">
                <div>
                  <p className="font-medium">{lead.title}</p>
                  <p className="text-xs text-black/40">{formatDate(lead.created_at)} · score {lead.score}</p>
                </div>
                <StatusPill label={lead.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-black/10 bg-white p-4">
          <h2 className="text-sm font-semibold">Recent report requests</h2>
          <div className="mt-3 flex flex-col gap-2">
            {data.reportRequests.recent.length === 0 && (
              <p className="text-sm text-black/40">No report requests yet.</p>
            )}
            {data.reportRequests.recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-black/5 pb-2 text-sm">
                <div>
                  <p className="font-medium">{r.request_number}</p>
                  <p className="text-xs text-black/40">{formatDate(r.created_at)}</p>
                </div>
                <StatusPill label={r.status} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-sm font-semibold">Deal pipeline by stage</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(data.deals.byStage).length === 0 && (
            <p className="text-sm text-black/40">No open deals.</p>
          )}
          {Object.entries(data.deals.byStage).map(([stage, count]) => (
            <div key={stage} className="rounded-md border border-black/10 px-3 py-2 text-sm">
              <span className="font-medium capitalize">{stage.replace(/_/g, " ")}</span>
              <span className="ml-2 text-black/40">{count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
