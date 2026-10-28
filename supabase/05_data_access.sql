-- JJCON SetUp · the data switch · team members can read and save the app's data
-- Run once, in Supabase → SQL Editor → New query → paste → Run (after 04_storage.sql).
--
-- Until now the eight tables from step 1 were closed to everyone. This opens them to people who are
-- signed in AND whose person on the People list is active (is_member(), from 04_storage.sql):
--   * signed in and active      read and save
--   * deactivated               nothing: the tables look empty
--   * not signed in (public key only)   nothing
--
-- What each role may change (crew only ticks and their own tasks, editors only their sectors) is still
-- checked by the app. Step 5 moves those rules into the database too, replacing these policies.

begin;

grant select, insert, update, delete on
  people, sectors, content_blocks, material_items, tasks, steps, info_rows, photo_entries
  to authenticated;

create policy "team members: data switch" on people         for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "team members: data switch" on sectors        for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "team members: data switch" on content_blocks for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "team members: data switch" on material_items for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "team members: data switch" on tasks          for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "team members: data switch" on steps          for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "team members: data switch" on info_rows      for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "team members: data switch" on photo_entries  for all to authenticated using (public.is_member()) with check (public.is_member());

commit;

-- Check: the row counts every signed-in team member now sees.
select
  (select count(*) from people)         as people,
  (select count(*) from sectors)        as sectors,
  (select count(*) from content_blocks) as blocks,
  (select count(*) from tasks)          as tasks;
