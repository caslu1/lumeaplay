-- =====================================================================
-- LumeaPlay — banco de dados no Supabase
-- Cole tudo no Supabase → SQL Editor → New query → Run
-- Antes de rodar, troque SEU_EMAIL_AQUI pelo e-mail do seu login do painel.
-- =====================================================================

-- Quem pode usar o painel
create table if not exists public.lp_admins (
  email text primary key
);
insert into public.lp_admins (email) values (lower('SEU_EMAIL_AQUI'))
on conflict do nothing;

create or replace function public.lp_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from lp_admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Códigos de acesso
create table if not exists public.lp_codes (
  code          text primary key check (code ~ '^[0-9]{9}$'),
  name          text not null default '',
  phone         text not null default '',
  m3u           text not null,
  note          text not null default '',
  status        text not null default 'ativo' check (status in ('ativo', 'bloqueado')),
  plan          text not null default '',
  device_id     text,
  device_model  text,
  activated_at  timestamptz,
  last_seen     timestamptz,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);

-- Tentativas erradas por aparelho (contra quem fica chutando códigos)
create table if not exists public.lp_attempts (
  device  text primary key,
  fails   int not null default 0,
  until   timestamptz
);

-- Segurança: ninguém de fora lê as tabelas. Só o painel (admin logado).
alter table public.lp_codes    enable row level security;
alter table public.lp_admins   enable row level security;
alter table public.lp_attempts enable row level security;

drop policy if exists lp_codes_admin on public.lp_codes;
create policy lp_codes_admin on public.lp_codes
  for all to authenticated using (public.lp_is_admin()) with check (public.lp_is_admin());

drop policy if exists lp_admins_self on public.lp_admins;
create policy lp_admins_self on public.lp_admins
  for select to authenticated using (public.lp_is_admin());

-- O app consulta UM código por vez por esta função (não consegue listar os outros)
create or replace function public.lp_check(p_code text, p_device text, p_model text default '')
returns json language plpgsql security definer set search_path = public as $$
declare
  r lp_codes;
  a lp_attempts;
  dev text := left(coalesce(nullif(p_device, ''), 'sem-id'), 40);
begin
  select * into a from lp_attempts where device = dev;
  if a.until is not null and a.until > now() then
    return json_build_object('err', 'locked');
  end if;

  select * into r from lp_codes where code = p_code;
  if not found then
    insert into lp_attempts (device, fails) values (dev, 1)
    on conflict (device) do update
      set fails = lp_attempts.fails + 1,
          until = case when lp_attempts.fails + 1 >= 8 then now() + interval '10 minutes' end;
    update lp_attempts set fails = 0 where device = dev and until is not null;
    return json_build_object('err', 'notfound');
  end if;

  delete from lp_attempts where device = dev;

  if r.status <> 'ativo' then
    return json_build_object('err', 'blocked');
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    return json_build_object('err', 'expired', 'expires_at', r.expires_at);
  end if;
  if r.device_id is not null and r.device_id <> dev then
    return json_build_object('err', 'device');
  end if;

  update lp_codes set
    device_id    = dev,
    device_model = coalesce(device_model, left(p_model, 60)),
    activated_at = coalesce(activated_at, now()),
    last_seen    = now()
  where code = p_code;

  return json_build_object('ok', true, 'name', r.name, 'm3u', r.m3u, 'expires_at', r.expires_at);
end;
$$;

-- Trocar o servidor (DNS) em todos os links de uma vez — só admin
create or replace function public.lp_replace_dns(p_old text, p_new text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not lp_is_admin() then raise exception 'sem permissão'; end if;
  if coalesce(p_old, '') = '' or coalesce(p_new, '') = '' then return 0; end if;
  update lp_codes set m3u = replace(m3u, p_old, p_new) where position(p_old in m3u) > 0;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.lp_check(text, text, text) from public;
grant execute on function public.lp_check(text, text, text) to anon, authenticated;
revoke all on function public.lp_replace_dns(text, text) from public, anon;
grant execute on function public.lp_replace_dns(text, text) to authenticated;
grant select, insert, update, delete on public.lp_codes to authenticated;
revoke all on function public.lp_is_admin() from public, anon;
grant execute on function public.lp_is_admin() to authenticated;
revoke all on public.lp_codes, public.lp_admins, public.lp_attempts from anon;
