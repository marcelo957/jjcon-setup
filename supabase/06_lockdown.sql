-- JJCON SetUp · step 5 · lock it down: the database itself enforces who may change what
-- Run once, in Supabase → SQL Editor → New query → paste → Run (after 05_data_access.sql).
--
-- Until now the app decided what each role may change. These rules make the database decide too,
-- so they hold even for someone who goes around the app with the public key and their own login.
--
--   Everyone signed in and active   sees everything; ticks material lines, checklist lines and steps;
--                                   marks the print packets printed
--   Their own tasks                 delay note; Mark final / unlock; editors (not crew) also the deadline
--   Editors, on sectors they lead   upload and remove PDFs, write lists, steps and information,
--   or own                          choose which floorplans the sector needs
--   Admins                          everything: people, sectors and their structure, reassigning tasks
--
-- What happens to a change someone isn't allowed to make:
--   * adding or deleting a row      refused, with a plain message the app shows
--   * changing a row they may only  the database keeps the original value of anything they may not
--     partly change                 change (a crew tick saves; a crew edit of the item's name doesn't)
--
-- Supabase's own tools (this SQL Editor, the invite function) are not limited by these rules.

begin;

-- Who is asking: their person and role, only while that person is active.
create function public.my_person() returns text
language sql stable security definer set search_path = public as $$
  select a.person_id from accounts a join people p on p.id = a.person_id where a.user_id = auth.uid() and p.active;
$$;

create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select a.role from accounts a join people p on p.id = a.person_id where a.user_id = auth.uid() and p.active;
$$;

-- The person responsible for a floorplan or block's task, the same way the app works it out:
-- whoever the task was given to; otherwise the sector's lead for instructions and installation,
-- and the sector's owner for everything else. Nobody when it was set to unassigned.
create function public.block_owner(bid text) returns text
language sql stable security definer set search_path = public as $$
  select case when t.unassigned then null
              when t.responsible_id is not null then t.responsible_id
              when b.kind in ('instructions', 'installation') then s.lead_id
              else s.owner_id end
  from content_blocks b join sectors s on s.id = b.sector_id left join tasks t on t.block_id = b.id
  where b.id = bid;
$$;

create function public.block_sector(bid text) returns text
language sql stable security definer set search_path = public as $$
  select sector_id from content_blocks where id = bid;
$$;

-- `n` with every column except `allowed` put back as it was in `o`.
create function public.keep_only(n anyelement, o anyelement, allowed text[]) returns anyelement
language sql immutable as $$
  select jsonb_populate_record(n, to_jsonb(o) - allowed);
$$;

-- The rules apply to signed-in app users. Supabase's own tools run as other database roles.
create function public.by_app_user() returns boolean
language sql stable as $$ select current_user = 'authenticated' $$;

create function public.refuse(what text) returns void
language plpgsql as $$
begin
  raise exception '%', what using errcode = '42501';
end $$;

-- An upsert of a row that already exists arrives as an insert first; it's judged as the update it becomes.
-- (Each guard below checks "does this id exist" for that.)

-- People: admins only. Everyone can still confirm their own name (set_my_name).
create function public.guard_people() returns trigger
language plpgsql as $$
begin
  if not public.by_app_user() or public.my_role() = 'admin' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and exists (select 1 from people where id = new.id) then return new; end if;
  if tg_op = 'UPDATE' then return public.keep_only(new, old, '{}'); end if;
  perform public.refuse('Only an admin can add or remove people.');
  return null;
end $$;

-- Sectors: admins create, change, archive and delete them. Anyone can mark a packet printed;
-- a sector's editors change what follows from editing its content.
create function public.guard_sectors() returns trigger
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

-- Floorplans and blocks: admins add and remove them. A sector's editors change their content;
-- the person responsible for a task can mark it final or unlock it.
create function public.guard_content_blocks() returns trigger
language plpgsql as $$
declare allowed text[] := '{}';
begin
  if not public.by_app_user() or public.my_role() = 'admin' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and exists (select 1 from content_blocks where id = new.id) then return new; end if;
  if tg_op = 'UPDATE' then
    if public.can_edit_sector(old.sector_id) then
      allowed := array['link_label', 'link_url', 'footnote',
        'file_path', 'file_name', 'file_size', 'file_pages', 'file_uploaded_at', 'file_uploaded_by', 'file_replaced_uploaded_at',
        'edited_by', 'edited_at', 'final_by', 'final_at', 'unlocked_by', 'unlocked_at'];
      if old.kind = 'floorplan' then allowed := allowed || array['is_on']; end if;   -- which plans the sector needs
    end if;
    if public.block_owner(old.id) = public.my_person() then
      allowed := allowed || array['final_by', 'final_at', 'unlocked_by', 'unlocked_at'];
    end if;
    return public.keep_only(new, old, allowed);
  end if;
  perform public.refuse('Only an admin can add or remove a sector''s floorplans and blocks.');
  return null;
end $$;

-- Lines of lists, steps, information rows and photo entries: a sector's editors write them.
-- Anyone can tick a line or a step (the column named in the trigger, if any).
create function public.guard_block_rows() returns trigger
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
  if tg_op = 'UPDATE' then return public.keep_only(new, old, case when tick is null then '{}'::text[] else array[tick] end); end if;
  perform public.refuse('Only an admin or this sector''s editor can add or remove lines.');
  return null;
end $$;

-- Tasks: admins decide deadlines and who is responsible. The responsible person writes the delay
-- note, and an editor also moves their own deadline. Nobody hands their task to someone else.
create function public.guard_tasks() returns trigger
language plpgsql as $$
declare
  me text := public.my_person();
  allowed text[] := array['note_text', 'note_by', 'note_at', 'updated_by', 'updated_at'];
begin
  if not public.by_app_user() or public.my_role() = 'admin' then return coalesce(new, old); end if;
  if public.my_role() = 'editor' then allowed := allowed || array['due_date']; end if;
  if tg_op = 'INSERT' then
    if exists (select 1 from tasks where id = new.id) then return new; end if;
    if public.block_owner(new.block_id) = me then
      -- A first note or deadline on their own task: everything else starts as the default.
      new.responsible_id := null;
      new.unassigned := false;
      if public.my_role() <> 'editor' then new.due_date := null; end if;
      return new;
    end if;
  end if;
  if tg_op = 'UPDATE' then
    return public.keep_only(new, old, case when public.block_owner(old.block_id) = me then allowed else '{}'::text[] end);
  end if;
  perform public.refuse('Only an admin can change someone else''s task.');
  return null;
end $$;

create trigger guard before insert or update or delete on people         for each row execute function public.guard_people();
create trigger guard before insert or update or delete on sectors        for each row execute function public.guard_sectors();
create trigger guard before insert or update or delete on content_blocks for each row execute function public.guard_content_blocks();
create trigger guard before insert or update or delete on material_items for each row execute function public.guard_block_rows('arrived');
create trigger guard before insert or update or delete on steps          for each row execute function public.guard_block_rows('finished');
create trigger guard before insert or update or delete on info_rows      for each row execute function public.guard_block_rows('-');
create trigger guard before insert or update or delete on photo_entries  for each row execute function public.guard_block_rows('-');
create trigger guard before insert or update or delete on tasks          for each row execute function public.guard_tasks();

revoke all on function public.my_person(), public.my_role(), public.block_owner(text), public.block_sector(text) from public, anon;
grant execute on function public.my_person(), public.my_role(), public.block_owner(text), public.block_sector(text) to authenticated;

commit;
