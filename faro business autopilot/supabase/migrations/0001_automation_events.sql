create table if not exists automation_events (
  id bigint generated always as identity primary key,
  source text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table automation_events enable row level security;

-- No policies are added: this table is only written to via the service/secret
-- key from the n8n webhook route, which bypasses RLS by design.
