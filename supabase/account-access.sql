-- Username accounts are provisioned by the owner, never by public sign-up.
begin;
create table private.app_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table private.owner_setup(token uuid primary key, expires_at timestamptz not null default now()+interval '1 day', claimed_at timestamptz);
alter table private.app_admins enable row level security;
alter table private.owner_setup enable row level security;
revoke all on private.app_admins,private.owner_setup from public,anon,authenticated;
create table public.user_accounts(user_id uuid primary key references auth.users(id) on delete cascade, username text unique not null check(username ~ '^[a-z0-9_]{3,30}$'));
alter table public.user_accounts enable row level security;
revoke all on public.user_accounts from public,anon,authenticated;
grant select on public.user_accounts to authenticated;
create policy account_self_read on public.user_accounts for select to authenticated using(user_id=(select auth.uid()));
create function private.is_app_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.app_admins where user_id=(select auth.uid()));$$;
revoke all on function private.is_app_admin() from public,anon;
grant execute on function private.is_app_admin() to authenticated;
create function public.is_app_admin() returns boolean language sql stable security invoker set search_path='' as $$select private.is_app_admin();$$;
revoke all on function public.is_app_admin() from public,anon;
grant execute on function public.is_app_admin() to authenticated;
create function public.owner_setup_valid(setup_token uuid) returns boolean language sql security definer set search_path='' as $$select not exists(select 1 from private.app_admins) and exists(select 1 from private.owner_setup where token=setup_token and claimed_at is null and expires_at>now());$$;
create function public.claim_owner_setup(setup_token uuid, account_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 perform pg_catalog.pg_advisory_xact_lock(2026102001);
 if not public.owner_setup_valid(setup_token) then return false; end if;
 insert into private.app_admins values(account_id);
 update private.owner_setup set claimed_at=now() where token=setup_token;
 return true;
end;$$;
revoke all on function public.owner_setup_valid(uuid),public.claim_owner_setup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.owner_setup_valid(uuid),public.claim_owner_setup(uuid,uuid) to service_role;
-- Service-only setup routines are moved outside the exposed schema; narrow wrappers remain.
alter function public.owner_setup_valid(uuid) set schema private;
alter function public.claim_owner_setup(uuid,uuid) set schema private;
-- Rewrite the claim reference after moving its dependency.
create or replace function private.claim_owner_setup(setup_token uuid, account_id uuid) returns boolean language plpgsql security definer set search_path='' as $$begin
 perform pg_catalog.pg_advisory_xact_lock(2026102001);
 if not private.owner_setup_valid(setup_token) then return false; end if;
 insert into private.app_admins values(account_id);
 update private.owner_setup set claimed_at=now() where token=setup_token;
 return true;
end;$$;
create function public.owner_setup_valid(setup_token uuid) returns boolean language sql security invoker set search_path='' as $$select private.owner_setup_valid(setup_token);$$;
create function public.claim_owner_setup(setup_token uuid,account_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.claim_owner_setup(setup_token,account_id);$$;
revoke all on function public.owner_setup_valid(uuid),public.claim_owner_setup(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function public.owner_setup_valid(uuid),public.claim_owner_setup(uuid,uuid),private.owner_setup_valid(uuid),private.claim_owner_setup(uuid,uuid) to service_role;
create policy admins_no_client_access on private.app_admins to authenticated using(false) with check(false);
create policy setup_no_client_access on private.owner_setup to authenticated using(false) with check(false);
grant select,insert,update,delete on public.user_accounts,public.profiles to service_role;
commit;
