-- CRM module: contacts, leads, deals, and the tables that support them.
--
-- Two foreign keys from the spec are deferred until their target modules
-- exist, same pattern as user_profiles.avatar_file_id in migration 0002:
--   deal_products.product_id -> products.id      (Commerce module)
--   lead_scores.ai_run_id    -> ai_model_runs.id  (AI & Automation module)
-- Both are left as plain uuid columns with no FK for now.

-- Enums --------------------------------------------------------------------

create type contact_status as enum ('active', 'inactive', 'bounced', 'unsubscribed');
create type consent_status as enum ('unknown', 'granted', 'withdrawn', 'not_required');
create type lead_source_type as enum ('website', 'referral', 'event', 'directory', 'csv', 'government_data', 'partner', 'manual', 'other');
create type lead_type as enum ('customer', 'partner', 'fellowship', 'funder', 'supplier', 'other');
create type lead_status as enum ('new', 'working', 'qualified', 'nurturing', 'converted', 'disqualified', 'archived');
create type lead_stage as enum ('captured', 'enriched', 'scored', 'contacted', 'engaged', 'proposal', 'negotiation', 'won', 'lost');
create type priority_level as enum ('low', 'medium', 'high', 'urgent');
create type crm_activity_type as enum ('call', 'email', 'meeting', 'message', 'note', 'task', 'status_change', 'other');
create type note_visibility as enum ('internal', 'team', 'private');
create type deal_stage as enum ('prospecting', 'qualification', 'proposal', 'negotiation', 'contract', 'closed_won', 'closed_lost');
create type deal_status as enum ('open', 'won', 'lost', 'cancelled');
create type task_type as enum ('call', 'email', 'follow_up', 'meeting', 'review', 'research', 'other');
create type task_status as enum ('open', 'in_progress', 'completed', 'cancelled');

-- Tables ---------------------------------------------------------------------

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(160) not null,
  source_type lead_source_type not null,
  description text,
  is_active boolean not null default true
);
create trigger set_updated_at before update on lead_sources
  for each row execute function set_updated_at();

create table contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  owner_user_id uuid references users(id),
  first_name varchar(120) not null,
  last_name varchar(120) not null,
  email citext,
  phone varchar(40),
  job_title varchar(160),
  country_code char(2),
  contact_status contact_status not null default 'active',
  source_id uuid references lead_sources(id),
  consent_status consent_status not null default 'unknown',
  do_not_contact boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz
);
create index contacts_email_idx on contacts(email);
create index contacts_organization_id_idx on contacts(organization_id);
create index contacts_owner_user_id_idx on contacts(owner_user_id);
create trigger set_updated_at before update on contacts
  for each row execute function set_updated_at();

create table contact_channels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_id uuid not null references contacts(id) on delete cascade,
  channel_type contact_channel not null,
  channel_value varchar(255) not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  verification_date timestamptz,
  unique (contact_id, channel_type, channel_value)
);
create trigger set_updated_at before update on contact_channels
  for each row execute function set_updated_at();

create table contact_preferences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_id uuid not null unique references contacts(id) on delete cascade,
  email_opt_in boolean not null default false,
  sms_opt_in boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  telegram_opt_in boolean not null default false,
  preferred_language varchar(10) not null default 'en',
  preferred_timezone varchar(64) not null default 'UTC',
  unsubscribe_reason text,
  updated_by uuid references users(id)
);
create trigger set_updated_at before update on contact_preferences
  for each row execute function set_updated_at();

create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  contact_id uuid references contacts(id),
  owner_user_id uuid references users(id),
  source_id uuid references lead_sources(id),
  lead_type lead_type not null,
  status lead_status not null default 'new',
  stage lead_stage not null default 'captured',
  title varchar(255) not null,
  description text,
  estimated_value numeric(14,2),
  currency char(3) not null default 'USD',
  score numeric(5,2) not null default 0,
  priority priority_level not null default 'medium',
  qualified_at timestamptz,
  disqualified_reason text,
  next_follow_up_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz
);
create index leads_status_stage_idx on leads(status, stage);
create index leads_owner_user_id_idx on leads(owner_user_id);
create index leads_score_idx on leads(score desc);
create index leads_next_follow_up_at_idx on leads(next_follow_up_at);
create trigger set_updated_at before update on leads
  for each row execute function set_updated_at();

create table lead_scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id) on delete cascade,
  score numeric(5,2) not null,
  scoring_model varchar(120) not null,
  factors jsonb not null,
  confidence numeric(5,4),
  -- Will reference ai_model_runs.id once the AI & Automation module exists.
  ai_run_id uuid,
  scored_by uuid references users(id)
);
create index lead_scores_lead_id_created_at_idx on lead_scores(lead_id, created_at desc);
create trigger set_updated_at before update on lead_scores
  for each row execute function set_updated_at();

create table lead_activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id) on delete cascade,
  activity_type crm_activity_type not null,
  subject varchar(255) not null,
  description text,
  performed_by uuid references users(id),
  occurred_at timestamptz not null default now(),
  external_reference varchar(255),
  metadata jsonb not null default '{}'::jsonb
);
create index lead_activities_lead_id_occurred_at_idx on lead_activities(lead_id, occurred_at desc);
create trigger set_updated_at before update on lead_activities
  for each row execute function set_updated_at();

create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id) on delete cascade,
  author_user_id uuid not null references users(id),
  note_text text not null,
  is_pinned boolean not null default false,
  visibility note_visibility not null default 'internal'
);
create index lead_notes_lead_id_created_at_idx on lead_notes(lead_id, created_at desc);
create trigger set_updated_at before update on lead_notes
  for each row execute function set_updated_at();

create table lead_assignments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references leads(id) on delete cascade,
  assigned_to uuid not null references users(id),
  assigned_by uuid references users(id),
  assigned_at timestamptz not null default now(),
  unassigned_at timestamptz,
  reason text
);
create index lead_assignments_lead_id_idx on lead_assignments(lead_id);
create index lead_assignments_assigned_to_idx on lead_assignments(assigned_to, unassigned_at);
create trigger set_updated_at before update on lead_assignments
  for each row execute function set_updated_at();

create table deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  primary_contact_id uuid references contacts(id),
  lead_id uuid references leads(id),
  owner_user_id uuid references users(id),
  name varchar(255) not null,
  stage deal_stage not null default 'prospecting',
  status deal_status not null default 'open',
  amount numeric(14,2),
  currency char(3) not null default 'USD',
  probability numeric(5,2) not null default 0,
  expected_close_date date,
  closed_at timestamptz,
  lost_reason text
);
create index deals_stage_status_idx on deals(stage, status);
create index deals_owner_user_id_idx on deals(owner_user_id);
create index deals_expected_close_date_idx on deals(expected_close_date);
create trigger set_updated_at before update on deals
  for each row execute function set_updated_at();

create table deal_products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  -- Will reference products.id once the Commerce module exists.
  product_id uuid not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  unique (deal_id, product_id)
);
create trigger set_updated_at before update on deal_products
  for each row execute function set_updated_at();

create table deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deal_id uuid not null references deals(id) on delete cascade,
  from_stage deal_stage,
  to_stage deal_stage not null,
  changed_by uuid references users(id),
  changed_at timestamptz not null default now(),
  notes text
);
create index deal_stage_history_deal_id_changed_at_idx on deal_stage_history(deal_id, changed_at desc);
create trigger set_updated_at before update on deal_stage_history
  for each row execute function set_updated_at();

create table crm_tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  lead_id uuid references leads(id),
  deal_id uuid references deals(id),
  contact_id uuid references contacts(id),
  assigned_to uuid not null references users(id),
  created_by uuid not null references users(id),
  task_type task_type not null,
  title varchar(255) not null,
  description text,
  status task_status not null default 'open',
  priority priority_level not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz
);
create index crm_tasks_assigned_to_status_due_at_idx on crm_tasks(assigned_to, status, due_at);
create trigger set_updated_at before update on crm_tasks
  for each row execute function set_updated_at();

-- Row Level Security ----------------------------------------------------------

-- Access to a lead/deal/contact is granted to its owner, or to anyone
-- belonging to the organization it's linked to (reusing is_organization_member
-- from migration 0002). Child/detail tables check access through their
-- parent via these SECURITY DEFINER helpers, same reasoning as
-- is_organization_member/is_organization_owner: avoids re-triggering RLS
-- on the parent table from inside a child table's policy.
create or replace function can_access_lead(p_lead_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from leads
    where id = p_lead_id
      and (owner_user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_deal(p_deal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from deals
    where id = p_deal_id
      and (owner_user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_contact(p_contact_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from contacts
    where id = p_contact_id
      and (owner_user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

alter table lead_sources enable row level security;
alter table contacts enable row level security;
alter table contact_channels enable row level security;
alter table contact_preferences enable row level security;
alter table leads enable row level security;
alter table lead_scores enable row level security;
alter table lead_activities enable row level security;
alter table lead_notes enable row level security;
alter table lead_assignments enable row level security;
alter table deals enable row level security;
alter table deal_products enable row level security;
alter table deal_stage_history enable row level security;
alter table crm_tasks enable row level security;

-- lead_sources: reference data, readable by any authenticated user, writes
-- are service-role only.
create policy lead_sources_select_authenticated on lead_sources for select
  to authenticated using (true);

create policy contacts_select_access on contacts for select
  using (owner_user_id = auth.uid() or is_organization_member(organization_id));
create policy contacts_insert_owner on contacts for insert
  with check (owner_user_id = auth.uid());
create policy contacts_update_access on contacts for update
  using (owner_user_id = auth.uid() or is_organization_member(organization_id));

create policy contact_channels_access on contact_channels for select
  using (can_access_contact(contact_id));
create policy contact_channels_insert on contact_channels for insert
  with check (can_access_contact(contact_id));
create policy contact_channels_update on contact_channels for update
  using (can_access_contact(contact_id));

create policy contact_preferences_access on contact_preferences for select
  using (can_access_contact(contact_id));
create policy contact_preferences_insert on contact_preferences for insert
  with check (can_access_contact(contact_id));
create policy contact_preferences_update on contact_preferences for update
  using (can_access_contact(contact_id));

create policy leads_select_access on leads for select
  using (owner_user_id = auth.uid() or is_organization_member(organization_id));
create policy leads_insert_owner on leads for insert
  with check (owner_user_id = auth.uid());
create policy leads_update_access on leads for update
  using (owner_user_id = auth.uid() or is_organization_member(organization_id));

create policy lead_scores_access on lead_scores for select
  using (can_access_lead(lead_id));
create policy lead_scores_insert on lead_scores for insert
  with check (can_access_lead(lead_id));

create policy lead_activities_access on lead_activities for select
  using (can_access_lead(lead_id));
create policy lead_activities_insert on lead_activities for insert
  with check (can_access_lead(lead_id));

create policy lead_notes_access on lead_notes for select
  using (can_access_lead(lead_id));
create policy lead_notes_insert on lead_notes for insert
  with check (can_access_lead(lead_id));

create policy lead_assignments_access on lead_assignments for select
  using (can_access_lead(lead_id) or assigned_to = auth.uid());
create policy lead_assignments_insert on lead_assignments for insert
  with check (can_access_lead(lead_id));

create policy deals_select_access on deals for select
  using (owner_user_id = auth.uid() or is_organization_member(organization_id));
create policy deals_insert_owner on deals for insert
  with check (owner_user_id = auth.uid());
create policy deals_update_access on deals for update
  using (owner_user_id = auth.uid() or is_organization_member(organization_id));

create policy deal_products_access on deal_products for select
  using (can_access_deal(deal_id));
create policy deal_products_insert on deal_products for insert
  with check (can_access_deal(deal_id));
create policy deal_products_update on deal_products for update
  using (can_access_deal(deal_id));

create policy deal_stage_history_access on deal_stage_history for select
  using (can_access_deal(deal_id));
create policy deal_stage_history_insert on deal_stage_history for insert
  with check (can_access_deal(deal_id));

create policy crm_tasks_access on crm_tasks for select
  using (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or is_organization_member(organization_id)
  );
create policy crm_tasks_insert on crm_tasks for insert
  with check (created_by = auth.uid());
create policy crm_tasks_update on crm_tasks for update
  using (
    assigned_to = auth.uid()
    or created_by = auth.uid()
    or is_organization_member(organization_id)
  );
