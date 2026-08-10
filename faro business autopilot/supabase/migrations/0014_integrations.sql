-- Integrations module: connected third-party services, outbound webhook
-- subscriptions and their delivery log, CSV import jobs, and sync jobs.
--
-- No foreign keys are deferred in this module — everything it references
-- (organizations, users, files, domain_events) already exists.

-- Enums --------------------------------------------------------------------

create type integration_type as enum ('n8n', 'twenty', 'listmonk', 'mautic', 'chatwoot', 'calcom', 'invoice_ninja', 'akaunting', 'minio', 'meilisearch', 'telegram', 'whatsapp', 'smtp', 'other');
create type import_type as enum ('contacts', 'leads', 'organizations', 'grants', 'cities', 'payments', 'other');
create type import_row_status as enum ('pending', 'success', 'failed', 'skipped');
create type sync_type as enum ('full', 'incremental', 'manual');
create type sync_direction as enum ('inbound', 'outbound', 'bidirectional');

-- Tables ---------------------------------------------------------------------

create table integrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  integration_type integration_type not null,
  name varchar(255) not null,
  status connection_status not null default 'active',
  config jsonb not null default '{}'::jsonb,
  secret_reference varchar(255),
  last_sync_at timestamptz
);
create index integrations_type_status_idx on integrations(integration_type, status);
create trigger set_updated_at before update on integrations
  for each row execute function set_updated_at();

create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  name varchar(255) not null,
  target_url text not null,
  secret_encrypted text not null,
  event_types jsonb not null,
  status record_status not null default 'active',
  failure_count integer not null default 0,
  last_success_at timestamptz
);
create index webhook_endpoints_status_idx on webhook_endpoints(status);
create trigger set_updated_at before update on webhook_endpoints
  for each row execute function set_updated_at();

create table webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references webhook_endpoints(id) on delete cascade,
  event_id uuid not null references domain_events(id),
  attempt_number integer not null,
  status_code integer,
  response_body text,
  status job_status not null,
  delivered_at timestamptz,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now()
);
create index webhook_deliveries_endpoint_id_created_at_idx on webhook_deliveries(endpoint_id, created_at desc);
create index webhook_deliveries_status_next_attempt_at_idx on webhook_deliveries(status, next_attempt_at);

create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  created_by uuid not null references users(id),
  import_type import_type not null,
  source_file_id uuid references files(id),
  status job_status not null default 'queued',
  mapping_config jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0,
  successful_rows integer not null default 0,
  failed_rows integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz
);
create index import_jobs_status_created_at_idx on import_jobs(status, created_at);
create trigger set_updated_at before update on import_jobs
  for each row execute function set_updated_at();

create table import_job_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references import_jobs(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  normalized_data jsonb,
  status import_row_status not null,
  target_table varchar(120),
  -- Polymorphic reference (row id in whatever table target_table names);
  -- no FK, same pattern as human_approval_requests.reference_id.
  target_record_id uuid,
  errors jsonb not null default '[]'::jsonb,
  unique (import_job_id, row_number)
);

create table sync_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  integration_id uuid not null references integrations(id) on delete cascade,
  sync_type sync_type not null,
  direction sync_direction not null,
  status job_status not null,
  cursor text,
  records_processed integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);
create index sync_jobs_integration_id_created_at_idx on sync_jobs(integration_id, created_at desc);
create trigger set_updated_at before update on sync_jobs
  for each row execute function set_updated_at();

-- Row Level Security ----------------------------------------------------------

create or replace function can_access_import_job(p_import_job_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from import_jobs
    where id = p_import_job_id
      and (created_by = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_integration(p_integration_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from integrations
    where id = p_integration_id and is_organization_member(organization_id)
  );
$$;

alter table integrations enable row level security;
alter table webhook_endpoints enable row level security;
alter table webhook_deliveries enable row level security;
alter table import_jobs enable row level security;
alter table import_job_rows enable row level security;
alter table sync_jobs enable row level security;

-- integrations: an org can see its own connected integrations (e.g. a
-- settings page listing "connected services"). secret_reference is only a
-- pointer to a secret store, not the secret itself, so this is safe to
-- expose; writes are backend-managed (connecting a new integration
-- involves handling real credentials).
create policy integrations_select_access on integrations for select
  using (is_organization_member(organization_id));

-- webhook_endpoints / webhook_deliveries: webhook_endpoints holds a real
-- encrypted secret (secret_encrypted), so — same treatment as
-- email_accounts/whatsapp_sessions/telegram_bots — no client-facing
-- policies. webhook_deliveries is operational delivery logging with no
-- ownership concept of its own; service-role only alongside it.

-- import_jobs: visible to whoever started the import or their org, so
-- they can watch progress (total_rows/successful_rows/failed_rows).
create policy import_jobs_select_access on import_jobs for select
  using (created_by = auth.uid() or is_organization_member(organization_id));
create policy import_jobs_insert_owner on import_jobs for insert
  with check (created_by = auth.uid());

-- import_job_rows: per-row results of an import the caller can see.
create policy import_job_rows_select_access on import_job_rows for select
  using (can_access_import_job(import_job_id));

-- sync_jobs: visible to the org that owns the underlying integration.
create policy sync_jobs_select_access on sync_jobs for select
  using (can_access_integration(integration_id));
