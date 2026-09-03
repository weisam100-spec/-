-- 安心長照導航：reports + orders schema
-- Apply via the Supabase SQL editor, or `supabase db push` if you use the CLI.

create extension if not exists pgcrypto;

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  email text,
  answers jsonb not null default '{}'::jsonb,
  is_paid boolean not null default false,
  cms_level integer not null default 4,
  doc_state jsonb not null default '{}'::jsonb,
  presubmit_state jsonb not null default '{}'::jsonb,
  progress_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  amount_twd integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  merchant_trade_no text not null unique,
  ecpay_trade_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_report_id_idx on orders (report_id);

-- Row Level Security: no public policies are defined on purpose.
-- This app has no end-user login — every read/write goes through our own
-- Next.js API routes, which use the Supabase *service role* key (server-side
-- only, bypasses RLS). Anon/authenticated keys therefore get zero access,
-- which is what we want since the service role key must never reach the browser.
alter table reports enable row level security;
alter table orders enable row level security;
