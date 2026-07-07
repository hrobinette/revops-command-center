-- RevOps Command Center — initial schema (Week 7).
-- Apply in the Supabase SQL editor, or via `psql "$SUPABASE_DB_URL" -f migrations/001_init.sql`.
-- Idempotent-ish: uses "if not exists" so re-running is safe.

create extension if not exists "pgcrypto";  -- for gen_random_uuid()

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- e.g. "Lakeshore Fintech"
  company text not null,
  stage text,                          -- discovery | evaluation | proposal | negotiation
  hubspot_deal_id text,                -- null until Week 8
  created_at timestamptz default now()
);

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  source_file text unique not null,    -- idempotency key
  call_number int,
  call_date date,
  attendees text[],
  transcript text,
  processed_at timestamptz default now()
);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  call_id uuid references calls(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  element text not null,               -- one of the 8 MEDDPICC elements
  score int not null check (score between 0 and 10),
  confidence text not null,            -- high | medium | low
  evidence text,                       -- brief justification, no long quotes
  named_competitor boolean,            -- only set on the "competition" element; drives COMPETITIVE_EXPOSURE
  created_at timestamptz default now()
);

create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals(id) on delete cascade,
  call_id uuid references calls(id) on delete cascade,
  flag_type text not null,             -- NO_EB_LATE_STAGE | CHAMPION_DECLINE | ...
  severity text not null,              -- red | yellow
  detail text,
  created_at timestamptz default now()
);

create index if not exists idx_calls_deal on calls(deal_id);
create index if not exists idx_scores_call on scores(call_id);
create index if not exists idx_scores_deal_element on scores(deal_id, element);
create index if not exists idx_flags_deal on flags(deal_id);
