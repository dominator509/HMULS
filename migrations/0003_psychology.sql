-- Operator-dialable sales psychology + per-collector pressure windows.

alter table shots add column if not exists story text not null default '';
alter table shots add column if not exists drop_line text not null default '';

alter table ladders add column if not exists climax_cap int not null default 48;

alter table invoices add column if not exists expires_at timestamptz;

create table if not exists psychology_dials (
  id int primary key default 1,
  urgency int not null default 7,
  scarcity int not null default 6,
  tease int not null default 8,
  sunk_cost int not null default 8,
  social_proof int not null default 6,
  fetish_heat int not null default 7,
  addiction int not null default 8,
  updated_at timestamptz not null default now()
);

insert into psychology_dials (id) values (1) on conflict (id) do nothing;

create table if not exists collector_pressure (
  user_id text not null,
  ladder_id text not null,
  last_unlock_at timestamptz not null default now(),
  continue_by timestamptz not null,
  primary key (user_id, ladder_id)
);
