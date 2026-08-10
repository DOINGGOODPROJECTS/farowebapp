-- Files & Storage module: file metadata, version history, sharing grants,
-- and signed download tokens. Backs the Backblaze B2 bucket already
-- configured in .env (B2_BUCKET_NAME etc.) — bucket_name/object_key here
-- point at objects living in B2, not the file bytes themselves.
--
-- No foreign keys are deferred in this module. Instead, this migration
-- closes out the five FKs deferred *from* earlier modules now that files
-- (and signed_download_tokens) exist, see the ALTER TABLE statements at
-- the bottom:
--   user_profiles.avatar_file_id       (deferred in migration 0002)
--   invoices.invoice_file_id           (deferred in migration 0006)
--   source_documents.file_id           (deferred in migration 0008)
--   reports.file_id                    (deferred in migration 0008)
--   report_downloads.download_token_id (deferred in migration 0008)

-- Enums --------------------------------------------------------------------

create type file_visibility as enum ('private', 'organization', 'public');
create type encryption_status as enum ('encrypted', 'unencrypted');
create type scan_status as enum ('pending', 'clean', 'infected', 'failed');
create type grantee_type as enum ('user', 'organization', 'role');
create type file_permission as enum ('read', 'download', 'write', 'delete');

-- Tables ---------------------------------------------------------------------

create table files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  uploaded_by uuid references users(id),
  bucket_name varchar(160) not null,
  object_key text not null,
  original_name varchar(500) not null,
  mime_type varchar(160) not null,
  size_bytes bigint not null,
  checksum_sha256 varchar(64) not null,
  visibility file_visibility not null default 'private',
  encryption_status encryption_status not null default 'encrypted',
  virus_scan_status scan_status not null default 'pending',
  deleted_at timestamptz,
  unique (bucket_name, object_key)
);
create index files_checksum_sha256_idx on files(checksum_sha256);
create trigger set_updated_at before update on files
  for each row execute function set_updated_at();

create table file_versions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  file_id uuid not null references files(id) on delete cascade,
  version_number integer not null,
  bucket_name varchar(160) not null,
  object_key text not null,
  size_bytes bigint not null,
  checksum_sha256 varchar(64) not null,
  created_by uuid references users(id),
  unique (file_id, version_number)
);
create trigger set_updated_at before update on file_versions
  for each row execute function set_updated_at();

create table file_access_grants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  file_id uuid not null references files(id) on delete cascade,
  grantee_type grantee_type not null,
  -- Polymorphic reference (users.id, organizations.id, or roles.id
  -- depending on grantee_type); no single FK, same pattern as
  -- human_approval_requests.reference_id.
  grantee_id uuid not null,
  permission file_permission not null,
  expires_at timestamptz,
  granted_by uuid not null references users(id)
);
create index file_access_grants_file_id_idx on file_access_grants(file_id);
create trigger set_updated_at before update on file_access_grants
  for each row execute function set_updated_at();

create table signed_download_tokens (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references files(id),
  token_hash text not null unique,
  user_id uuid references users(id),
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  use_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index signed_download_tokens_expires_at_idx on signed_download_tokens(expires_at);

-- Row Level Security ----------------------------------------------------------

create or replace function can_access_file(p_file_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from files f
    where f.id = p_file_id
      and (
        f.visibility = 'public'
        or f.uploaded_by = auth.uid()
        or is_organization_member(f.organization_id)
        or exists (
          select 1 from file_access_grants g
          where g.file_id = p_file_id
            and (g.expires_at is null or g.expires_at > now())
            and (
              (g.grantee_type = 'user' and g.grantee_id = auth.uid())
              or (g.grantee_type = 'organization' and is_organization_member(g.grantee_id))
              or (g.grantee_type = 'role' and exists (
                    select 1 from user_roles ur
                    where ur.user_id = auth.uid() and ur.role_id = g.grantee_id
                  ))
            )
        )
      )
  );
$$;

alter table files enable row level security;
alter table file_versions enable row level security;
alter table file_access_grants enable row level security;
alter table signed_download_tokens enable row level security;

-- files: visible if public, owned, org-linked, or explicitly granted (user,
-- org, or role) via file_access_grants. Upload creates the owning row
-- directly (uploaded_by = auth.uid()); the actual object bytes go to B2
-- separately, this table only tracks the metadata.
create policy files_select_access on files for select
  using (can_access_file(id));
create policy files_insert_owner on files for insert
  with check (uploaded_by = auth.uid());
create policy files_update_owner on files for update
  using (uploaded_by = auth.uid() or is_organization_member(organization_id));

create policy file_versions_select_access on file_versions for select
  using (can_access_file(file_id));
create policy file_versions_insert on file_versions for insert
  with check (can_access_file(file_id));

create policy file_access_grants_select_access on file_access_grants for select
  using (can_access_file(file_id));

-- signed_download_tokens: contains a bearer-style secret (token_hash) —
-- same treatment as api_keys, no client-facing policies at all. Issued and
-- redeemed only through a server-side download endpoint using the service
-- role.

-- Backfill the FKs deferred from earlier modules now that files (and
-- signed_download_tokens) exist.
alter table user_profiles
  add constraint user_profiles_avatar_file_id_fkey
  foreign key (avatar_file_id) references files(id);

alter table invoices
  add constraint invoices_invoice_file_id_fkey
  foreign key (invoice_file_id) references files(id);

alter table source_documents
  add constraint source_documents_file_id_fkey
  foreign key (file_id) references files(id);

alter table reports
  add constraint reports_file_id_fkey
  foreign key (file_id) references files(id);

alter table report_downloads
  add constraint report_downloads_download_token_id_fkey
  foreign key (download_token_id) references signed_download_tokens(id);
