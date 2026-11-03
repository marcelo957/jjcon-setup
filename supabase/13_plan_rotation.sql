-- JJCON SetUp · rotate a plan in the viewer, for everyone
-- Run once, in Supabase → SQL Editor → New query → paste → Run (after 12_build_status.sql),
-- BEFORE the app update that adds the rotate button goes live.
--
-- Adds file_rotation to each floorplan and PDF block: how many degrees clockwise (0, 90, 180, 270)
-- the plan is turned when shown. It's display only; the PDF in Storage is never changed.
-- Anyone signed in can turn a plan (it's how the plan is shown, not what's in it).

begin;

alter table content_blocks
  add column file_rotation integer not null default 0 check (file_rotation in (0, 90, 180, 270));

create or replace function public.guard_content_blocks() returns trigger
language plpgsql as $$
declare allowed text[] := array['file_rotation'];
begin
  if not public.by_app_user() or public.my_role() = 'admin' then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and exists (select 1 from content_blocks where id = new.id) then return new; end if;
  if tg_op = 'UPDATE' then
    if public.can_edit_sector(old.sector_id) then
      allowed := allowed || array['link_label', 'link_url', 'footnote',
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

commit;

select count(*) as plans_and_pdf_blocks from content_blocks where kind in ('floorplan', 'custom_pdf');
