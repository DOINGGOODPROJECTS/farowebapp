import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface DashboardOverview {
  leads: {
    total: number;
    byStatus: Record<string, number>;
    recent: { id: string; title: string; status: string; score: number; created_at: string }[];
  };
  deals: {
    openCount: number;
    openValue: number;
    byStage: Record<string, number>;
  };
  reportRequests: {
    total: number;
    byStatus: Record<string, number>;
    recent: { id: string; request_number: string; status: string; created_at: string }[];
  };
}

export async function getOverviewData(): Promise<DashboardOverview> {
  const supabase = createAdminClient();

  const [leadsRes, dealsRes, reportRequestsRes] = await Promise.all([
    supabase.from("leads").select("id, title, status, score, created_at").order("created_at", { ascending: false }),
    supabase.from("deals").select("id, stage, status, amount").eq("status", "open"),
    supabase
      .from("report_requests")
      .select("id, request_number, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const leads = leadsRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const reportRequests = reportRequestsRes.data ?? [];

  const leadsByStatus: Record<string, number> = {};
  for (const lead of leads) {
    leadsByStatus[lead.status] = (leadsByStatus[lead.status] ?? 0) + 1;
  }

  const dealsByStage: Record<string, number> = {};
  let openValue = 0;
  for (const deal of deals) {
    dealsByStage[deal.stage] = (dealsByStage[deal.stage] ?? 0) + 1;
    openValue += Number(deal.amount ?? 0);
  }

  const requestsByStatus: Record<string, number> = {};
  for (const r of reportRequests) {
    requestsByStatus[r.status] = (requestsByStatus[r.status] ?? 0) + 1;
  }

  return {
    leads: {
      total: leads.length,
      byStatus: leadsByStatus,
      recent: leads.slice(0, 8),
    },
    deals: {
      openCount: deals.length,
      openValue,
      byStage: dealsByStage,
    },
    reportRequests: {
      total: reportRequests.length,
      byStatus: requestsByStatus,
      recent: reportRequests.slice(0, 8),
    },
  };
}
