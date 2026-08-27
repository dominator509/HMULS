-- Operator-written surface copy (homepage, sticky, checkout, post-grant).
-- Filled by the Grok transporter; empty means dial fallbacks.

alter table psychology_dials
  add column if not exists surface_json text not null default '';
