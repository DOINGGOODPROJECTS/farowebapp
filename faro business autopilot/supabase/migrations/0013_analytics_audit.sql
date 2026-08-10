-- Analytics & Audit module: product/business analytics events, pre-
-- aggregated KPIs, the immutable audit trail, security events, and
-- data-access logging.
--
-- No foreign keys are deferred in this module — everything it references
-- (users, organizations) already exists.
--
-- Unlike every other module so far, none of these five tables get a
-- client-facing RLS policy. They're internal audit/analytics
-- infrastructure with no natural "customer self-service" ownership
-- concept — same treatment already given to workflow_executions,
-- domain_events, payment_webhook_events, and background_jobs. RLS is
-- still enabled on all of them for defense in depth, but every read and
-- write goes through the service role (analytics pipeline, audit
-- middleware, security monitoring, internal dashboards).

-- Enums --------------------------------------------------------------------

create type security_event_type as enum ('login_success', 'login_failure', 'mfa_failure', 'permission_denied', 'rate_limit', 'suspicious_activity', 'api_key_use', 'secret_access');
create type access_type as enum ('view', 'export', 'download', 'search');

-- Tables ---------------------------------------------------------------------

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name varchar(160) not null,
  user_id uuid references users(id),
  organization_id uuid references organizations(id),
  session_id uuid,
  anonymous_id varchar(255),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index analytics_events_event_name_occurred_at_idx on analytics_events(event_name, occurred_at desc);
create index analytics_events_user_id_occurred_at_idx on analytics_events(user_id, occurred_at desc);

create table daily_kpis (
  id uuid primary key default gen_random_uuid(),
  kpi_date date not null,
  organization_id uuid references organizations(id),
  metric_code varchar(120) not null,
  metric_value numeric(24,6) not null,
  dimensions jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique (kpi_date, organization_id, metric_code, dimensions)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type actor_type not null,
  actor_user_id uuid references users(id),
  organization_id uuid references organizations(id),
  action varchar(160) not null,
  resource_type varchar(120) not null,
  -- Polymorphic reference (row id in whatever table resource_type names);
  -- no FK, same pattern as human_approval_requests.reference_id.
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  correlation_id uuid,
  created_at timestamptz not null default now()
);
create index audit_logs_resource_type_resource_id_created_at_idx on audit_logs(resource_type, resource_id, created_at desc);
create index audit_logs_actor_user_id_created_at_idx on audit_logs(actor_user_id, created_at desc);

create table security_events (
  id uuid primary key default gen_random_uuid(),
  event_type security_event_type not null,
  severity risk_level not null,
  user_id uuid references users(id),
  ip_address inet,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index security_events_severity_created_at_idx on security_events(severity, created_at desc);
create index security_events_user_id_idx on security_events(user_id);

create table data_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  resource_type varchar(120) not null,
  -- Polymorphic reference, no FK, same pattern as audit_logs.resource_id.
  resource_id uuid not null,
  access_type access_type not null,
  purpose varchar(255),
  ip_address inet,
  created_at timestamptz not null default now()
);
create index data_access_logs_resource_type_resource_id_created_at_idx on data_access_logs(resource_type, resource_id, created_at desc);

-- Row Level Security ----------------------------------------------------------

alter table analytics_events enable row level security;
alter table daily_kpis enable row level security;
alter table audit_logs enable row level security;
alter table security_events enable row level security;
alter table data_access_logs enable row level security;

-- No policies for any of these five tables — see the module header comment.
