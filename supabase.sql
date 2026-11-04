-- À exécuter une seule fois dans Supabase : SQL Editor > New query > Run.
-- La table n'est lisible que via 2 fonctions qui exigent une clé secrète d'au moins 32 caractères.
create table if not exists fuel_sync (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table fuel_sync enable row level security;

create or replace function fuel_get(p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if length(p_key) < 32 then raise exception 'key too short'; end if;
  return (select data from fuel_sync where key = p_key);
end $$;

create or replace function fuel_put(p_key text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(p_key) < 32 then raise exception 'key too short'; end if;
  insert into fuel_sync(key, data, updated_at) values (p_key, p_data, now())
  on conflict (key) do update set data = excluded.data, updated_at = now();
end $$;

revoke all on function fuel_get(text), fuel_put(text, jsonb) from public;
grant execute on function fuel_get(text), fuel_put(text, jsonb) to anon;
