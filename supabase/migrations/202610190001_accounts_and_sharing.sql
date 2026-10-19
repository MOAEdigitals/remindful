-- Supabase foundation. Apply to a new development project before connecting the UI.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  layout text not null default 'focus' check (layout in ('focus','cards','agenda')),
  theme text not null default 'system' check (theme in ('light','dark','system')),
  notifications boolean not null default false,
  timezone text not null default 'Asia/Singapore'
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'PHP' check (currency = 'PHP'),
  cycle text not null check (cycle in ('weekly','monthly','quarterly','yearly')),
  renewal_date date not null,
  reminder_days integer not null default 3 check (reminder_days in (0,1,3,7,14,30)),
  category text not null default '' check (char_length(category) <= 60),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.partner_connections (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  disconnected_at timestamptz
);

-- A user can have at most one active partner connection.
create table public.partner_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  connection_id uuid not null references public.partner_connections(id) on delete cascade
);
create index partner_memberships_connection_idx on public.partner_memberships(connection_id);

-- Codes are not exposed through the Data API. Only the creator receives the code.
create table private.partner_invites (
  code uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  consumed_at timestamptz,
  revoked_at timestamptz
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  connection_id uuid references public.partner_connections(id),
  applies_to_both boolean not null default false,
  is_private boolean not null default false,
  kind text not null check (kind in ('birthdays','church','personal')),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  event_date date not null,
  event_time time,
  repeat text not null default 'once' check (repeat in ('once','weekly','monthly','yearly')),
  reminder_days integer not null default 3 check (reminder_days in (0,1,3,7,14,30)),
  location text not null default '' check (char_length(location) <= 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  completed boolean not null default false,
  created_by uuid not null references auth.users(id) default auth.uid(),
  updated_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_private or (connection_id is null and not applies_to_both)),
  check (not applies_to_both or connection_id is not null),
  check (kind <> 'birthdays' or repeat = 'yearly')
);
create index subscriptions_owner_date_idx on public.subscriptions(owner_id, renewal_date);
create index events_owner_date_idx on public.events(owner_id, event_date);
create index events_connection_date_idx on public.events(connection_id, event_date);

create function private.current_connection() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.connection_id from public.partner_memberships m
  join public.partner_connections c on c.id = m.connection_id
  where m.user_id = (select auth.uid()) and c.disconnected_at is null;
$$;

create function private.can_write_event(event_owner uuid, connection uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (event_owner = (select auth.uid()) and connection is null)
    or (connection is not null and connection = private.current_connection()
      and exists (select 1 from public.partner_memberships m
        where m.user_id = event_owner and m.connection_id = connection));
$$;

create function private.stamp_changes() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  if tg_table_name = 'events' then
    if tg_op = 'INSERT' then new.created_by := auth.uid();
    else new.created_by := old.created_by; end if;
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger subscriptions_stamp before insert or update on public.subscriptions
for each row execute function private.stamp_changes();
create trigger events_stamp before insert or update on public.events
for each row execute function private.stamp_changes();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.subscriptions enable row level security;
alter table public.partner_connections enable row level security;
alter table public.partner_memberships enable row level security;
alter table public.events enable row level security;
alter table private.partner_invites enable row level security;

create policy profiles_owner on public.profiles to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy preferences_owner on public.user_preferences to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy subscriptions_owner on public.subscriptions to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy connection_read on public.partner_connections for select to authenticated
using (id = (select private.current_connection()));
create policy memberships_read on public.partner_memberships for select to authenticated
using (connection_id = (select private.current_connection()));
create policy events_read on public.events for select to authenticated
using (owner_id = (select auth.uid()) or
  (not is_private and connection_id = (select private.current_connection())));
create policy events_insert on public.events for insert to authenticated
with check (created_by = (select auth.uid()) and private.can_write_event(owner_id, connection_id));
create policy events_update on public.events for update to authenticated
using (owner_id = (select auth.uid()) or
  (not is_private and connection_id = (select private.current_connection())))
with check (private.can_write_event(owner_id, connection_id));
create policy events_delete on public.events for delete to authenticated
using (owner_id = (select auth.uid()) or
  (not is_private and connection_id = (select private.current_connection())));

-- Pairing requires a user-generated code, explicit acceptance, and two unpaired users.
create function public.create_partner_invite() returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(71920261019);
  if private.current_connection() is not null then raise exception 'Already connected'; end if;
  update private.partner_invites set revoked_at = now()
    where inviter_id = auth.uid() and consumed_at is null and revoked_at is null;
  insert into private.partner_invites(inviter_id) values (auth.uid()) returning code into result;
  return result;
end;
$$;

create function public.accept_partner_invite(invite_code uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation private.partner_invites%rowtype; connection uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(71920261019);
  select * into invitation from private.partner_invites where code = invite_code for update;
  if not found or invitation.consumed_at is not null or invitation.revoked_at is not null
    or invitation.expires_at <= now() then raise exception 'Invalid or expired invitation'; end if;
  if invitation.inviter_id = auth.uid() then raise exception 'Cannot accept your own invitation'; end if;
  if exists (select 1 from public.partner_memberships where user_id in (auth.uid(), invitation.inviter_id))
    then raise exception 'One account is already connected'; end if;
  insert into public.partner_connections(created_by) values (invitation.inviter_id) returning id into connection;
  insert into public.partner_memberships(user_id, connection_id)
    values (invitation.inviter_id, connection), (auth.uid(), connection);
  update private.partner_invites set consumed_at = now() where code = invite_code;
  update private.partner_invites set revoked_at = now()
    where inviter_id in (auth.uid(), invitation.inviter_id) and consumed_at is null and revoked_at is null;
  return connection;
end;
$$;

create function public.disconnect_partner() returns void
language plpgsql security definer set search_path = '' as $$
declare connection uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(71920261019);
  connection := private.current_connection();
  if connection is null then return; end if;
  -- Existing shared events stay with their owners. Disconnect removes partner access.
  update public.events set connection_id = null, applies_to_both = false where connection_id = connection;
  delete from public.partner_memberships where connection_id = connection;
  update public.partner_connections set disconnected_at = now() where id = connection;
end;
$$;

create function public.revoke_partner_invite(invite_code uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  update private.partner_invites set revoked_at = now()
    where code = invite_code and inviter_id = auth.uid() and consumed_at is null;
end;
$$;

-- Explicit privileges: browser clients cannot manufacture memberships or connections.
revoke all on public.profiles, public.user_preferences, public.subscriptions,
  public.events, public.partner_connections, public.partner_memberships from anon;
revoke all on public.profiles, public.user_preferences, public.subscriptions,
  public.events, public.partner_connections, public.partner_memberships from authenticated;
grant select, insert, update, delete on public.profiles, public.user_preferences,
  public.subscriptions, public.events to authenticated;
grant select on public.partner_connections, public.partner_memberships to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_connection(), private.can_write_event(uuid,uuid) to authenticated;
revoke all on function public.create_partner_invite(), public.accept_partner_invite(uuid),
  public.disconnect_partner(), public.revoke_partner_invite(uuid) from public, anon;
grant execute on function public.create_partner_invite(), public.accept_partner_invite(uuid),
  public.disconnect_partner(), public.revoke_partner_invite(uuid) to authenticated;

commit;
