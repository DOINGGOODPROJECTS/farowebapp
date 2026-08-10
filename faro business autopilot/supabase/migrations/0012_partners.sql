-- Partners module: the partner marketplace — profiles, services offered,
-- applications to become a partner, referrals, and agreements.
--
-- No foreign keys are deferred in this module — everything it references
-- (organizations, users, contacts, files) already exists.

-- Enums --------------------------------------------------------------------

create type partner_type as enum ('service_provider', 'institution', 'corporate', 'government', 'university', 'funder', 'other');
create type partner_status as enum ('pending', 'under_review', 'verified', 'suspended', 'rejected', 'inactive');
create type pricing_model as enum ('fixed', 'hourly', 'daily', 'project', 'subscription', 'custom');
create type referral_status as enum ('new', 'accepted', 'contacted', 'converted', 'declined', 'closed');
create type agreement_type as enum ('mou', 'service_agreement', 'nda', 'partnership', 'referral', 'other');
create type agreement_status as enum ('draft', 'under_review', 'approved', 'signed', 'active', 'expired', 'terminated');

-- Tables ---------------------------------------------------------------------

create table partner_profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null unique references organizations(id),
  partner_type partner_type not null,
  status partner_status not null default 'pending',
  summary text,
  service_regions jsonb not null default '[]'::jsonb,
  verification_score numeric(5,2),
  verified_at timestamptz,
  verified_by uuid references users(id)
);
create trigger set_updated_at before update on partner_profiles
  for each row execute function set_updated_at();

create table partner_services (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  partner_profile_id uuid not null references partner_profiles(id) on delete cascade,
  service_code varchar(120) not null,
  name varchar(255) not null,
  description text not null,
  pricing_model pricing_model,
  price_from numeric(14,2),
  currency char(3),
  status record_status not null default 'active',
  unique (partner_profile_id, service_code)
);
create trigger set_updated_at before update on partner_services
  for each row execute function set_updated_at();

create table partner_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  application_number varchar(40) not null unique,
  organization_id uuid references organizations(id),
  submitted_by uuid references users(id),
  status application_status not null default 'draft',
  application_data jsonb not null,
  submitted_at timestamptz,
  decision application_decision,
  decision_at timestamptz,
  decision_by uuid references users(id)
);
create index partner_applications_status_idx on partner_applications(status);
create trigger set_updated_at before update on partner_applications
  for each row execute function set_updated_at();

create table partner_referrals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  partner_profile_id uuid not null references partner_profiles(id) on delete cascade,
  organization_id uuid references organizations(id),
  contact_id uuid references contacts(id),
  service_id uuid references partner_services(id),
  status referral_status not null default 'new',
  referred_by uuid references users(id),
  referral_value numeric(14,2),
  currency char(3),
  converted_at timestamptz
);
create index partner_referrals_partner_profile_id_status_idx on partner_referrals(partner_profile_id, status);
create trigger set_updated_at before update on partner_referrals
  for each row execute function set_updated_at();

create table partner_agreements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  partner_profile_id uuid not null references partner_profiles(id) on delete cascade,
  agreement_type agreement_type not null,
  title varchar(255) not null,
  file_id uuid references files(id),
  status agreement_status not null default 'draft',
  starts_at date,
  ends_at date,
  signed_at timestamptz,
  approved_by uuid references users(id)
);
create index partner_agreements_partner_profile_id_status_idx on partner_agreements(partner_profile_id, status);
create trigger set_updated_at before update on partner_agreements
  for each row execute function set_updated_at();

-- Row Level Security ----------------------------------------------------------

-- A partner profile/its services are visible to anyone once verified (the
-- public marketplace listing), or to the owning organization regardless of
-- status (so they can see their own pending/rejected application).
create or replace function can_access_partner_profile(p_partner_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from partner_profiles
    where id = p_partner_profile_id
      and (status = 'verified' or is_organization_member(organization_id))
  );
$$;

-- Owner-only check (no public-verified carve-out) — for referrals and
-- agreements, which are private business records, not marketplace listings.
create or replace function is_partner_owner(p_partner_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from partner_profiles
    where id = p_partner_profile_id and is_organization_member(organization_id)
  );
$$;

alter table partner_profiles enable row level security;
alter table partner_services enable row level security;
alter table partner_applications enable row level security;
alter table partner_referrals enable row level security;
alter table partner_agreements enable row level security;

-- partner_profiles / partner_services: the public marketplace. Verified
-- partners are browsable by anyone; a partner org always sees its own
-- profile/services regardless of verification status.
create policy partner_profiles_select_access on partner_profiles for select
  to authenticated
  using (status = 'verified' or is_organization_member(organization_id));
create policy partner_profiles_insert_owner on partner_profiles for insert
  with check (is_organization_member(organization_id));
create policy partner_profiles_update_owner on partner_profiles for update
  using (is_organization_member(organization_id));

create policy partner_services_select_access on partner_services for select
  using (can_access_partner_profile(partner_profile_id));
create policy partner_services_insert_owner on partner_services for insert
  with check (is_partner_owner(partner_profile_id));
create policy partner_services_update_owner on partner_services for update
  using (is_partner_owner(partner_profile_id));

-- partner_applications: an org applying to become a partner sees their
-- own application. Final approval is a human-approval-gated decision per
-- the business process — decision fields are backend-written, not
-- client-updatable (no update policy).
create policy partner_applications_select_access on partner_applications for select
  using (submitted_by = auth.uid() or is_organization_member(organization_id));
create policy partner_applications_insert_owner on partner_applications for insert
  with check (submitted_by = auth.uid());

-- partner_referrals: visible to the partner receiving the lead, and to the
-- customer organization being referred (if any).
create policy partner_referrals_select_access on partner_referrals for select
  using (is_partner_owner(partner_profile_id) or is_organization_member(organization_id));

-- partner_agreements: private business records — visible to the partner
-- org only. Created/managed by staff (service role), not client-insertable.
create policy partner_agreements_select_access on partner_agreements for select
  using (is_partner_owner(partner_profile_id));
