import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSignedDownloadUrl } from "@/lib/storage/b2";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, file_id, report_request_id, report_requests(requested_by, organization_id)")
    .eq("id", id)
    .single();
  if (reportError || !report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const reportRequest = Array.isArray(report.report_requests)
    ? report.report_requests[0]
    : report.report_requests;
  if (!reportRequest || reportRequest.requested_by !== userId) {
    return NextResponse.json({ error: "Not authorized to download this report" }, { status: 403 });
  }

  if (!report.file_id) {
    return NextResponse.json({ error: "This report's PDF isn't ready yet" }, { status: 425 });
  }

  const { data: file, error: fileError } = await supabase
    .from("files")
    .select("bucket_name, object_key")
    .eq("id", report.file_id)
    .single();
  if (fileError || !file) {
    return NextResponse.json({ error: "File record not found" }, { status: 404 });
  }

  const signedUrl = await getSignedDownloadUrl(file.object_key);

  await supabase.from("report_downloads").insert({
    report_id: report.id,
    user_id: userId,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: req.headers.get("user-agent"),
  });

  return NextResponse.redirect(signedUrl);
}
