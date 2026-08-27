-- VELORA catalog, invoices, unlocks, gifts, and analytics events.

create table if not exists profiles (
  user_id text primary key,
  role text not null default 'buyer',
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists ladders (
  id text primary key,
  slug text unique not null,
  title text not null,
  theme text not null,
  tagline text not null,
  description text not null,
  cover_url text not null,
  sort_order int not null default 0,
  bundle_discount numeric not null default 0.32,
  collectors_count int not null default 0,
  climax_collectors int not null default 0,
  scarcity_ends_at timestamptz,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists shots (
  id text primary key,
  ladder_id text not null references ladders(id) on delete cascade,
  step_index int not null,
  title text not null,
  tease text not null,
  grant_copy text not null,
  media_type text not null default 'photo',
  media_url text not null,
  object_position text not null default 'center',
  price_cents int not null,
  is_climax boolean not null default false,
  unique (ladder_id, step_index)
);

create index if not exists shots_ladder_idx on shots (ladder_id, step_index);

create table if not exists invoices (
  id text primary key,
  user_id text not null,
  ladder_id text not null,
  kind text not null,
  shot_ids text not null,
  amount_cents int not null,
  asset text not null,
  pay_address text not null,
  crypto_amount text not null,
  status text not null default 'pending',
  is_gift boolean not null default false,
  gift_code text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists invoices_user_idx on invoices (user_id, created_at desc);

create table if not exists unlocks (
  id serial primary key,
  user_id text not null,
  shot_id text not null,
  ladder_id text not null,
  invoice_id text not null,
  amount_cents int not null,
  gifted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, shot_id)
);

create index if not exists unlocks_user_ladder_idx on unlocks (user_id, ladder_id);

create table if not exists gifts (
  code text primary key,
  from_user_id text not null,
  ladder_id text not null,
  shot_ids text not null,
  invoice_id text not null,
  redeemed_by text,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create table if not exists events (
  id serial primary key,
  user_id text,
  ladder_id text,
  kind text not null,
  meta text,
  created_at timestamptz not null default now()
);

create index if not exists events_kind_idx on events (kind, created_at desc);
