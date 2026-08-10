-- Fellowship module: the Diaspora Business Fellowship pipeline — programs,
-- cohorts, applications, review, confirmed fellows, cohort events, and
-- shared resources.
--
-- No foreign keys are deferred in this module — everything it references
-- (users, contacts, files) already exists.

-- Enums --------------------------------------------------------------------

create type program_status as enum ('draft', 'open', 'closed', 'running', 'completed', 'archived');
create type cohort_status as enum ('planning', 'applications_open', 'selection', 'active', 'completed', 'archived');
create type application_status as enum ('draft', 'submitted', 'under_review', 'shortlisted', 'selected', 'rejected', 'withdrawn');
create type application_decision as enum ('selected', 'waitlisted', 'rejected', 'withdrawn');
create type application_document_type as enum ('cv', 'id', 'passport', 'essay', 'reference', 'certificate', 'other');
create type review_status as enum ('assigned', 'in_progress', 'submitted', 'withdrawn');
create type review_recommendation as enum ('strong_yes', 'yes', 'maybe', 'no', 'strong_no');
create type fellow_status as enum ('onboarding', 'active', 'paused', 'completed', 'withdrawn', 'alumni');
create type fellowship_event_type as enum ('interview', 'orientation', 'workshop', 'immersion', 'meeting', 'ceremony', 'other');
create type rsvp_status as enum ('invited', 'accepted', 'declined', 'waitlisted');
create type resource_type as enum ('document', 'video', 'link', 'template', 'course', 'other');
create type resource_visibility as enum ('private', 'cohort', 'fellows', 'public');

-- Tables ---------------------------------------------------------------------

create table fellowship_programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(255) not null,
  description text not null,
  status program_status not null default 'draft',
  application_open_at timestamptz,
  application_close_at timestamptz,
  cohort_start_date date,
  cohort_end_date date,
  capacity integer,
  settings jsonb not null default '{}'::jsonb
);
create trigger set_updated_at before update on fellowship_programs
  for each row execute function set_updated_at();

create table fellowship_cohorts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  program_id uuid not null references fellowship_programs(id),
  name varchar(255) not null,
  year integer not null,
  status cohort_status not null default 'planning',
  start_date date,
  end_date date,
  capacity integer,
  unique (program_id, year)
);
create trigger set_updated_at before update on fellowship_cohorts
  for each row execute function set_updated_at();

create table fellowship_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  application_number varchar(40) not null unique,
  cohort_id uuid not null references fellowship_cohorts(id),
  applicant_user_id uuid references users(id),
  contact_id uuid references contacts(id),
  status application_status not null default 'draft',
  submitted_at timestamptz,
  application_data jsonb not null,
  eligibility_score numeric(5,2),
  overall_score numeric(5,2),
  decision application_decision,
  decision_at timestamptz
);
create index fellowship_applications_cohort_id_status_idx on fellowship_applications(cohort_id, status);
create trigger set_updated_at before update on fellowship_applications
  for each row execute function set_updated_at();

create table application_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  application_id uuid not null references fellowship_applications(id) on delete cascade,
  document_type application_document_type not null,
  file_id uuid not null references files(id),
  verification_status verification_status not null default 'pending',
  verified_by uuid references users(id),
  verified_at timestamptz
);
create index application_documents_application_id_idx on application_documents(application_id);
create trigger set_updated_at before update on application_documents
  for each row execute function set_updated_at();

create table application_reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  application_id uuid not null references fellowship_applications(id) on delete cascade,
  reviewer_user_id uuid not null references users(id),
  status review_status not null default 'assigned',
  scores jsonb not null default '{}'::jsonb,
  total_score numeric(5,2),
  comments text,
  recommendation review_recommendation,
  submitted_at timestamptz,
  unique (application_id, reviewer_user_id)
);
create trigger set_updated_at before update on application_reviews
  for each row execute function set_updated_at();

create table review_criteria (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  program_id uuid not null references fellowship_programs(id),
  code varchar(120) not null,
  name varchar(255) not null,
  description text,
  weight numeric(5,2) not null,
  max_score numeric(5,2) not null,
  position integer not null,
  unique (program_id, code)
);
create trigger set_updated_at before update on review_criteria
  for each row execute function set_updated_at();

create table fellows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cohort_id uuid not null references fellowship_cohorts(id),
  application_id uuid not null unique references fellowship_applications(id),
  user_id uuid references users(id),
  status fellow_status not null default 'onboarding',
  country_code char(2),
  onboarded_at timestamptz,
  completed_at timestamptz,
  alumni_since date
);
create index fellows_cohort_id_status_idx on fellows(cohort_id, status);
create trigger set_updated_at before update on fellows
  for each row execute function set_updated_at();

create table fellowship_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cohort_id uuid not null references fellowship_cohorts(id),
  event_type fellowship_event_type not null,
  title varchar(255) not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location varchar(255),
  meeting_url text,
  capacity integer
);
create index fellowship_events_cohort_id_starts_at_idx on fellowship_events(cohort_id, starts_at);
create trigger set_updated_at before update on fellowship_events
  for each row execute function set_updated_at();

create table fellowship_event_attendees (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references fellowship_events(id) on delete cascade,
  fellow_id uuid references fellows(id),
  user_id uuid references users(id),
  rsvp_status rsvp_status not null default 'invited',
  attended boolean,
  check_in_at timestamptz,
  unique (event_id, fellow_id, user_id)
);
create trigger set_updated_at before update on fellowship_event_attendees
  for each row execute function set_updated_at();

create table fellowship_resources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cohort_id uuid not null references fellowship_cohorts(id),
  title varchar(255) not null,
  resource_type resource_type not null,
  file_id uuid references files(id),
  external_url text,
  visibility resource_visibility not null default 'cohort'
);
create index fellowship_resources_cohort_id_idx on fellowship_resources(cohort_id);
create trigger set_updated_at before update on fellowship_resources
  for each row execute function set_updated_at();

-- Row Level Security ----------------------------------------------------------

-- An applicant sees their own application; an assigned reviewer sees the
-- applications assigned to them (but not the reverse — reviews stay
-- reviewer-only, see application_reviews policy below, for blind review).
create or replace function can_access_application(p_application_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from fellowship_applications
    where id = p_application_id
      and (
        applicant_user_id = auth.uid()
        or exists (
          select 1 from application_reviews ar
          where ar.application_id = p_application_id and ar.reviewer_user_id = auth.uid()
        )
      )
  );
$$;

-- A cohort is visible to its applicants (so they can see interview/
-- orientation events before being confirmed) and its confirmed fellows.
create or replace function can_access_cohort(p_cohort_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from fellows
    where cohort_id = p_cohort_id and user_id = auth.uid()
  ) or exists (
    select 1 from fellowship_applications
    where cohort_id = p_cohort_id and applicant_user_id = auth.uid()
  );
$$;

alter table fellowship_programs enable row level security;
alter table fellowship_cohorts enable row level security;
alter table fellowship_applications enable row level security;
alter table application_documents enable row level security;
alter table application_reviews enable row level security;
alter table review_criteria enable row level security;
alter table fellows enable row level security;
alter table fellowship_events enable row level security;
alter table fellowship_event_attendees enable row level security;
alter table fellowship_resources enable row level security;

-- fellowship_programs / fellowship_cohorts / review_criteria: public
-- program information (including how applications are scored, for
-- transparency). Readable by any authenticated user; writes service-role
-- only.
create policy fellowship_programs_select_authenticated on fellowship_programs for select
  to authenticated using (true);
create policy fellowship_cohorts_select_authenticated on fellowship_cohorts for select
  to authenticated using (true);
create policy review_criteria_select_authenticated on review_criteria for select
  to authenticated using (true);

-- fellowship_applications: private to the applicant and their assigned
-- reviewers. A user starts their own application directly.
create policy fellowship_applications_select_access on fellowship_applications for select
  using (can_access_application(id));
create policy fellowship_applications_insert_owner on fellowship_applications for insert
  with check (applicant_user_id = auth.uid());
create policy fellowship_applications_update_owner on fellowship_applications for update
  using (applicant_user_id = auth.uid());

create policy application_documents_select_access on application_documents for select
  using (can_access_application(application_id));
create policy application_documents_insert on application_documents for insert
  with check (can_access_application(application_id));

-- application_reviews: reviewer-only (blind review — the applicant should
-- not see reviewer identities, scores, or comments about their own
-- application). Written by the reviewer themselves.
create policy application_reviews_select_reviewer on application_reviews for select
  using (reviewer_user_id = auth.uid());
create policy application_reviews_insert_reviewer on application_reviews for insert
  with check (reviewer_user_id = auth.uid());
create policy application_reviews_update_reviewer on application_reviews for update
  using (reviewer_user_id = auth.uid());

-- fellows: a fellow can see their own record. Final selection is a human
-- approval gate per the business process — this table isn't client-insertable.
create policy fellows_select_self on fellows for select
  using (user_id = auth.uid());

create policy fellowship_events_select_access on fellowship_events for select
  using (can_access_cohort(cohort_id));

create policy fellowship_event_attendees_select_self on fellowship_event_attendees for select
  using (user_id = auth.uid());
create policy fellowship_event_attendees_update_self on fellowship_event_attendees for update
  using (user_id = auth.uid());

-- fellowship_resources: gated by the visibility column plus cohort
-- membership — 'public' is open to any authenticated user, 'fellows'
-- requires confirmed fellow status in that cohort, 'cohort' extends that
-- to applicants awaiting a decision too, and 'private' has no client
-- policy (service-role/staff only).
create policy fellowship_resources_select_access on fellowship_resources for select
  using (
    visibility = 'public'
    or (visibility = 'fellows' and exists (
      select 1 from fellows fw
      where fw.cohort_id = fellowship_resources.cohort_id and fw.user_id = auth.uid()
    ))
    or (visibility = 'cohort' and can_access_cohort(cohort_id))
  );
