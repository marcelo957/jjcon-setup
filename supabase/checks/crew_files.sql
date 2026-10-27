-- Check: what the newest crew login sees of the floorplans bucket. Read-only; it changes nothing.
-- Supabase → SQL Editor → New query → paste → Run. One row comes back.

create or replace function pg_temp.crew_files_check()
returns table (files_in_bucket bigint, file_paths text, checked_as text, crew_counts_as_member boolean,
               files_crew_is_told_about bigint, where_crew_sees_them text)
language plpgsql as $$
declare uid text := (select a.user_id::text from accounts a where a.role = 'crew' order by a.created_at desc limit 1);
begin
  -- Look through the crew member's eyes for this one query.
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  return query select
    (select count(*) from storage.objects o where o.bucket_id = 'floorplans'),
    (select string_agg(o.name, '  |  ' order by o.created_at desc) from storage.objects o where o.bucket_id = 'floorplans'),
    (select p.name || ' · ' || a.role || ' · ' || case when p.active then 'active' else 'INACTIVE' end
       from accounts a join people p on p.id = a.person_id where a.user_id::text = uid),
    public.is_member(),
    (select count(*) from public.stored_files()),
    (select string_agg(f.sector_id || ' / ' || f.slot, ', ') from public.stored_files() f);
end $$;

select * from pg_temp.crew_files_check();
