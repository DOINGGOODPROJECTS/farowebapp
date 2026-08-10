-- Research & Reports module: cities, grants, the RAG knowledge base behind
-- them, and the report generation/delivery pipeline. This is the core
-- product FARO sells.
--
-- Three foreign keys from the spec are deferred until the Files & Storage
-- module exists, same pattern as prior migrations:
--   source_documents.file_id      -> files.id
--   reports.file_id               -> files.id
--   report_downloads.download_token_id -> signed_download_tokens.id

create extension if not exists vector;

-- Enums --------------------------------------------------------------------

create type grant_type as enum ('grant', 'challenge', 'fellowship', 'prize', 'loan', 'investment', 'other');
create type grant_status as enum ('draft', 'open', 'closed', 'rolling', 'cancelled', 'archived');
create type eligibility_status as enum ('eligible', 'possibly_eligible', 'ineligible', 'unknown');
create type data_source_type as enum ('internal', 'government', 'open_data', 'website', 'document', 'api', 'manual');
create type processing_status as enum ('pending', 'processing', 'completed', 'failed');
create type report_request_status as enum ('queued', 'processing', 'awaiting_review', 'completed', 'failed', 'cancelled');
create type report_status as enum ('draft', 'review', 'approved', 'published', 'superseded', 'archived');

-- Tables ---------------------------------------------------------------------

create table data_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name varchar(255) not null,
  source_type data_source_type not null,
  base_url text,
  publisher varchar(255),
  license varchar(160),
  terms_url text,
  reliability_score numeric(5,2) not null default 50,
  is_active boolean not null default true,
  retrieval_policy jsonb not null default '{}'::jsonb
);
create index data_sources_type_is_active_idx on data_sources(source_type, is_active);
create trigger set_updated_at before update on data_sources
  for each row execute function set_updated_at();

create table cities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name varchar(160) not null,
  slug citext not null,
  country_code char(2) not null,
  state_region varchar(160),
  latitude numeric(9,6),
  longitude numeric(9,6),
  population bigint,
  timezone varchar(64),
  status record_status not null default 'active',
  source_date date,
  unique (country_code, state_region, slug)
);
create index cities_country_code_idx on cities(country_code);
create trigger set_updated_at before update on cities
  for each row execute function set_updated_at();

create table city_metrics (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  city_id uuid not null references cities(id) on delete cascade,
  metric_code varchar(120) not null,
  metric_name varchar(255) not null,
  value_numeric numeric(24,6),
  value_text text,
  unit varchar(80),
  period_start date,
  period_end date,
  source_id uuid references data_sources(id),
  confidence numeric(5,4)
);
create index city_metrics_city_metric_period_idx on city_metrics(city_id, metric_code, period_end desc);
create trigger set_updated_at before update on city_metrics
  for each row execute function set_updated_at();

create table city_rankings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  city_id uuid not null references cities(id) on delete cascade,
  ranking_code varchar(120) not null,
  score numeric(10,4) not null,
  rank integer,
  total_ranked integer,
  calculation_version varchar(80) not null,
  calculated_at timestamptz not null default now(),
  components jsonb not null default '{}'::jsonb
);
create index city_rankings_ranking_code_rank_idx on city_rankings(ranking_code, rank);
create index city_rankings_city_id_idx on city_rankings(city_id);
create trigger set_updated_at before update on city_rankings
  for each row execute function set_updated_at();

create table grants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title varchar(500) not null,
  funder_organization_id uuid references organizations(id),
  grant_type grant_type not null,
  status grant_status not null default 'open',
  summary text,
  eligibility text,
  min_amount numeric(14,2),
  max_amount numeric(14,2),
  currency char(3),
  opens_at date,
  deadline_at timestamptz,
  geographies jsonb not null default '[]'::jsonb,
  themes jsonb not null default '[]'::jsonb,
  application_url text,
  source_id uuid references data_sources(id),
  verified_at timestamptz
);
create index grants_status_deadline_at_idx on grants(status, deadline_at);
create index grants_themes_gin_idx on grants using gin (themes);
create index grants_geographies_gin_idx on grants using gin (geographies);
create trigger set_updated_at before update on grants
  for each row execute function set_updated_at();

create table grant_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  grant_id uuid not null references grants(id) on delete cascade,
  rule_type varchar(120) not null,
  operator varchar(40) not null,
  rule_value jsonb not null,
  description text,
  is_mandatory boolean not null default true
);
create index grant_eligibility_rules_grant_id_idx on grant_eligibility_rules(grant_id);
create trigger set_updated_at before update on grant_eligibility_rules
  for each row execute function set_updated_at();

create table grant_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  grant_id uuid not null references grants(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  match_score numeric(5,2) not null,
  eligibility_status eligibility_status not null,
  reasons jsonb not null,
  ai_run_id uuid references ai_model_runs(id),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  unique (grant_id, organization_id)
);
create index grant_matches_match_score_idx on grant_matches(match_score desc);
create trigger set_updated_at before update on grant_matches
  for each row execute function set_updated_at();

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_id uuid not null references data_sources(id),
  title varchar(500) not null,
  source_url text,
  -- Will reference files.id once the Files & Storage module exists.
  file_id uuid,
  content_hash varchar(128),
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  language varchar(10),
  processing_status processing_status not null default 'pending',
  unique (source_id, content_hash)
);
create index source_documents_processing_status_idx on source_documents(processing_status);
create trigger set_updated_at before update on source_documents
  for each row execute function set_updated_at();

create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_document_id uuid not null references source_documents(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  unique (source_document_id, chunk_index)
);
create trigger set_updated_at before update on knowledge_chunks
  for each row execute function set_updated_at();

create table knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  knowledge_chunk_id uuid not null references knowledge_chunks(id) on delete cascade,
  embedding_model varchar(160) not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (knowledge_chunk_id, embedding_model)
);
create index knowledge_embeddings_hnsw_idx on knowledge_embeddings
  using hnsw (embedding vector_cosine_ops);

create table report_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(120) not null,
  name varchar(255) not null,
  product_id uuid references products(id),
  version integer not null default 1,
  html_template text not null,
  css_template text,
  input_schema jsonb not null,
  output_schema jsonb not null,
  status template_status not null default 'draft',
  created_by uuid not null references users(id),
  unique (code, version)
);
create trigger set_updated_at before update on report_templates
  for each row execute function set_updated_at();

create table report_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  request_number varchar(40) not null unique,
  organization_id uuid references organizations(id),
  requested_by uuid not null references users(id),
  product_id uuid not null references products(id),
  order_item_id uuid references order_items(id),
  template_id uuid references report_templates(id),
  status report_request_status not null default 'queued',
  input_parameters jsonb not null,
  credit_ledger_entry_id uuid references credit_ledger_entries(id),
  priority priority_level not null default 'medium',
  due_at timestamptz
);
create index report_requests_status_priority_created_idx on report_requests(status, priority, created_at);
create trigger set_updated_at before update on report_requests
  for each row execute function set_updated_at();

create table reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_request_id uuid not null references report_requests(id),
  title varchar(500) not null,
  status report_status not null default 'draft',
  version integer not null default 1,
  structured_content jsonb not null,
  summary text,
  confidence_score numeric(5,4),
  generated_by_ai_run_id uuid references ai_model_runs(id),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  -- Will reference files.id once the Files & Storage module exists.
  file_id uuid
);
create index reports_report_request_id_version_idx on reports(report_request_id, version desc);
create index reports_status_idx on reports(status);
create trigger set_updated_at before update on reports
  for each row execute function set_updated_at();

create table report_sections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_id uuid not null references reports(id) on delete cascade,
  section_key varchar(120) not null,
  title varchar(500) not null,
  position integer not null,
  content jsonb not null,
  source_citations jsonb not null default '[]'::jsonb,
  unique (report_id, section_key)
);
create index report_sections_report_id_position_idx on report_sections(report_id, position);
create trigger set_updated_at before update on report_sections
  for each row execute function set_updated_at();

create table report_citations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  report_id uuid not null references reports(id) on delete cascade,
  section_id uuid references report_sections(id),
  source_document_id uuid references source_documents(id),
  source_url text,
  citation_label varchar(160) not null,
  quoted_text text,
  retrieved_at timestamptz
);
create index report_citations_report_id_idx on report_citations(report_id);
create trigger set_updated_at before update on report_citations
  for each row execute function set_updated_at();

create table report_downloads (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id),
  user_id uuid references users(id),
  -- Will reference signed_download_tokens.id once the Files & Storage
  -- module exists.
  download_token_id uuid,
  ip_address inet,
  user_agent text,
  downloaded_at timestamptz not null default now()
);
create index report_downloads_report_id_downloaded_at_idx on report_downloads(report_id, downloaded_at desc);

-- Row Level Security ----------------------------------------------------------

create or replace function can_access_report_request(p_report_request_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from report_requests
    where id = p_report_request_id
      and (requested_by = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_report(p_report_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from reports
    where id = p_report_id and can_access_report_request(report_request_id)
  );
$$;

alter table data_sources enable row level security;
alter table cities enable row level security;
alter table city_metrics enable row level security;
alter table city_rankings enable row level security;
alter table grants enable row level security;
alter table grant_eligibility_rules enable row level security;
alter table grant_matches enable row level security;
alter table source_documents enable row level security;
alter table knowledge_chunks enable row level security;
alter table knowledge_embeddings enable row level security;
alter table report_templates enable row level security;
alter table report_requests enable row level security;
alter table reports enable row level security;
alter table report_sections enable row level security;
alter table report_citations enable row level security;
alter table report_downloads enable row level security;

-- cities / city_metrics / city_rankings / grants / grant_eligibility_rules /
-- data_sources: FARO's core public intelligence product. Readable by any
-- authenticated user; writes are service-role only (data pipeline / admin
-- tooling), same treatment as the products catalog in migration 0006.
create policy data_sources_select_authenticated on data_sources for select
  to authenticated using (true);
create policy cities_select_authenticated on cities for select
  to authenticated using (true);
create policy city_metrics_select_authenticated on city_metrics for select
  to authenticated using (true);
create policy city_rankings_select_authenticated on city_rankings for select
  to authenticated using (true);
create policy grants_select_authenticated on grants for select
  to authenticated using (true);
create policy grant_eligibility_rules_select_authenticated on grant_eligibility_rules for select
  to authenticated using (true);

-- grant_matches: personalized AI-generated matches for an organization —
-- visible only to that organization, not the wider public. Written by the
-- matching agent via the service role, not direct client insert.
create policy grant_matches_select_access on grant_matches for select
  using (is_organization_member(organization_id));

-- source_documents / knowledge_chunks / knowledge_embeddings: the RAG
-- pipeline's raw material. Not customer-facing — reports expose citations
-- via report_citations (which carries its own source_url/quoted_text), so
-- direct access to the underlying scraped documents/embeddings isn't
-- needed. Service-role only, same treatment as workflow_executions.

-- report_templates: shared assets, same treatment as message_templates /
-- prompt_templates — readable by all, writable only by the creator.
create policy report_templates_select_authenticated on report_templates for select
  to authenticated using (true);
create policy report_templates_insert_owner on report_templates for insert
  with check (created_by = auth.uid());
create policy report_templates_update_owner on report_templates for update
  using (created_by = auth.uid());

-- report_requests: a customer can see and create their own requests
-- (actual credit/payment verification happens in application code before
-- the insert, not purely via RLS).
create policy report_requests_select_access on report_requests for select
  using (requested_by = auth.uid() or is_organization_member(organization_id));
create policy report_requests_insert_owner on report_requests for insert
  with check (requested_by = auth.uid());

-- reports / report_sections / report_citations: view-only for whoever
-- requested the underlying report_request. Generated by the report
-- pipeline (service role), not created directly by clients.
create policy reports_select_access on reports for select
  using (can_access_report_request(report_request_id));

create policy report_sections_select_access on report_sections for select
  using (can_access_report(report_id));

create policy report_citations_select_access on report_citations for select
  using (can_access_report(report_id));

-- report_downloads: an access-audit log. The owner can see and log their
-- own downloads.
create policy report_downloads_select_access on report_downloads for select
  using (user_id = auth.uid() or can_access_report(report_id));
create policy report_downloads_insert_owner on report_downloads for insert
  with check (user_id = auth.uid() and can_access_report(report_id));
