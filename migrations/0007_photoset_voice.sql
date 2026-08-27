-- Each muse owns unique photoset stories. Teases are written from the frames.

alter table ladders add column if not exists model_id text not null default 'mod_liora';
alter table ladders add column if not exists photoset_hook text not null default '';
alter table ladders add column if not exists photoset_tease text not null default '';

alter table shots add column if not exists visual_beat text not null default '';

alter table models add column if not exists voice text not null default '';
alter table models add column if not exists looks text not null default '';
alter table models add column if not exists tease_style text not null default '';

create index if not exists ladders_model_idx on ladders (model_id);
