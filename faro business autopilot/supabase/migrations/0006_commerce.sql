-- Commerce module: products, orders, invoices, payments, credit ledger, and
-- subscriptions.
--
-- One foreign key from the spec is deferred until its target module exists,
-- same pattern used in prior migrations:
--   invoices.invoice_file_id -> files.id  (Files & Storage module)
--
-- Per the spec's "Financial integrity" note, orders/invoices/payments/
-- refunds/credit_ledger_entries/subscription_events must be updated through
-- transactions and idempotency keys at the application layer. At the RLS
-- layer here, that translates to: customers can SELECT their own commerce
-- records, but money-moving writes (payments, credit balance changes,
-- refund approval, subscription lifecycle) are service-role only — driven
-- by Stripe webhooks and admin actions, never direct client writes.

-- Enums --------------------------------------------------------------------

create type product_type as enum ('report', 'subscription', 'credits', 'fellowship', 'expedition', 'advisory', 'partner_service');
create type product_status as enum ('draft', 'active', 'inactive', 'archived');
create type fulfillment_type as enum ('automatic', 'manual', 'hybrid');
create type billing_period as enum ('one_time', 'monthly', 'quarterly', 'annual');
create type order_status as enum ('draft', 'pending_payment', 'paid', 'processing', 'fulfilled', 'cancelled', 'refunded');
create type fulfillment_status as enum ('pending', 'processing', 'fulfilled', 'failed', 'cancelled');
create type invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void', 'refunded');
create type payment_method as enum ('bank_transfer', 'mobile_money', 'card', 'cash', 'credit', 'other');
create type payment_status as enum ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');
create type refund_status as enum ('requested', 'approved', 'rejected', 'processing', 'completed', 'failed');
create type account_status as enum ('active', 'frozen', 'closed');
create type credit_entry_type as enum ('purchase', 'deduction', 'refund', 'promotion', 'adjustment', 'reservation', 'release');
create type subscription_status as enum ('pending', 'trialing', 'active', 'past_due', 'paused', 'cancelled', 'expired');
create type subscription_event_type as enum ('created', 'activated', 'renewed', 'paused', 'resumed', 'cancelled', 'expired', 'plan_changed');

-- Tables ---------------------------------------------------------------------

create table products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(255) not null,
  product_type product_type not null,
  description text,
  status product_status not null default 'active',
  fulfillment_type fulfillment_type not null,
  requires_human_review boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);
create index products_type_status_idx on products(product_type, status);
create trigger set_updated_at before update on products
  for each row execute function set_updated_at();

create table product_prices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_id uuid not null references products(id) on delete cascade,
  currency char(3) not null,
  billing_period billing_period,
  unit_amount numeric(14,2) not null,
  credit_cost integer,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_active boolean not null default true
);
create index product_prices_product_id_is_active_idx on product_prices(product_id, is_active);
create trigger set_updated_at before update on product_prices
  for each row execute function set_updated_at();

create table product_features (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  product_id uuid not null references products(id) on delete cascade,
  feature_code varchar(120) not null,
  feature_name varchar(255) not null,
  feature_value jsonb not null default 'true'::jsonb,
  unique (product_id, feature_code)
);
create trigger set_updated_at before update on product_features
  for each row execute function set_updated_at();

create table orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_number varchar(40) not null unique,
  organization_id uuid references organizations(id),
  customer_user_id uuid references users(id),
  deal_id uuid references deals(id),
  status order_status not null default 'draft',
  currency char(3) not null default 'USD',
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  placed_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz
);
create index orders_status_created_at_idx on orders(status, created_at);
create trigger set_updated_at before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null,
  discount_amount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null,
  fulfillment_status fulfillment_status not null default 'pending'
);
create index order_items_order_id_idx on order_items(order_id);
create trigger set_updated_at before update on order_items
  for each row execute function set_updated_at();

create table invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invoice_number varchar(40) not null unique,
  order_id uuid references orders(id),
  organization_id uuid references organizations(id),
  customer_user_id uuid references users(id),
  status invoice_status not null default 'draft',
  currency char(3) not null default 'USD',
  subtotal numeric(14,2) not null,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null,
  amount_paid numeric(14,2) not null default 0,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  -- Will reference files.id once the Files & Storage module exists.
  invoice_file_id uuid,
  external_invoice_id varchar(255)
);
create index invoices_status_due_at_idx on invoices(status, due_at);
create trigger set_updated_at before update on invoices
  for each row execute function set_updated_at();

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id),
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(14,2) not null,
  tax_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null
);
create index invoice_items_invoice_id_idx on invoice_items(invoice_id);
create trigger set_updated_at before update on invoice_items
  for each row execute function set_updated_at();

create table payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payment_reference varchar(80) not null unique,
  invoice_id uuid references invoices(id),
  order_id uuid references orders(id),
  organization_id uuid references organizations(id),
  customer_user_id uuid references users(id),
  payment_method payment_method not null,
  provider varchar(120),
  provider_payment_id varchar(255),
  status payment_status not null default 'pending',
  currency char(3) not null,
  amount numeric(14,2) not null,
  fees numeric(14,2) not null default 0,
  paid_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references users(id),
  metadata jsonb not null default '{}'::jsonb
);
create index payments_status_created_at_idx on payments(status, created_at);
create index payments_provider_provider_payment_id_idx on payments(provider, provider_payment_id);
create trigger set_updated_at before update on payments
  for each row execute function set_updated_at();

create table payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider varchar(120) not null,
  provider_event_id varchar(255) not null,
  event_type varchar(160) not null,
  payload jsonb not null,
  signature_valid boolean not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payment_id uuid not null references payments(id),
  amount numeric(14,2) not null,
  reason text not null,
  status refund_status not null default 'requested',
  requested_by uuid references users(id),
  approved_by uuid references users(id),
  provider_refund_id varchar(255),
  processed_at timestamptz
);
create index refunds_payment_id_idx on refunds(payment_id);
create trigger set_updated_at before update on refunds
  for each row execute function set_updated_at();

create table credit_accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  user_id uuid references users(id),
  balance integer not null default 0,
  reserved_balance integer not null default 0,
  currency_code varchar(20) not null default 'FARO_CREDIT',
  status account_status not null default 'active',
  unique (organization_id, user_id)
);
create trigger set_updated_at before update on credit_accounts
  for each row execute function set_updated_at();

create table credit_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  credit_account_id uuid not null references credit_accounts(id) on delete cascade,
  entry_type credit_entry_type not null,
  amount integer not null,
  balance_before integer not null,
  balance_after integer not null,
  reference_type varchar(80),
  reference_id uuid,
  description text,
  actor_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  idempotency_key varchar(255) not null unique
);
create index credit_ledger_entries_account_id_created_at_idx on credit_ledger_entries(credit_account_id, created_at desc);

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code varchar(80) not null unique,
  name varchar(255) not null,
  description text,
  billing_period billing_period not null,
  price_amount numeric(14,2) not null,
  currency char(3) not null,
  included_credits integer not null default 0,
  features jsonb not null default '{}'::jsonb,
  status product_status not null default 'active'
);
create trigger set_updated_at before update on subscription_plans
  for each row execute function set_updated_at();

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid references organizations(id),
  user_id uuid references users(id),
  plan_id uuid not null references subscription_plans(id),
  status subscription_status not null default 'pending',
  provider varchar(120),
  provider_subscription_id varchar(255),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  unique (provider, provider_subscription_id)
);
create index subscriptions_status_current_period_end_idx on subscriptions(status, current_period_end);
create trigger set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create table subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  event_type subscription_event_type not null,
  effective_at timestamptz not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index subscription_events_subscription_id_effective_at_idx on subscription_events(subscription_id, effective_at desc);

-- Row Level Security ----------------------------------------------------------

create or replace function can_access_order(p_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from orders
    where id = p_order_id
      and (customer_user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_invoice(p_invoice_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from invoices
    where id = p_invoice_id
      and (customer_user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_payment(p_payment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from payments
    where id = p_payment_id
      and (customer_user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_credit_account(p_credit_account_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from credit_accounts
    where id = p_credit_account_id
      and (user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

create or replace function can_access_subscription(p_subscription_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from subscriptions
    where id = p_subscription_id
      and (user_id = auth.uid() or is_organization_member(organization_id))
  );
$$;

alter table products enable row level security;
alter table product_prices enable row level security;
alter table product_features enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table payment_webhook_events enable row level security;
alter table refunds enable row level security;
alter table credit_accounts enable row level security;
alter table credit_ledger_entries enable row level security;
alter table subscription_plans enable row level security;
alter table subscriptions enable row level security;
alter table subscription_events enable row level security;

-- products / product_prices / product_features / subscription_plans: the
-- public catalog. Readable by any authenticated user; writes service-role
-- only.
create policy products_select_authenticated on products for select
  to authenticated using (true);
create policy product_prices_select_authenticated on product_prices for select
  to authenticated using (true);
create policy product_features_select_authenticated on product_features for select
  to authenticated using (true);
create policy subscription_plans_select_authenticated on subscription_plans for select
  to authenticated using (true);

-- orders: a customer can see and create their own orders (building a cart /
-- starting checkout); org members see orders billed to their org.
create policy orders_select_access on orders for select
  using (customer_user_id = auth.uid() or is_organization_member(organization_id));
create policy orders_insert_owner on orders for insert
  with check (customer_user_id = auth.uid());
create policy orders_update_access on orders for update
  using (customer_user_id = auth.uid() or is_organization_member(organization_id));

create policy order_items_access on order_items for select
  using (can_access_order(order_id));
create policy order_items_insert on order_items for insert
  with check (can_access_order(order_id));
create policy order_items_update on order_items for update
  using (can_access_order(order_id));

-- invoices / invoice_items: view-only for the customer/org they belong to.
-- Invoices are generated by the backend from a paid order, not created
-- directly by clients.
create policy invoices_select_access on invoices for select
  using (customer_user_id = auth.uid() or is_organization_member(organization_id));

create policy invoice_items_access on invoice_items for select
  using (can_access_invoice(invoice_id));

-- payments: view-only. Rows are written by the Stripe webhook handler
-- (service role) after signature verification, never by direct client
-- insert — see the "Financial integrity" note in the migration header.
create policy payments_select_access on payments for select
  using (customer_user_id = auth.uid() or is_organization_member(organization_id));

-- payment_webhook_events: raw provider payloads, service-role only, no
-- client-facing policies (same treatment as api_keys/email_accounts).

-- refunds: a customer can view refunds on their own payments and request
-- one; approval/processing is service-role only (human approval gate).
create policy refunds_select_access on refunds for select
  using (can_access_payment(payment_id));
create policy refunds_insert_requester on refunds for insert
  with check (can_access_payment(payment_id) and requested_by = auth.uid());

-- credit_accounts / credit_ledger_entries: view-only. Balances only ever
-- change through a ledger entry written by trusted backend logic, never a
-- direct client update to credit_accounts.balance.
create policy credit_accounts_select_access on credit_accounts for select
  using (user_id = auth.uid() or is_organization_member(organization_id));

create policy credit_ledger_entries_select_access on credit_ledger_entries for select
  using (can_access_credit_account(credit_account_id));

-- subscriptions / subscription_events: view-only. Lifecycle changes come
-- from Stripe webhooks via the service role.
create policy subscriptions_select_access on subscriptions for select
  using (user_id = auth.uid() or is_organization_member(organization_id));

create policy subscription_events_select_access on subscription_events for select
  using (can_access_subscription(subscription_id));
