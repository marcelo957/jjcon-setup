-- JJCON SetUp · leads set their sector's build status
-- Run once, in Supabase → SQL Editor → New query → paste → Run (after 07_checkoff_scope.sql).
--
-- The build status (Not started, In progress, Complete) can now be set in the app by admins on every
-- sector, and by editors and crew on sectors they lead or own. This lets the database save it for them.

begin;

create or replace function public.guard_sectors() returns trigger
language plpgsql as $$
declare allowed text[] := array['packet_printed_at'];
begin
  if not public.by_app_user() or public.my_role() = 'admin' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and exists (select 1 from sectors where id = new.id) then return new; end if;
  if tg_op = 'UPDATE' then
    if public.can_edit_sector(old.id) then allowed := allowed || array['content_changed_at', 'no_floorplans']; end if;
    if public.leads_sector(old.id) then allowed := allowed || array['build_status']; end if;
    return public.keep_only(new, old, allowed);
  end if;
  perform public.refuse('Only an admin can create or delete sectors.');
  return null;
end $$;

commit;
