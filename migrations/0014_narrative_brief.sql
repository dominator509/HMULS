-- Operator owner brief for narrative generate / respin (muse + photoset).

alter table models add column if not exists owner_brief text not null default '';
alter table ladders add column if not exists owner_brief text not null default '';
