-- Agent connector keys (REST + MCP). Store hashes only.

create table if not exists api_keys (
  id text primary key,
  label text not null,
  prefix text not null,
  hash text unique not null,
  scope text not null default 'read',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_hash_idx on api_keys (hash);
