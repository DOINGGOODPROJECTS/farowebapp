-- System module: global/org-scoped settings, feature flags, atomic
-- number sequences (order numbers, invoice numbers, etc.), migration
-- history, backup runs, and service health checks. This is the final
-- module of the 137-table schema.
--
-- No foreign keys are deferred in this module — everything it references
-- (organizations, users) already exists.
--
-- Like Analytics & Audit, this is pure system infrastructure with no
-- customer-facing ownership concept — five of the six tables get no
-- client-facing policy at all. The one exception is system_settings,
-- which gets a row-level filter: an org can see its own settings, but
-- never a row flagged is_secret, even if it's scoped to their own org.

-- Enums --------------------------------------------------------------------

create type sequence_reset_policy as enum ('never', 'daily', 'monthly', 'yearly');
create type backup_type as enum ('database', 'object_storage', 'configuration', 'full');
create type health_status as enum ('healthy', 'degraded', 'unhealthy', 'unknown');

-- Tables ---------------------------------------------------------------------

create table system_settings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  setting_key varchar(160) not null,
  setting_value jsonb not null,
  is_secret boolean not null default false,
  description text,
  updated_by uuid references users(id),
  unique (organization_id, setting_key)
);
create trigger set_updated_at before update on system_settings
  for each row execute function set_updated_at();

create table feature_flags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(120) not null unique,
  name varchar(255) not null,
  description text,
  is_enabled boolean not null default false,
  rollout_percentage numeric(5,2) not null default 0,
  targeting_rules jsonb not null default '{}'::jsonb
);
create trigger set_updated_at before update on feature_flags
  for each row execute function set_updated_at();

create table number_sequences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sequence_code varchar(80) not null unique,
  prefix varchar(20),
  current_value bigint not null default 0,
  padding integer not null default 6,
  reset_policy sequence_reset_policy not null default 'never',
  last_reset_at timestamptz
);
create trigger set_updated_at before update on number_sequences
  for each row execute function set_updated_at();

create table schema_migrations (
  version varchar(160) primary key,
  name varchar(255) not null,
  checksum varchar(128) not null,
  executed_at timestamptz not null default now(),
  execution_time_ms integer not null,
  success boolean not null
);
create index schema_migrations_executed_at_idx on schema_migrations(executed_at);

create table backup_runs (
  id uuid primary key default gen_random_uuid(),
  backup_type backup_type not null,
  status job_status not null,
  storage_location text not null,
  size_bytes bigint,
  checksum varchar(128),
  started_at timestamptz not null,
  completed_at timestamptz,
  retention_until date,
  verified_at timestamptz,
  error_message text
);
create index backup_runs_status_started_at_idx on backup_runs(status, started_at desc);

create table health_checks (
  id uuid primary key default gen_random_uuid(),
  service_name varchar(160) not null,
  status health_status not null,
  response_time_ms integer,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);
create index health_checks_service_name_checked_at_idx on health_checks(service_name, checked_at desc);

-- Row Level Security ----------------------------------------------------------

alter table system_settings enable row level security;
alter table feature_flags enable row level security;
alter table number_sequences enable row level security;
alter table schema_migrations enable row level security;
alter table backup_runs enable row level security;
alter table health_checks enable row level security;

-- system_settings: an org can see its own non-secret settings; secret
-- ones (is_secret = true) stay hidden even from the owning org — writes
-- are service-role only either way.
create policy system_settings_select_access on system_settings for select
  using (is_organization_member(organization_id) and not is_secret);

-- feature_flags / number_sequences / schema_migrations / backup_runs /
-- health_checks: no client-facing policies. Feature-flag evaluation and
-- number-sequence allocation happen server-side; migration history,
-- backups, and health checks are pure ops tooling — same treatment as
-- the rest of the Analytics & Audit module.
