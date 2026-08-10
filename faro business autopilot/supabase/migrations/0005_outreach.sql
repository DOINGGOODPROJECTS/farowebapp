-- Outreach module: campaigns, templates, outbound/inbound messages, and the
-- connected sending accounts (email/WhatsApp/Telegram) that back them.
--
-- One foreign key from the spec is deferred until its target module exists,
-- same pattern used in migrations 0002/0003:
--   inbound_messages.ai_run_id -> ai_model_runs.id  (AI & Automation module)

-- Enums --------------------------------------------------------------------

create type campaign_type as enum ('cold_outreach', 'nurture', 'newsletter', 'transactional', 'event', 'renewal');
create type campaign_status as enum ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');
create type campaign_member_status as enum ('queued', 'active', 'replied', 'converted', 'completed', 'suppressed', 'failed');
create type template_status as enum ('draft', 'active', 'archived');
create type message_status as enum ('queued', 'scheduled', 'sent', 'delivered', 'failed', 'bounced', 'cancelled');
create type reply_classification as enum ('positive', 'negative', 'question', 'not_now', 'unsubscribe', 'out_of_office', 'spam', 'unknown');
create type message_event_type as enum ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'unsubscribed');
create type suppression_reason as enum ('unsubscribed', 'hard_bounce', 'complaint', 'manual', 'legal', 'duplicate');
create type connection_status as enum ('active', 'inactive', 'connected', 'disconnected', 'error', 'revoked');

-- Tables ---------------------------------------------------------------------

create table message_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name varchar(255) not null,
  channel contact_channel not null,
  language varchar(10) not null default 'en',
  subject_template text,
  body_template text not null,
  variables_schema jsonb not null default '{}'::jsonb,
  status template_status not null default 'draft',
  created_by uuid not null references users(id)
);
create index message_templates_channel_status_idx on message_templates(channel, status);
create trigger set_updated_at before update on message_templates
  for each row execute function set_updated_at();

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  created_by uuid not null references users(id),
  name varchar(255) not null,
  campaign_type campaign_type not null,
  status campaign_status not null default 'draft',
  objective text,
  start_at timestamptz,
  end_at timestamptz,
  timezone varchar(64) not null default 'UTC',
  settings jsonb not null default '{}'::jsonb
);
create index campaigns_status_start_at_idx on campaigns(status, start_at);
create trigger set_updated_at before update on campaigns
  for each row execute function set_updated_at();

create table campaign_audiences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  name varchar(255) not null,
  filter_definition jsonb not null,
  estimated_size integer,
  last_refreshed_at timestamptz
);
create index campaign_audiences_campaign_id_idx on campaign_audiences(campaign_id);
create trigger set_updated_at before update on campaign_audiences
  for each row execute function set_updated_at();

create table campaign_steps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  step_number integer not null,
  channel contact_channel not null,
  delay_minutes integer not null default 0,
  template_id uuid references message_templates(id),
  action_config jsonb not null default '{}'::jsonb,
  unique (campaign_id, step_number)
);
create trigger set_updated_at before update on campaign_steps
  for each row execute function set_updated_at();

create table campaign_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id),
  lead_id uuid references leads(id),
  status campaign_member_status not null default 'queued',
  current_step integer not null default 0,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  suppressed_reason text,
  unique (campaign_id, contact_id)
);
create index campaign_members_status_idx on campaign_members(status);
create trigger set_updated_at before update on campaign_members
  for each row execute function set_updated_at();

create table outbound_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  campaign_id uuid references campaigns(id),
  campaign_member_id uuid references campaign_members(id),
  contact_id uuid references contacts(id),
  lead_id uuid references leads(id),
  channel contact_channel not null,
  recipient varchar(255) not null,
  subject text,
  body text not null,
  status message_status not null default 'queued',
  provider varchar(120),
  provider_message_id varchar(255),
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb
);
create index outbound_messages_status_scheduled_at_idx on outbound_messages(status, scheduled_at);
create index outbound_messages_contact_id_created_at_idx on outbound_messages(contact_id, created_at desc);
create trigger set_updated_at before update on outbound_messages
  for each row execute function set_updated_at();

create table inbound_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  contact_id uuid references contacts(id),
  lead_id uuid references leads(id),
  channel contact_channel not null,
  sender varchar(255) not null,
  recipient varchar(255) not null,
  subject text,
  body text not null,
  provider varchar(120),
  provider_message_id varchar(255),
  received_at timestamptz not null,
  classification reply_classification,
  classification_confidence numeric(5,4),
  -- Will reference ai_model_runs.id once the AI & Automation module exists.
  ai_run_id uuid,
  processed_at timestamptz,
  unique (provider, provider_message_id)
);
create index inbound_messages_lead_id_received_at_idx on inbound_messages(lead_id, received_at desc);
create trigger set_updated_at before update on inbound_messages
  for each row execute function set_updated_at();

create table message_events (
  id uuid primary key default gen_random_uuid(),
  outbound_message_id uuid not null references outbound_messages(id) on delete cascade,
  event_type message_event_type not null,
  occurred_at timestamptz not null,
  provider_event_id varchar(255) unique,
  event_payload jsonb not null default '{}'::jsonb
);
create index message_events_outbound_message_id_occurred_at_idx on message_events(outbound_message_id, occurred_at);

create table suppression_list (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  channel contact_channel not null,
  value_hash text not null,
  display_value_masked varchar(255) not null,
  reason suppression_reason not null,
  source varchar(120),
  expires_at timestamptz,
  unique (channel, value_hash)
);
create trigger set_updated_at before update on suppression_list
  for each row execute function set_updated_at();

create table email_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  email_address citext not null unique,
  display_name varchar(160),
  smtp_host varchar(255) not null,
  smtp_port integer not null,
  smtp_username varchar(255) not null,
  smtp_password_encrypted text not null,
  imap_host varchar(255),
  imap_port integer,
  status connection_status not null default 'active',
  daily_send_limit integer not null default 100
);
create trigger set_updated_at before update on email_accounts
  for each row execute function set_updated_at();

create table whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  session_name varchar(120) not null unique,
  phone_number varchar(40),
  status connection_status not null default 'disconnected',
  auth_data_path text not null,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz
);
create trigger set_updated_at before update on whatsapp_sessions
  for each row execute function set_updated_at();

create table telegram_bots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  bot_name varchar(160) not null,
  bot_username varchar(160) not null unique,
  bot_token_encrypted text not null,
  status connection_status not null default 'active'
);
create trigger set_updated_at before update on telegram_bots
  for each row execute function set_updated_at();

-- Row Level Security ----------------------------------------------------------

create or replace function can_access_campaign(p_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from campaigns
    where id = p_campaign_id
      and (created_by = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_outbound_message(p_outbound_message_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from outbound_messages
    where id = p_outbound_message_id
      and (
        can_access_campaign(campaign_id)
        or can_access_contact(contact_id)
        or can_access_lead(lead_id)
      )
  );
$$;

alter table message_templates enable row level security;
alter table campaigns enable row level security;
alter table campaign_audiences enable row level security;
alter table campaign_steps enable row level security;
alter table campaign_members enable row level security;
alter table outbound_messages enable row level security;
alter table inbound_messages enable row level security;
alter table message_events enable row level security;
alter table suppression_list enable row level security;
alter table email_accounts enable row level security;
alter table whatsapp_sessions enable row level security;
alter table telegram_bots enable row level security;

-- message_templates: shared reusable assets, readable by any authenticated
-- user; only the creator can modify their own.
create policy message_templates_select_authenticated on message_templates for select
  to authenticated using (true);
create policy message_templates_insert_owner on message_templates for insert
  with check (created_by = auth.uid());
create policy message_templates_update_owner on message_templates for update
  using (created_by = auth.uid());

create policy campaigns_select_access on campaigns for select
  using (created_by = auth.uid() or is_organization_member(organization_id));
create policy campaigns_insert_owner on campaigns for insert
  with check (created_by = auth.uid());
create policy campaigns_update_access on campaigns for update
  using (created_by = auth.uid() or is_organization_member(organization_id));

create policy campaign_audiences_access on campaign_audiences for select
  using (can_access_campaign(campaign_id));
create policy campaign_audiences_insert on campaign_audiences for insert
  with check (can_access_campaign(campaign_id));
create policy campaign_audiences_update on campaign_audiences for update
  using (can_access_campaign(campaign_id));

create policy campaign_steps_access on campaign_steps for select
  using (can_access_campaign(campaign_id));
create policy campaign_steps_insert on campaign_steps for insert
  with check (can_access_campaign(campaign_id));
create policy campaign_steps_update on campaign_steps for update
  using (can_access_campaign(campaign_id));

create policy campaign_members_access on campaign_members for select
  using (can_access_campaign(campaign_id));
create policy campaign_members_insert on campaign_members for insert
  with check (can_access_campaign(campaign_id));
create policy campaign_members_update on campaign_members for update
  using (can_access_campaign(campaign_id));

-- outbound_messages: campaign_id, contact_id and lead_id are all nullable
-- (a message doesn't have to belong to a campaign), so access is granted if
-- any one of the three links the caller to it.
create policy outbound_messages_access on outbound_messages for select
  using (
    can_access_campaign(campaign_id)
    or can_access_contact(contact_id)
    or can_access_lead(lead_id)
  );
create policy outbound_messages_insert on outbound_messages for insert
  with check (
    can_access_campaign(campaign_id)
    or can_access_contact(contact_id)
    or can_access_lead(lead_id)
  );
create policy outbound_messages_update on outbound_messages for update
  using (
    can_access_campaign(campaign_id)
    or can_access_contact(contact_id)
    or can_access_lead(lead_id)
  );

create policy inbound_messages_access on inbound_messages for select
  using (can_access_contact(contact_id) or can_access_lead(lead_id));
create policy inbound_messages_insert on inbound_messages for insert
  with check (can_access_contact(contact_id) or can_access_lead(lead_id));

create policy message_events_access on message_events for select
  using (can_access_outbound_message(outbound_message_id));
create policy message_events_insert on message_events for insert
  with check (can_access_outbound_message(outbound_message_id));

-- suppression_list: a global compliance registry (who has opted out or
-- bounced) — authenticated users can check it, writes are service-role only
-- so client code can't accidentally remove someone from it.
create policy suppression_list_select_authenticated on suppression_list for select
  to authenticated using (true);

-- email_accounts / whatsapp_sessions / telegram_bots: hold encrypted
-- credentials (SMTP passwords, WhatsApp auth data, bot tokens). Same
-- treatment as api_keys in migration 0002 — no client-facing policies;
-- only the service role can read or write these, via a server-side
-- connection-management endpoint.
