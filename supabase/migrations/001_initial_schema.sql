-- PulsePay: Complete Supabase Schema
-- PayPal AI Hackathon 2026

-- ============================================================
-- TABLES
-- ============================================================

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  paypal_merchant_email text not null,
  currency text default 'USD',
  tone text default 'friendly',
  created_at timestamptz default now()
);

create table policies (
  business_id uuid primary key references businesses(id) on delete cascade,
  max_discount_pct numeric default 10,
  max_installments int default 3,
  min_first_payment_pct numeric default 30,
  approval_threshold numeric default 2000,
  max_messages_per_day int default 5,
  quiet_hours_start int default 22, -- hour in client timezone
  quiet_hours_end int default 8,
  updated_at timestamptz default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  email text not null,
  on_time_rate numeric default 100,
  total_invoices int default 0,
  total_paid int default 0,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  paypal_invoice_id text unique not null,
  parent_invoice_id text,
  amount numeric not null,
  currency text default 'USD',
  due_date timestamptz not null,
  status text not null default 'SENT',
  priority_score numeric default 0,
  priority_reason text,
  description text,
  synced_at timestamptz default now(),
  created_at timestamptz default now(),

  constraint invoices_status_check check (
    status in ('DRAFT', 'SENT', 'PAID', 'CANCELLED', 'SUPERSEDED', 'PARTIALLY_PAID', 'SCHEDULED')
  )
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  token text unique not null,
  status text default 'ACTIVE',
  messages_today int default 0,
  last_message_date date,
  created_at timestamptz default now(),

  constraint conversations_status_check check (
    status in ('ACTIVE', 'RESOLVED', 'ESCALATED', 'DISPUTED')
  )
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender text not null,
  content text not null,
  intent text,
  metadata jsonb,
  created_at timestamptz default now(),

  constraint messages_sender_check check (
    sender in ('AGENT', 'CLIENT', 'OWNER', 'SYSTEM')
  )
);

create table arrangements (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  conversation_id uuid references conversations(id),
  type text not null,
  terms jsonb not null,
  status text default 'PROPOSED',
  approved_by text,
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint arrangements_type_check check (
    type in ('DISCOUNT', 'PLAN', 'PAY_LATER')
  ),
  constraint arrangements_status_check check (
    status in ('PROPOSED', 'PENDING_APPROVAL', 'ACCEPTED', 'REJECTED', 'EXECUTED', 'EXPIRED')
  )
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  arrangement_id uuid references arrangements(id) on delete cascade,
  number int not null,
  amount numeric not null,
  due_date timestamptz not null,
  paypal_invoice_id text,
  status text default 'SCHEDULED',
  paid_at timestamptz,
  created_at timestamptz default now(),

  constraint installments_status_check check (
    status in ('SCHEDULED', 'SENT', 'PAID', 'CANCELLED')
  )
);

create table events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  actor text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz default now(),

  constraint events_actor_check check (
    actor in ('AGENT', 'OWNER', 'CLIENT', 'SCHEDULER', 'PAYPAL', 'SYSTEM')
  )
);

create table processed_events (
  paypal_event_id text primary key,
  event_type text,
  created_at timestamptz default now()
);

create table demo_clock (
  id int primary key default 1 check (id = 1),
  offset_days int default 0,
  updated_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_invoices_business_status on invoices(business_id, status);
create index idx_invoices_paypal_id on invoices(paypal_invoice_id);
create index idx_invoices_client on invoices(client_id);
create index idx_invoices_priority on invoices(business_id, priority_score desc);
create index idx_conversations_token on conversations(token);
create index idx_conversations_invoice on conversations(invoice_id);
create index idx_messages_conversation on messages(conversation_id, created_at);
create index idx_installments_arrangement on installments(arrangement_id, number);
create index idx_installments_status on installments(status, due_date);
create index idx_arrangements_invoice on arrangements(invoice_id);
create index idx_arrangements_status on arrangements(status);
create index idx_events_entity on events(entity_type, entity_id);
create index idx_events_created on events(created_at desc);
create index idx_clients_business on clients(business_id);

-- ============================================================
-- REALTIME
-- ============================================================

alter publication supabase_realtime add table invoices;
alter publication supabase_realtime add table arrangements;
alter publication supabase_realtime add table installments;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table events;

-- ============================================================
-- SEED: Demo clock initial row
-- ============================================================

insert into demo_clock (id, offset_days) values (1, 0)
on conflict (id) do nothing;

