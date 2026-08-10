-- Support & Engagement module: support tickets, the knowledge base,
-- appointment scheduling, and notifications.
--
-- No foreign keys are deferred in this module — everything it references
-- (organizations, users, contacts, ai_model_runs) already exists.

-- Enums --------------------------------------------------------------------

create type support_category as enum ('technical', 'billing', 'report', 'account', 'fellowship', 'partner', 'complaint', 'other');
create type ticket_status as enum ('open', 'pending_customer', 'pending_internal', 'resolved', 'closed');
create type article_status as enum ('draft', 'published', 'archived');
create type appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled');
create type notification_status as enum ('queued', 'sent', 'delivered', 'failed', 'read', 'cancelled');
create type digest_frequency as enum ('immediate', 'hourly', 'daily', 'weekly', 'disabled');

-- Tables ---------------------------------------------------------------------

create table support_categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(160) not null,
  description text,
  default_priority priority_level not null default 'medium',
  default_assignee_id uuid references users(id),
  is_active boolean not null default true
);
create trigger set_updated_at before update on support_categories
  for each row execute function set_updated_at();

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ticket_number varchar(40) not null unique,
  organization_id uuid references organizations(id),
  requester_user_id uuid references users(id),
  contact_id uuid references contacts(id),
  assigned_to uuid references users(id),
  channel contact_channel not null,
  category support_category not null,
  priority priority_level not null default 'medium',
  status ticket_status not null default 'open',
  subject varchar(500) not null,
  description text not null,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  sla_due_at timestamptz
);
create index support_tickets_status_priority_sla_idx on support_tickets(status, priority, sla_due_at);
create trigger set_updated_at before update on support_tickets
  for each row execute function set_updated_at();

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_type actor_type not null,
  sender_user_id uuid references users(id),
  body text not null,
  is_internal_note boolean not null default false,
  ai_run_id uuid references ai_model_runs(id),
  file_ids jsonb not null default '[]'::jsonb
);
create index support_messages_ticket_id_created_at_idx on support_messages(ticket_id, created_at);
create trigger set_updated_at before update on support_messages
  for each row execute function set_updated_at();

create table knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug citext not null unique,
  title varchar(500) not null,
  summary text,
  body text not null,
  status article_status not null default 'draft',
  language varchar(10) not null default 'en',
  author_user_id uuid not null references users(id),
  published_at timestamptz
);
create index knowledge_base_articles_status_published_at_idx on knowledge_base_articles(status, published_at);
create trigger set_updated_at before update on knowledge_base_articles
  for each row execute function set_updated_at();

create table appointment_types (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(255) not null,
  description text,
  duration_minutes integer not null,
  buffer_before_minutes integer not null default 0,
  buffer_after_minutes integer not null default 0,
  is_active boolean not null default true
);
create trigger set_updated_at before update on appointment_types
  for each row execute function set_updated_at();

create table appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  contact_id uuid references contacts(id),
  host_user_id uuid not null references users(id),
  appointment_type_id uuid not null references appointment_types(id),
  status appointment_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone varchar(64) not null,
  meeting_url text,
  external_event_id varchar(255),
  notes text
);
create index appointments_host_user_id_starts_at_idx on appointments(host_user_id, starts_at);
create index appointments_status_starts_at_idx on appointments(status, starts_at);
create trigger set_updated_at before update on appointments
  for each row execute function set_updated_at();

create table notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references users(id),
  organization_id uuid references organizations(id),
  notification_type varchar(120) not null,
  channel contact_channel not null,
  title varchar(255) not null,
  body text not null,
  status notification_status not null default 'queued',
  scheduled_at timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  action_url text,
  metadata jsonb not null default '{}'::jsonb
);
create index notifications_user_id_read_at_created_at_idx on notifications(user_id, read_at, created_at desc);
create index notifications_status_scheduled_at_idx on notifications(status, scheduled_at);
create trigger set_updated_at before update on notifications
  for each row execute function set_updated_at();

create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null unique references users(id),
  email_enabled boolean not null default true,
  whatsapp_enabled boolean not null default false,
  telegram_enabled boolean not null default false,
  in_app_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  digest_frequency digest_frequency not null default 'immediate'
);
create trigger set_updated_at before update on notification_preferences
  for each row execute function set_updated_at();

-- Row Level Security ----------------------------------------------------------

create or replace function can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from support_tickets
    where id = p_ticket_id
      and (
        requester_user_id = auth.uid()
        or is_organization_member(organization_id)
        or assigned_to = auth.uid()
      )
  );
$$;

create or replace function is_ticket_staff(p_ticket_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from support_tickets
    where id = p_ticket_id and assigned_to = auth.uid()
  );
$$;

alter table support_categories enable row level security;
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table knowledge_base_articles enable row level security;
alter table appointment_types enable row level security;
alter table appointments enable row level security;
alter table notifications enable row level security;
alter table notification_preferences enable row level security;

-- support_categories / appointment_types: reference config. Readable by
-- any authenticated user; writes service-role only.
create policy support_categories_select_authenticated on support_categories for select
  to authenticated using (true);
create policy appointment_types_select_authenticated on appointment_types for select
  to authenticated using (true);

-- support_tickets: visible to the requester, their org, or the assigned
-- staff member. A user opens their own ticket directly.
create policy support_tickets_select_access on support_tickets for select
  using (requester_user_id = auth.uid() or is_organization_member(organization_id) or assigned_to = auth.uid());
create policy support_tickets_insert_owner on support_tickets for insert
  with check (requester_user_id = auth.uid());
create policy support_tickets_update_access on support_tickets for update
  using (requester_user_id = auth.uid() or is_organization_member(organization_id) or assigned_to = auth.uid());

-- support_messages: internal notes are staff-only (hidden from the
-- customer who filed the ticket) — everything else is visible to anyone
-- who can see the ticket.
create policy support_messages_select_access on support_messages for select
  using (can_access_ticket(ticket_id) and (not is_internal_note or is_ticket_staff(ticket_id)));
create policy support_messages_insert on support_messages for insert
  with check (can_access_ticket(ticket_id));

-- knowledge_base_articles: published articles are public help content;
-- authors can also see their own drafts.
create policy knowledge_base_articles_select_access on knowledge_base_articles for select
  to authenticated using (status = 'published' or author_user_id = auth.uid());
create policy knowledge_base_articles_insert_owner on knowledge_base_articles for insert
  with check (author_user_id = auth.uid());
create policy knowledge_base_articles_update_owner on knowledge_base_articles for update
  using (author_user_id = auth.uid());

-- appointments: visible to the host, the booking contact/org. Booked by
-- whoever will host it or on behalf of their own org/contact.
create policy appointments_select_access on appointments for select
  using (
    host_user_id = auth.uid()
    or is_organization_member(organization_id)
    or can_access_contact(contact_id)
  );
create policy appointments_insert on appointments for insert
  with check (
    host_user_id = auth.uid()
    or is_organization_member(organization_id)
    or can_access_contact(contact_id)
  );
create policy appointments_update_access on appointments for update
  using (
    host_user_id = auth.uid()
    or is_organization_member(organization_id)
    or can_access_contact(contact_id)
  );

-- notifications: a user's own notifications, plus org-wide ones. Users can
-- mark their own as read; creation is system-generated (service role) only.
create policy notifications_select_access on notifications for select
  using (user_id = auth.uid() or is_organization_member(organization_id));
create policy notifications_update_self on notifications for update
  using (user_id = auth.uid());

-- notification_preferences: a user's own settings.
create policy notification_preferences_select_self on notification_preferences for select
  using (user_id = auth.uid());
create policy notification_preferences_insert_self on notification_preferences for insert
  with check (user_id = auth.uid());
create policy notification_preferences_update_self on notification_preferences for update
  using (user_id = auth.uid());
