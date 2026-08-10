-- AI & Automation module: providers, models, agents, conversations, the
-- per-run cost/audit trail, human approval gates, and the workflow/job
-- infrastructure behind them.
--
-- No foreign keys are deferred in this module — everything it references
-- (organizations, users, contacts) already exists. Instead, this migration
-- closes out the two FKs deferred *from* earlier modules once ai_model_runs
-- exists, see the ALTER TABLE statements at the bottom:
--   lead_scores.ai_run_id       (deferred in migration 0003)
--   inbound_messages.ai_run_id  (deferred in migration 0005)

-- Enums --------------------------------------------------------------------

create type record_status as enum ('active', 'inactive', 'archived');
create type ai_provider_type as enum ('api', 'local', 'hybrid');
create type ai_model_type as enum ('chat', 'embedding', 'speech_to_text', 'text_to_speech', 'vision', 'image');
create type ai_agent_type as enum ('sales', 'research', 'support', 'report', 'classification', 'matching', 'analytics', 'operations');
create type prompt_type as enum ('system', 'user', 'classification', 'report', 'tool', 'evaluation');
create type conversation_status as enum ('active', 'closed', 'escalated', 'archived');
create type ai_message_role as enum ('system', 'user', 'assistant', 'tool');
create type job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'retrying');
create type validation_status as enum ('pending', 'valid', 'invalid', 'warning');
create type evaluator_type as enum ('human', 'rule', 'model');
create type approval_request_type as enum ('pricing', 'contract', 'invoice', 'refund', 'report', 'partnership', 'legal', 'support', 'selection', 'other');
create type actor_type as enum ('user', 'agent', 'workflow', 'system', 'integration');
create type approval_status as enum ('pending', 'approved', 'rejected', 'changes_requested', 'expired', 'cancelled');
create type risk_level as enum ('low', 'medium', 'high', 'critical');
create type workflow_engine as enum ('internal', 'n8n');
create type workflow_trigger_type as enum ('event', 'schedule', 'webhook', 'manual');

-- Tables ---------------------------------------------------------------------

create table ai_providers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(160) not null,
  provider_type ai_provider_type not null,
  base_url text,
  is_local boolean not null default false,
  is_active boolean not null default true,
  credentials_secret_ref varchar(255)
);
create trigger set_updated_at before update on ai_providers
  for each row execute function set_updated_at();

create table ai_models (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_id uuid not null references ai_providers(id),
  model_code varchar(160) not null,
  display_name varchar(255) not null,
  model_type ai_model_type not null,
  context_window integer,
  input_cost_per_million numeric(12,6) not null default 0,
  output_cost_per_million numeric(12,6) not null default 0,
  capabilities jsonb not null default '[]'::jsonb,
  status record_status not null default 'active',
  unique (provider_id, model_code)
);
create index ai_models_type_status_idx on ai_models(model_type, status);
create trigger set_updated_at before update on ai_models
  for each row execute function set_updated_at();

create table prompt_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(160) not null,
  name varchar(255) not null,
  version integer not null default 1,
  prompt_type prompt_type not null,
  template_text text not null,
  input_schema jsonb not null default '{}'::jsonb,
  output_schema jsonb not null default '{}'::jsonb,
  language varchar(10) not null default 'en',
  status template_status not null default 'draft',
  created_by uuid not null references users(id),
  unique (code, version)
);
create trigger set_updated_at before update on prompt_templates
  for each row execute function set_updated_at();

create table ai_agents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(120) not null unique,
  name varchar(255) not null,
  description text not null,
  agent_type ai_agent_type not null,
  primary_model_id uuid references ai_models(id),
  fallback_model_id uuid references ai_models(id),
  system_prompt_template_id uuid references prompt_templates(id),
  tool_permissions jsonb not null default '[]'::jsonb,
  requires_human_approval boolean not null default false,
  status record_status not null default 'active'
);
create trigger set_updated_at before update on ai_agents
  for each row execute function set_updated_at();

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  user_id uuid references users(id),
  contact_id uuid references contacts(id),
  agent_id uuid not null references ai_agents(id),
  channel contact_channel not null,
  status conversation_status not null default 'active',
  subject varchar(255),
  context jsonb not null default '{}'::jsonb,
  last_message_at timestamptz
);
create index ai_conversations_user_id_last_message_at_idx on ai_conversations(user_id, last_message_at desc);
create index ai_conversations_contact_id_idx on ai_conversations(contact_id);
create trigger set_updated_at before update on ai_conversations
  for each row execute function set_updated_at();

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role ai_message_role not null,
  content text not null,
  content_json jsonb,
  model_id uuid references ai_models(id),
  token_count integer,
  safety_flags jsonb not null default '[]'::jsonb
);
create index ai_messages_conversation_id_created_at_idx on ai_messages(conversation_id, created_at);
create trigger set_updated_at before update on ai_messages
  for each row execute function set_updated_at();

create table ai_model_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references ai_agents(id),
  model_id uuid not null references ai_models(id),
  prompt_template_id uuid references prompt_templates(id),
  organization_id uuid references organizations(id),
  user_id uuid references users(id),
  purpose varchar(160) not null,
  status job_status not null default 'queued',
  input_hash varchar(128),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer,
  estimated_cost numeric(12,6) not null default 0,
  confidence_score numeric(5,4),
  error_code varchar(120),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_model_runs_status_created_at_idx on ai_model_runs(status, created_at);
create index ai_model_runs_organization_id_created_at_idx on ai_model_runs(organization_id, created_at desc);

create table ai_run_inputs (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references ai_model_runs(id) on delete cascade,
  input_type varchar(80) not null,
  input_data jsonb not null,
  is_redacted boolean not null default true,
  created_at timestamptz not null default now()
);
create index ai_run_inputs_ai_run_id_idx on ai_run_inputs(ai_run_id);

create table ai_run_outputs (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references ai_model_runs(id) on delete cascade,
  output_type varchar(80) not null,
  output_data jsonb not null,
  validation_status validation_status not null,
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index ai_run_outputs_ai_run_id_idx on ai_run_outputs(ai_run_id);

create table ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_run_id uuid not null references ai_model_runs(id) on delete cascade,
  evaluator_type evaluator_type not null,
  evaluator_user_id uuid references users(id),
  score numeric(5,2) not null,
  criteria_scores jsonb not null default '{}'::jsonb,
  comments text
);
create index ai_evaluations_ai_run_id_idx on ai_evaluations(ai_run_id);
create trigger set_updated_at before update on ai_evaluations
  for each row execute function set_updated_at();

create table agent_tool_executions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ai_run_id uuid not null references ai_model_runs(id) on delete cascade,
  tool_name varchar(160) not null,
  input_parameters jsonb not null,
  output_result jsonb,
  status job_status not null,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);
create index agent_tool_executions_ai_run_id_idx on agent_tool_executions(ai_run_id);
create index agent_tool_executions_tool_name_status_idx on agent_tool_executions(tool_name, status);
create trigger set_updated_at before update on agent_tool_executions
  for each row execute function set_updated_at();

create table human_approval_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  request_type approval_request_type not null,
  reference_type varchar(100) not null,
  -- Polymorphic reference (row id in whatever table reference_type names);
  -- no FK, same pattern as credit_ledger_entries.reference_id.
  reference_id uuid not null,
  requested_by_type actor_type not null,
  requested_by_id uuid,
  assigned_to uuid references users(id),
  status approval_status not null default 'pending',
  risk_level risk_level not null default 'medium',
  request_payload jsonb not null,
  decision_notes text,
  decided_by uuid references users(id),
  decided_at timestamptz,
  expires_at timestamptz
);
create index human_approval_requests_status_risk_created_idx on human_approval_requests(status, risk_level, created_at);
create trigger set_updated_at before update on human_approval_requests
  for each row execute function set_updated_at();

create table workflows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(120) not null unique,
  name varchar(255) not null,
  workflow_engine workflow_engine not null,
  external_workflow_id varchar(255),
  trigger_type workflow_trigger_type not null,
  definition jsonb not null default '{}'::jsonb,
  status record_status not null default 'active',
  version integer not null default 1
);
create trigger set_updated_at before update on workflows
  for each row execute function set_updated_at();

create table workflow_executions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references workflows(id),
  external_execution_id varchar(255),
  status job_status not null,
  trigger_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  started_at timestamptz not null,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index workflow_executions_workflow_id_started_at_idx on workflow_executions(workflow_id, started_at desc);
create index workflow_executions_status_idx on workflow_executions(status);

create table workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_execution_id uuid not null references workflow_executions(id) on delete cascade,
  step_key varchar(160) not null,
  step_name varchar(255) not null,
  status job_status not null,
  input_data jsonb,
  output_data jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);
create index workflow_steps_workflow_execution_id_idx on workflow_steps(workflow_execution_id);

create table scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(120) not null unique,
  job_type varchar(120) not null,
  cron_expression varchar(120) not null,
  timezone varchar(64) not null default 'UTC',
  payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz
);
create index scheduled_jobs_is_active_next_run_at_idx on scheduled_jobs(is_active, next_run_at);
create trigger set_updated_at before update on scheduled_jobs
  for each row execute function set_updated_at();

create table background_jobs (
  id uuid primary key default gen_random_uuid(),
  queue_name varchar(120) not null,
  job_name varchar(160) not null,
  external_job_id varchar(255),
  status job_status not null,
  priority integer not null default 0,
  payload jsonb not null,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index background_jobs_queue_status_priority_idx on background_jobs(queue_name, status, priority desc);
create index background_jobs_scheduled_at_idx on background_jobs(scheduled_at);

create table domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type varchar(160) not null,
  aggregate_type varchar(120) not null,
  -- Polymorphic reference (row id in whatever table aggregate_type names);
  -- no FK, same pattern as human_approval_requests.reference_id.
  aggregate_id uuid not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  published_at timestamptz,
  publish_attempts integer not null default 0,
  correlation_id uuid,
  causation_id uuid
);
create index domain_events_published_occurred_idx on domain_events(published_at, occurred_at);
create index domain_events_aggregate_type_id_idx on domain_events(aggregate_type, aggregate_id);

-- Row Level Security ----------------------------------------------------------

create or replace function can_access_ai_conversation(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from ai_conversations
    where id = p_conversation_id
      and (
        user_id = auth.uid()
        or is_organization_member(organization_id)
        or can_access_contact(contact_id)
      )
  );
$$;

create or replace function can_access_ai_model_run(p_ai_run_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from ai_model_runs
    where id = p_ai_run_id
      and (user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

alter table ai_providers enable row level security;
alter table ai_models enable row level security;
alter table prompt_templates enable row level security;
alter table ai_agents enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_model_runs enable row level security;
alter table ai_run_inputs enable row level security;
alter table ai_run_outputs enable row level security;
alter table ai_evaluations enable row level security;
alter table agent_tool_executions enable row level security;
alter table human_approval_requests enable row level security;
alter table workflows enable row level security;
alter table workflow_executions enable row level security;
alter table workflow_steps enable row level security;
alter table scheduled_jobs enable row level security;
alter table background_jobs enable row level security;
alter table domain_events enable row level security;

-- ai_providers / ai_models / ai_agents: system configuration, centrally
-- managed. Readable by any authenticated user (the app needs to resolve
-- "which model/agent to use"), writes service-role only.
create policy ai_providers_select_authenticated on ai_providers for select
  to authenticated using (true);
create policy ai_models_select_authenticated on ai_models for select
  to authenticated using (true);
create policy ai_agents_select_authenticated on ai_agents for select
  to authenticated using (true);

-- prompt_templates: shared assets, same treatment as message_templates in
-- migration 0005 — readable by all, writable only by the creator.
create policy prompt_templates_select_authenticated on prompt_templates for select
  to authenticated using (true);
create policy prompt_templates_insert_owner on prompt_templates for insert
  with check (created_by = auth.uid());
create policy prompt_templates_update_owner on prompt_templates for update
  using (created_by = auth.uid());

-- ai_conversations / ai_messages: a user's own chat history with an agent
-- (or a contact's, before they have an account) — visible to them, org
-- members, or via contact ownership.
create policy ai_conversations_access on ai_conversations for select
  using (
    user_id = auth.uid()
    or is_organization_member(organization_id)
    or can_access_contact(contact_id)
  );
create policy ai_conversations_insert_owner on ai_conversations for insert
  with check (user_id = auth.uid());

create policy ai_messages_access on ai_messages for select
  using (can_access_ai_conversation(conversation_id));
create policy ai_messages_insert on ai_messages for insert
  with check (can_access_ai_conversation(conversation_id));

-- ai_model_runs and everything under it (inputs/outputs/evaluations/tool
-- executions): the AI cost & audit trail. View-only for the owning
-- user/org — rows are written exclusively by backend AI-calling code
-- (e.g. lib/ai/groq.ts) via the service role, never direct client inserts.
create policy ai_model_runs_select_access on ai_model_runs for select
  using (user_id = auth.uid() or is_organization_member(organization_id));

create policy ai_run_inputs_select_access on ai_run_inputs for select
  using (can_access_ai_model_run(ai_run_id));
create policy ai_run_outputs_select_access on ai_run_outputs for select
  using (can_access_ai_model_run(ai_run_id));
create policy ai_evaluations_select_access on ai_evaluations for select
  using (can_access_ai_model_run(ai_run_id));
create policy agent_tool_executions_select_access on agent_tool_executions for select
  using (can_access_ai_model_run(ai_run_id));

-- human_approval_requests: an internal staff review queue. Visible to
-- whoever it's assigned to or who decided it; created by backend workflows
-- when a sensitive action needs a human in the loop, not by direct client
-- insert.
create policy human_approval_requests_select_access on human_approval_requests for select
  using (assigned_to = auth.uid() or decided_by = auth.uid());

-- workflows: internal automation registry (n8n/internal workflow
-- definitions). Readable by authenticated users for visibility into what
-- automations exist; writes service-role only.
create policy workflows_select_authenticated on workflows for select
  to authenticated using (true);

-- workflow_executions / workflow_steps / scheduled_jobs / background_jobs /
-- domain_events: operational infrastructure with no per-user ownership
-- concept, and execution payloads may carry sensitive data depending on the
-- workflow. No client-facing policies — service role / internal tooling
-- only, same treatment as api_keys and payment_webhook_events.

-- Backfill the FKs deferred from earlier modules now that ai_model_runs exists.
alter table lead_scores
  add constraint lead_scores_ai_run_id_fkey
  foreign key (ai_run_id) references ai_model_runs(id);

alter table inbound_messages
  add constraint inbound_messages_ai_run_id_fkey
  foreign key (ai_run_id) references ai_model_runs(id);
