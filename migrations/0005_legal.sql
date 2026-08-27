-- Operator legal entity, per-model (muse) records, generated legal packs.
-- Templates fill these rows. 2257 IDs are NOT stored here — only attestations.

create table if not exists legal_entity (
  id int primary key default 1,
  site_name text not null default 'SHE UNDRESSES',
  entity_name text not null default '',
  jurisdiction text not null default 'Washington, United States',
  custodian_name text not null default '',
  custodian_title text not null default 'Custodian of Records',
  address1 text not null default '',
  address2 text not null default '',
  city text not null default '',
  region text not null default 'WA',
  postal text not null default '',
  country text not null default 'United States',
  contact_email text not null default '',
  dmca_email text not null default '',
  website_url text not null default '',
  updated_at timestamptz not null default now()
);

insert into legal_entity (id) values (1) on conflict (id) do nothing;

create table if not exists models (
  id text primary key,
  slug text unique not null,
  stage_name text not null,
  content_kind text not null default 'synthetic',
  portrayed_age_min int not null default 24,
  aliases text not null default '',
  bio text not null default '',
  is_fictional boolean not null default true,
  likeness_ok boolean not null default true,
  records_on_file boolean not null default false,
  id_type_on_file text not null default '',
  first_produced text not null default '',
  ladder_slugs text not null default '',
  card_portrayal text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists legal_docs (
  id text primary key,
  scope text not null,
  model_id text,
  kind text not null,
  slug text unique not null,
  title text not null,
  body text not null,
  version int not null default 1,
  generated_at timestamptz not null default now()
);

create index if not exists legal_docs_scope_idx on legal_docs (scope, kind);
