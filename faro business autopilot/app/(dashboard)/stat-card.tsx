export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white p-4">
      <p className="text-xs font-medium text-black/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-black/40">{sub}</p>}
    </div>
  );
}
