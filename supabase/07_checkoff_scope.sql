-- JJCON SetUp · ticks only on your own sectors
-- Run once, in Supabase → SQL Editor → New query → paste → Run (after 06_lockdown.sql).
--
-- Ticking material lines, checklist lines and instruction steps was open to everyone signed in.
-- Now: admins tick on every sector; editors and crew only on sectors they lead or own.
-- A tick on any other sector isn't saved; the database keeps the line as it was.

begin;

-- The signed-in person leads or owns this sector (and is active).
create function public.leads_sector(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from sectors s where s.id = sid and public.my_person() in (s.lead_id, s.owner_id));
$$;

create or replace function public.guard_block_rows() returns trigger
language plpgsql as $$
declare
  tick text := nullif(tg_argv[0], '-');
  found boolean;
begin
  if not public.by_app_user() then return coalesce(new, old); end if;
  if tg_op <> 'INSERT' and public.can_edit_sector(public.block_sector(old.block_id))
     and (tg_op = 'DELETE' or public.can_edit_sector(public.block_sector(new.block_id))) then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    execute format('select exists (select 1 from %I where id = $1)', tg_table_name) into found using new.id;
    if found then return new; end if;
    if public.can_edit_sector(public.block_sector(new.block_id)) then return new; end if;
  end if;
  if tg_op = 'UPDATE' then
    -- Only the tick may change, and only on a sector they lead or own.
    return public.keep_only(new, old,
      case when tick is not null and public.leads_sector(public.block_sector(old.block_id)) then array[tick] else '{}'::text[] end);
  end if;
  perform public.refuse('Only an admin or this sector''s editor can add or remove lines.');
  return null;
end $$;

revoke all on function public.leads_sector(text) from public, anon;
grant execute on function public.leads_sector(text) to authenticated;

commit;
