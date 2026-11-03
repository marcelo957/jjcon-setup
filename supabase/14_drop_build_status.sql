-- JJCON SetUp · remove the old hand-set sector status
-- Run once, in Supabase → SQL Editor → New query → paste → Run, AFTER the app update in which a
-- sector's status is worked out from its content (the app then no longer reads or writes this field).
--
-- Deletes the sectors.build_status field, so nobody can set a status by hand any more, not even
-- around the app, and takes it out of what a sector's lead may change.
-- (11_reset_build_status.sql and 12_build_status.sql are not needed after this.)

begin;

create or replace function public.guard_sectors() returns trigger
language plpgsql as $$
declare allowed text[] := array['packet_printed_at'];
begin
  if not public.by_app_user() or public.my_role() = 'admin' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and exists (select 1 from sectors where id = new.id) then return new; end if;
  if tg_op = 'UPDATE' then
    if public.can_edit_sector(old.id) then allowed := allowed || array['content_changed_at', 'no_floorplans']; end if;
    return public.keep_only(new, old, allowed);
  end if;
  perform public.refuse('Only an admin can create or delete sectors.');
  return null;
end $$;

alter table sectors drop column build_status;

commit;

select count(*) as sectors from sectors;
