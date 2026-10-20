-- Run as database owner; all fixture users and setup tokens are rolled back.
begin;
do $$
declare owner_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid(); setup_code uuid:=gen_random_uuid();
begin
 if has_function_privilege('anon','public.owner_setup_valid(uuid)','execute') or
    has_function_privilege('authenticated','public.claim_owner_setup(uuid,uuid)','execute') then
   raise exception 'Clients can call owner setup helpers';
 end if;
 if has_table_privilege('authenticated','public.user_accounts','insert') or
    has_table_privilege('anon','public.user_accounts','select') then
   raise exception 'Account table grants are too broad';
 end if;
 insert into auth.users(id,email,aud,role) values(owner_id,owner_id||'@qa.invalid','authenticated','authenticated'),(outsider_id,outsider_id||'@qa.invalid','authenticated','authenticated');
 insert into private.owner_setup(token) values(setup_code);
 if not public.owner_setup_valid(setup_code) then raise exception 'Valid first-owner token rejected'; end if;
 if not public.claim_owner_setup(setup_code,owner_id) then raise exception 'Owner claim failed'; end if;
 if public.owner_setup_valid(setup_code) or public.claim_owner_setup(setup_code,outsider_id) then raise exception 'Setup token was reusable'; end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if not public.is_app_admin() then raise exception 'Owner role was not recognized'; end if;
 perform set_config('request.jwt.claim.sub',outsider_id::text,true);
 if public.is_app_admin() then raise exception 'Unrelated user has owner role'; end if;
end $$;
rollback;
