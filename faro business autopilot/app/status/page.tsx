async function getSupabaseStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return { ok: false, detail: "Missing Supabase env vars" };
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    const body = await res.json();
    return { ok: res.ok, detail: `${body.name ?? "unknown"} ${body.version ?? ""}`.trim() };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Unreachable" };
  }
}

export default async function Home() {
  const supabase = await getSupabaseStatus();
  const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Faro Business Autopilot</h1>
        <p className="mt-1 text-sm text-black/60">
          Service layer connecting n8n workflows to Supabase.
        </p>
      </div>

      <div className="rounded-lg border border-black/10 bg-white/60 p-4">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${supabase.ok ? "bg-emerald-500" : "bg-red-500"}`}
          />
          <span className="font-medium">Supabase</span>
        </div>
        <p className="mt-1 text-sm text-black/60">{supabase.detail}</p>
      </div>

      <div className="rounded-lg border border-black/10 bg-white/60 p-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="font-medium">n8n</span>
        </div>
        <p className="mt-1 text-sm text-black/60">{n8nUrl}</p>
      </div>

      <p className="text-xs text-black/40">
        Webhook receiver: <code>/api/n8n-webhook</code> · Health check: <code>/api/health</code>
      </p>
    </main>
  );
}
