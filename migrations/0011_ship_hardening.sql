create table if not exists vault_bootstrap (
  slot text primary key,
  user_id text not null,
  claimed_at timestamptz not null default now()
);

delete from api_keys where id = 'key_preview';

insert into vault_bootstrap (slot, user_id)
select 'admin_zero', user_id from profiles
where role = 'admin'
order by created_at asc
limit 1
on conflict (slot) do nothing;
