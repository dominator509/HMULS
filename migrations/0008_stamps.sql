-- Per-grant forensic stamps. Operator can turn this off.

create table if not exists vault_settings (
  id integer primary key default 1,
  stamp_grants boolean not null default true,
  stamp_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into vault_settings (id) values (1) on conflict (id) do nothing;

create table if not exists media_stamps (
  token text primary key,
  user_id text not null,
  shot_id text not null,
  invoice_id text,
  tx_hash text,
  created_at timestamptz not null default now(),
  unique (user_id, shot_id)
);

create index if not exists media_stamps_user_idx on media_stamps (user_id);
create index if not exists media_stamps_shot_idx on media_stamps (shot_id);
