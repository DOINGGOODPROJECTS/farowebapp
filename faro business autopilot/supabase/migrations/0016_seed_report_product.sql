-- Seeds the first sellable product: the City Opportunity Report. This is
-- the report type the generation pipeline (lib/ai/generateReportContent.ts,
-- app/api/reports/route.ts) targets first.
--
-- No report_templates row yet — report_templates.created_by requires a
-- real user and none exist pre-launch, so the initial report structure is
-- hardcoded in lib/ai/generateReportContent.ts rather than DB-driven.
-- report_requests.template_id stays null until a template management
-- feature is built.
--
-- Also seeds ai_providers/ai_models for Groq — ai_model_runs.model_id is
-- required and nothing has populated this registry yet, even though
-- lib/ai/groq.ts has been calling the Groq API directly since migration
-- 0007.

insert into products (code, name, product_type, description, fulfillment_type, requires_human_review)
values (
  'city-opportunity-report',
  'City Opportunity Report',
  'report',
  'AI-generated analysis of a city''s business opportunity for a given business type: market potential, cost considerations, funding opportunities, and risks.',
  'automatic',
  false
)
on conflict (code) do nothing;

insert into ai_providers (code, name, provider_type, base_url, is_local, credentials_secret_ref)
values ('groq', 'Groq', 'api', 'https://api.groq.com/openai/v1', false, 'GROQ_API_KEY')
on conflict (code) do nothing;

insert into ai_models (provider_id, model_code, display_name, model_type, context_window)
select id, 'openai/gpt-oss-120b', 'GPT-OSS 120B (via Groq)', 'chat', 131072
from ai_providers where code = 'groq'
on conflict (provider_id, model_code) do nothing;
