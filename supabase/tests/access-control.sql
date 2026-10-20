-- Run as the database owner in a DEVELOPMENT project after the migration.
-- All fixture users, memberships, invitations and records roll back at the end.
begin;

select set_config('remindful_test.user_a', gen_random_uuid()::text, true);
select set_config('remindful_test.user_b', gen_random_uuid()::text, true);
select set_config('remindful_test.user_c', gen_random_uuid()::text, true);
select set_config('remindful_test.subscription', gen_random_uuid()::text, true);
select set_config('remindful_test.shared_event', gen_random_uuid()::text, true);
select set_config('remindful_test.private_event', gen_random_uuid()::text, true);
select set_config('remindful_test.partner_event', gen_random_uuid()::text, true);
insert into auth.users(id, email)
select current_setting('remindful_test.' || name)::uuid,
  'remindful-test-' || current_setting('remindful_test.' || name) || '@example.invalid'
from (values ('user_a'), ('user_b'), ('user_c')) as fixtures(name);

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('remindful_test.user_a'), true);
insert into public.profiles(display_name) values ('Test A');
insert into public.user_preferences(layout, theme) values ('cards','dark');
insert into public.subscriptions(id, name, amount, cycle, renewal_date)
values (current_setting('remindful_test.subscription')::uuid, 'Private test plan', 100, 'monthly', current_date);

select set_config('remindful_test.old_code', public.create_partner_invite()::text, true);
select set_config('remindful_test.code', public.create_partner_invite()::text, true);
do $$ begin
  begin
    perform public.accept_partner_invite(current_setting('remindful_test.code')::uuid);
    raise exception 'TEST FAILED: self-invitation was accepted';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED:%' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('remindful_test.user_b'), true);
do $$ begin
  begin
    perform public.accept_partner_invite(current_setting('remindful_test.old_code')::uuid);
    raise exception 'TEST FAILED: replaced invitation was accepted';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED:%' then raise; end if;
  end;
end $$;
select set_config('remindful_test.connection',
  public.accept_partner_invite(current_setting('remindful_test.code')::uuid)::text, true);

-- Partners do not gain access to subscriptions, profiles, or preferences.
do $$ begin
  if exists (select 1 from public.subscriptions where id=current_setting('remindful_test.subscription')::uuid)
    then raise exception 'TEST FAILED: partner can read private subscription'; end if;
  if exists (select 1 from public.profiles where user_id=current_setting('remindful_test.user_a')::uuid)
    then raise exception 'TEST FAILED: partner can read owner profile'; end if;
  if exists (select 1 from public.user_preferences where user_id=current_setting('remindful_test.user_a')::uuid)
    then raise exception 'TEST FAILED: partner can read owner preferences'; end if;
  update public.subscriptions set amount=0 where id=current_setting('remindful_test.subscription')::uuid;
  if found then raise exception 'TEST FAILED: partner changed private subscription'; end if;
  begin
    insert into public.subscriptions(owner_id,name,amount,cycle,renewal_date)
      values (current_setting('remindful_test.user_a')::uuid,'Spoofed owner',0,'monthly',current_date);
    raise exception 'TEST FAILED: ownership spoof was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A creates one shared event and one private event.
select set_config('request.jwt.claim.sub', current_setting('remindful_test.user_a'), true);
insert into public.events(id, name, kind, event_date, connection_id)
values (current_setting('remindful_test.shared_event')::uuid,'Shared test','church',current_date,
  current_setting('remindful_test.connection')::uuid);
insert into public.events(id, name, kind, event_date, is_private)
values (current_setting('remindful_test.private_event')::uuid,'Private test','personal',current_date,true);

-- B can manage the shared event and add an event on A's schedule.
select set_config('request.jwt.claim.sub', current_setting('remindful_test.user_b'), true);
do $$ begin
  if not exists (select 1 from public.events where id=current_setting('remindful_test.shared_event')::uuid)
    then raise exception 'TEST FAILED: partner cannot read shared event'; end if;
  if exists (select 1 from public.events where id=current_setting('remindful_test.private_event')::uuid)
    then raise exception 'TEST FAILED: partner can read private event'; end if;
  update public.events set name='Edited by partner', created_by=auth.uid()
    where id=current_setting('remindful_test.shared_event')::uuid;
  if not found then raise exception 'TEST FAILED: partner edit failed'; end if;
  if exists (select 1 from public.events where id=current_setting('remindful_test.shared_event')::uuid
    and (created_by<>current_setting('remindful_test.user_a')::uuid or updated_by<>auth.uid()))
    then raise exception 'TEST FAILED: event attribution was forged'; end if;
end $$;
insert into public.events(id,owner_id,connection_id,name,kind,event_date)
values (current_setting('remindful_test.partner_event')::uuid,
  current_setting('remindful_test.user_a')::uuid,current_setting('remindful_test.connection')::uuid,
  'Added on partner schedule','personal',current_date);
delete from public.events where id=current_setting('remindful_test.partner_event')::uuid;
do $$ begin
  if exists (select 1 from public.events where id=current_setting('remindful_test.partner_event')::uuid)
    then raise exception 'TEST FAILED: partner delete failed'; end if;
end $$;

-- Unrelated C cannot read data, forge a shared event, or reuse the accepted code.
select set_config('request.jwt.claim.sub', current_setting('remindful_test.user_c'), true);
do $$ begin
  if exists (select 1 from public.events where id in
    (current_setting('remindful_test.shared_event')::uuid,current_setting('remindful_test.private_event')::uuid))
    then raise exception 'TEST FAILED: unrelated account can read events'; end if;
  if exists (select 1 from public.partner_memberships)
    then raise exception 'TEST FAILED: unrelated account can enumerate memberships'; end if;
  begin
    insert into public.events(owner_id,connection_id,name,kind,event_date)
      values (current_setting('remindful_test.user_a')::uuid,
        current_setting('remindful_test.connection')::uuid,'Forged event','personal',current_date);
    raise exception 'TEST FAILED: unrelated account forged an event';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_partner_invite(current_setting('remindful_test.code')::uuid);
    raise exception 'TEST FAILED: accepted code could be reused';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED:%' then raise; end if;
  end;
  begin
    insert into public.partner_memberships(user_id,connection_id)
      values (auth.uid(),current_setting('remindful_test.connection')::uuid);
    raise exception 'TEST FAILED: membership could be forged';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Disconnect immediately removes partner access without deleting the owner's event.
select set_config('request.jwt.claim.sub', current_setting('remindful_test.user_b'), true);
select public.disconnect_partner();
do $$ begin
  if exists (select 1 from public.events where id=current_setting('remindful_test.shared_event')::uuid)
    then raise exception 'TEST FAILED: former partner still has access'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('remindful_test.user_a'), true);
do $$ begin
  if not exists (select 1 from public.events where id=current_setting('remindful_test.shared_event')::uuid
    and connection_id is null)
    then raise exception 'TEST FAILED: owner lost event after disconnect'; end if;
  if not exists (select 1 from public.subscriptions where id=current_setting('remindful_test.subscription')::uuid
    and amount=100) then raise exception 'TEST FAILED: private subscription changed'; end if;
end $$;

reset role;
rollback;
