-- JJCON SetUp · clear the demo sectors, to start the real event from empty
-- Run once, in Supabase → SQL Editor → New query → paste → Run. It can't be undone.
--
-- Deletes the 27 demo sectors and everything in them: their floorplans and blocks, list lines,
-- steps, information rows, photo entries and task deadlines. Sectors you added yourself (any other
-- id) are left alone, and so are people and logins.
--
-- One row comes back: how many sectors were removed, how many are left, and how many PDF files
-- are still in Storage for the removed sectors (delete those in Storage → floorplans if any).

begin;

create temporary table demo_ids (id text primary key) on commit drop;
insert into demo_ids values
  ('store'), ('ent-spec'), ('customer'), ('seminar'), ('crown'), ('goodie-booth'), ('pod-wm'), ('pod-jjc'), ('ent-bb'),
  ('ent-mak'), ('champ-wm'), ('champ-jjc'), ('square'), ('rooms'), ('carpet'), ('pipe'), ('bleachers'), ('led'), ('power'),
  ('internet'), ('truss'), ('truck'), ('staff'), ('bagline'), ('sponsors'), ('crates'), ('sponsor-sign');

with gone as (delete from sectors where id in (select id from demo_ids) returning id)
select
  (select count(*) from gone)                                    as sectors_removed,
  (select count(*) from sectors where id not in (select id from gone)) as sectors_left,
  (select count(*) from storage.objects o
     where o.bucket_id = 'floorplans' and (storage.foldername(o.name))[1] in (select id from demo_ids)
       and o.name !~ '/\.[^/]*$')                               as demo_pdfs_left_in_storage;

commit;
