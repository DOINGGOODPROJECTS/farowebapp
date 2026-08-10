import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReportContent } from "@/lib/ai/generateReportContent";
import { renderReportPdf } from "@/lib/reports/renderReportPdf";
import { uploadObject } from "@/lib/storage/b2";

const requestSchema = z.object({
  requestedBy: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  city: z.string().min(1).max(160),
  businessType: z.string().min(1).max(255),
  additionalContext: z.string().max(2000).optional(),
});

const SECTION_TITLES: Record<string, string> = {
  executive_summary: "Executive Summary",
  market_potential: "Market Potential",
  cost_considerations: "Cost Considerations",
  funding_opportunities: "Funding Opportunities",
  business_ecosystem: "Business Ecosystem",
  risks: "Risks",
  recommendations: "Recommendations",
};

export async function POST(req: NextRequest) {
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const supabase = createAdminClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, requires_human_review")
    .eq("code", "city-opportunity-report")
    .single();
  if (productError || !product) {
    return NextResponse.json({ error: "City Opportunity Report product is not configured" }, { status: 500 });
  }

  const { data: model, error: modelError } = await supabase
    .from("ai_models")
    .select("id")
    .eq("model_code", process.env.GROQ_MODEL!)
    .single();
  if (modelError || !model) {
    return NextResponse.json({ error: "Report-generation model is not registered" }, { status: 500 });
  }

  const requestNumber = `RPT-${crypto.randomUUID().split("-")[0].toUpperCase()}`;

  const { data: reportRequest, error: reportRequestError } = await supabase
    .from("report_requests")
    .insert({
      request_number: requestNumber,
      organization_id: input.organizationId,
      requested_by: input.requestedBy,
      product_id: product.id,
      status: "processing",
      input_parameters: {
        city: input.city,
        businessType: input.businessType,
        additionalContext: input.additionalContext,
      },
    })
    .select("id")
    .single();
  if (reportRequestError || !reportRequest) {
    return NextResponse.json({ error: reportRequestError?.message }, { status: 500 });
  }

  const startedAt = Date.now();
  let content;
  try {
    content = await generateReportContent({
      city: input.city,
      businessType: input.businessType,
      additionalContext: input.additionalContext,
    });
  } catch (err) {
    await supabase
      .from("report_requests")
      .update({ status: "failed" })
      .eq("id", reportRequest.id);
    return NextResponse.json({ error: `Report generation failed: ${err}` }, { status: 502 });
  }
  const latencyMs = Date.now() - startedAt;

  const { data: aiRun, error: aiRunError } = await supabase
    .from("ai_model_runs")
    .insert({
      model_id: model.id,
      organization_id: input.organizationId,
      user_id: input.requestedBy,
      purpose: "city_opportunity_report",
      status: "succeeded",
      latency_ms: latencyMs,
      confidence_score: content.confidence,
      started_at: new Date(startedAt).toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (aiRunError) {
    return NextResponse.json({ error: aiRunError.message }, { status: 500 });
  }

  const isAutoPublishable = !product.requires_human_review;

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      report_request_id: reportRequest.id,
      title: `${input.businessType} in ${input.city}: City Opportunity Report`,
      status: isAutoPublishable ? "published" : "review",
      structured_content: content,
      summary: content.summary,
      confidence_score: content.confidence,
      generated_by_ai_run_id: aiRun.id,
      published_at: isAutoPublishable ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (reportError || !report) {
    return NextResponse.json({ error: reportError?.message }, { status: 500 });
  }

  const { error: sectionsError } = await supabase.from("report_sections").insert(
    content.sections.map((section, index) => ({
      report_id: report.id,
      section_key: section.section_key,
      title: SECTION_TITLES[section.section_key] ?? section.title,
      position: index,
      content: { body: section.content },
    })),
  );
  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 });
  }

  let fileId: string | null = null;
  try {
    if (process.env.DISABLE_PDF_RENDERING === "true") {
      throw new Error("PDF rendering is disabled on this deployment (DISABLE_PDF_RENDERING=true)");
    }
    const pdfBuffer = await renderReportPdf({
      title: `${input.businessType} in ${input.city}: City Opportunity Report`,
      summary: content.summary,
      sections: content.sections.map((section) => ({
        title: SECTION_TITLES[section.section_key] ?? section.section_key,
        content: section.content,
      })),
    });

    const objectKey = `reports/${report.id}.pdf`;
    const { checksumSha256, sizeBytes } = await uploadObject({
      objectKey,
      body: pdfBuffer,
      contentType: "application/pdf",
    });

    const { data: file, error: fileError } = await supabase
      .from("files")
      .insert({
        organization_id: input.organizationId,
        uploaded_by: input.requestedBy,
        bucket_name: process.env.B2_BUCKET_NAME!,
        object_key: objectKey,
        original_name: `${requestNumber}.pdf`,
        mime_type: "application/pdf",
        size_bytes: sizeBytes,
        checksum_sha256: checksumSha256,
        visibility: "private",
        virus_scan_status: "pending",
      })
      .select("id")
      .single();
    if (fileError || !file) {
      throw new Error(fileError?.message ?? "Failed to record file");
    }
    fileId = file.id;

    await supabase.from("reports").update({ file_id: fileId }).eq("id", report.id);
  } catch (err) {
    // PDF generation/upload failing shouldn't block the report content
    // itself from being usable — the structured content is already saved.
    console.error("Report PDF generation failed:", err);
  }

  await supabase
    .from("report_requests")
    .update({ status: "completed" })
    .eq("id", reportRequest.id);

  return NextResponse.json({
    reportRequestId: reportRequest.id,
    reportId: report.id,
    status: isAutoPublishable ? "published" : "review",
    summary: content.summary,
    fileId,
  });
}
