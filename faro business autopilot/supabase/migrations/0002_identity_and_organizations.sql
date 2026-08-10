-- Identity & Access + Organizations modules.
--
-- Deviates from the FARO_Autopilot_Complete_Database_Schema.xlsx spec in one way:
-- authentication is delegated to Supabase Auth (auth.users) instead of the
-- spreadsheet's custom password/session/oauth/mfa tables, since the app already
-- uses @supabase/ssr for cookie-based auth. public.users is a thin profile
-- table keyed 1:1 to auth.users, kept in sync by triggers below. The
-- sessions, oauth_accounts, mfa_methods, password_reset_tokens and
-- email_verification_tokens tables from the spec are intentionally omitted —
-- GoTrue (Supabase Auth) already provides this functionality.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enums --------------------------------------------------------------------

create type user_status as enum ('pending', 'active', 'suspended', 'disabled');
create type contact_channel as enum ('email', 'whatsapp', 'telegram', 'sms', 'in_app', 'web', 'phone');
create type organization_type as enum ('customer', 'partner', 'funder', 'government', 'university', 'internal', 'other');
create type organization_status as enum ('active', 'inactive', 'suspended', 'archived');
create type membership_status as enum ('invited', 'active', 'suspended', 'left');
create type address_type as enum ('registered', 'billing', 'operational', 'mailing');
create type verification_status as enum ('pending', 'verified', 'rejected', 'expired');

-- Shared trigger helper ------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables ---------------------------------------------------------------------

create table industries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(40) not null unique,
  name varchar(160) not null,
  parent_id uuid references industries(id),
  description text
);
create index industries_parent_id_idx on industries(parent_id);
create trigger set_updated_at before update on industries
  for each row execute function set_updated_at();

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email citext not null unique,
  first_name varchar(120) not null default '',
  last_name varchar(120) not null default '',
  display_name varchar(255),
  phone varchar(40),
  status user_status not null default 'active',
  locale varchar(10) not null default 'en',
  timezone varchar(64) not null default 'UTC',
  last_login_at timestamptz,
  deleted_at timestamptz
);
create index users_status_idx on users(status);
create index users_deleted_at_idx on users(deleted_at);
create trigger set_updated_at before update on users
  for each row execute function set_updated_at();

-- Keep public.users in sync with auth.users automatically.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

create or replace function handle_auth_user_email_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.users set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function handle_auth_user_email_change();

create table organizations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  legal_name varchar(255) not null,
  display_name varchar(255) not null,
  slug citext not null unique,
  organization_type organization_type not null,
  status organization_status not null default 'active',
  registration_number varchar(120),
  tax_id varchar(120),
  website_url text,
  primary_email citext,
  primary_phone varchar(40),
  country_code char(2),
  industry_id uuid references industries(id),
  owner_user_id uuid references users(id),
  metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz
);
create index organizations_type_status_idx on organizations(organization_type, status);
create index organizations_country_code_idx on organizations(country_code);
create trigger set_updated_at before update on organizations
  for each row execute function set_updated_at();

create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null unique references users(id) on delete cascade,
  -- avatar_file_id will reference files.id once the Files & Storage module
  -- is created; left as a plain column with no FK until then.
  avatar_file_id uuid,
  bio text,
  job_title varchar(160),
  country_code char(2),
  city varchar(160),
  preferred_contact_channel contact_channel not null default 'email'
);
create trigger set_updated_at before update on user_profiles
  for each row execute function set_updated_at();

create table roles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(120) not null,
  description text,
  is_system boolean not null default false
);
create trigger set_updated_at before update on roles
  for each row execute function set_updated_at();

create table permissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(120) not null unique,
  resource varchar(80) not null,
  action varchar(80) not null,
  description text
);
create index permissions_resource_action_idx on permissions(resource, action);
create trigger set_updated_at before update on permissions
  for each row execute function set_updated_at();

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete restrict,
  organization_id uuid references organizations(id) on delete cascade,
  assigned_by uuid references users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, role_id, organization_id)
);
create index user_roles_user_id_idx on user_roles(user_id);
create index user_roles_organization_id_idx on user_roles(organization_id);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id) on delete cascade,
  created_by uuid not null references users(id),
  name varchar(160) not null,
  key_prefix varchar(24) not null,
  key_hash text not null unique,
  scopes jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_organization_id_idx on api_keys(organization_id);
create trigger set_updated_at before update on api_keys
  for each row execute function set_updated_at();

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  membership_status membership_status not null default 'active',
  is_primary_contact boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (organization_id, user_id)
);
create index organization_members_user_id_idx on organization_members(user_id);
create trigger set_updated_at before update on organization_members
  for each row execute function set_updated_at();

create table organization_addresses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  address_type address_type not null,
  line1 varchar(255) not null,
  line2 varchar(255),
  city varchar(160) not null,
  state_region varchar(160),
  postal_code varchar(40),
  country_code char(2) not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_primary boolean not null default false
);
create index organization_addresses_organization_id_idx on organization_addresses(organization_id);
create trigger set_updated_at before update on organization_addresses
  for each row execute function set_updated_at();

create table organization_domains (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null references organizations(id) on delete cascade,
  domain citext not null unique,
  verification_status verification_status not null default 'pending',
  verified_at timestamptz
);
create index organization_domains_organization_id_idx on organization_domains(organization_id);
create trigger set_updated_at before update on organization_domains
  for each row execute function set_updated_at();

create table organization_tags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name varchar(120) not null,
  slug citext not null unique,
  description text
);
create trigger set_updated_at before update on organization_tags
  for each row execute function set_updated_at();

create table organization_tag_assignments (
  organization_id uuid not null references organizations(id) on delete cascade,
  tag_id uuid not null references organization_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, tag_id)
);

-- Row Level Security ----------------------------------------------------------

-- Membership checks are wrapped in SECURITY DEFINER functions rather than
-- inlined as subqueries in policies. organizations and organization_members
-- policies each need to check the other table; without these functions the
-- two policies would query each other under normal RLS and Postgres would
-- reject it as infinite recursion. A SECURITY DEFINER function owned by the
-- table owner bypasses RLS for its internal query, breaking the cycle.
create or replace function is_organization_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id and user_id = auth.uid()
  );
$$;

create or replace function is_organization_owner(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from organizations
    where id = org_id and owner_user_id = auth.uid()
  );
$$;

alter table users enable row level security;
alter table user_profiles enable row level security;
alter table industries enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_addresses enable row level security;
alter table organization_domains enable row level security;
alter table organization_tags enable row level security;
alter table organization_tag_assignments enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table api_keys enable row level security;

-- users / user_profiles: self-access only. Writes to other users' rows,
-- and all deletes, are left to the service role (admin tooling).
create policy users_select_self on users for select
  using (auth.uid() = id);
create policy users_update_self on users for update
  using (auth.uid() = id);

create policy user_profiles_select_self on user_profiles for select
  using (auth.uid() = user_id);
create policy user_profiles_upsert_self on user_profiles for insert
  with check (auth.uid() = user_id);
create policy user_profiles_update_self on user_profiles for update
  using (auth.uid() = user_id);

-- industries: public reference data, readable by any authenticated user;
-- writes are service-role only (no policy needed for that — RLS is skipped
-- for the service role by design).
create policy industries_select_authenticated on industries for select
  to authenticated
  using (true);

-- roles / permissions / role_permissions: readable by authenticated users so
-- the app can resolve "what can I do", writes are service-role only.
create policy roles_select_authenticated on roles for select
  to authenticated using (true);
create policy permissions_select_authenticated on permissions for select
  to authenticated using (true);
create policy role_permissions_select_authenticated on role_permissions for select
  to authenticated using (true);

-- user_roles: users can see their own role assignments; assigning roles is
-- a service-role-only operation until an admin surface exists.
create policy user_roles_select_self on user_roles for select
  using (auth.uid() = user_id);

-- organizations: visible to members; creation allowed for any authenticated
-- user (they become owner); further updates restricted to the owner.
create policy organizations_select_member on organizations for select
  using (auth.uid() = owner_user_id or is_organization_member(id));
create policy organizations_insert_owner on organizations for insert
  with check (auth.uid() = owner_user_id);
create policy organizations_update_owner on organizations for update
  using (auth.uid() = owner_user_id);

create policy organization_members_select_member on organization_members for select
  using (user_id = auth.uid() or is_organization_owner(organization_id));

create policy organization_addresses_select_member on organization_addresses for select
  using (is_organization_member(organization_id));

create policy organization_domains_select_member on organization_domains for select
  using (is_organization_member(organization_id));

create policy organization_tags_select_authenticated on organization_tags for select
  to authenticated using (true);

create policy organization_tag_assignments_select_member on organization_tag_assignments for select
  using (is_organization_member(organization_id));

-- api_keys: contains secret hashes, so no client-facing policies are added.
-- Only the service role (which bypasses RLS) can read or write this table;
-- expose a key-management endpoint server-side rather than via direct
-- client access.
