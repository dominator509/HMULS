-- Operator studio + site theme.

alter table vault_settings add column if not exists theme_json text not null default '';
alter table shots add column if not exists imagine_prompt text not null default '';
