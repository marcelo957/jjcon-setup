-- JJCON SetUp · empty every sector's content, keep the sectors
-- Run once, in Supabase → SQL Editor → New query → paste → Run. It can't be undone.
--
-- Clears, on every sector:
--   * PDFs: floorplan files and PDF blocks, including the demo drawings (see Storage below)
--   * material lists: main material list, computers & network list, custom checklists and their footnotes
--   * instructions: instruction steps, installation steps, custom text blocks
--   * information rows and photo entries
--   * tasks: deadlines, people assigned and delay notes go back to the defaults
--   * who last edited each block, the Final locks, and the "packet printed" marks
-- Keeps the sectors themselves (name, group, lead, owner, location, build day and times), which
-- floorplans and blocks each one needs, external links, people and logins.
--
-- Storage: PDF files uploaded to Supabase Storage are not deleted by this script. One row comes back;
-- if pdfs_left_in_storage isn't 0, open Storage → floorplans and delete the folders there,
-- or the app will keep showing those files as uploaded.

begin;

delete from material_items;
delete from steps;
delete from info_rows;
delete from photo_entries;
delete from tasks;

update content_blocks set
  footnote = null,
  file_path = null, file_name = null, file_size = null, file_pages = null,
  file_uploaded_at = null, file_uploaded_by = null, file_replaced_uploaded_at = null,
  edited_by = null, edited_at = null, final_by = null, final_at = null, unlocked_by = null, unlocked_at = null;

update sectors set packet_printed_at = null, content_changed_at = now();

commit;

select
  (select count(*) from sectors)                                          as sectors_kept,
  (select count(*) from material_items) + (select count(*) from steps)
    + (select count(*) from info_rows) + (select count(*) from photo_entries) as lines_left,
  (select count(*) from content_blocks where file_path is not null)       as pdfs_left_in_app,
  (select count(*) from storage.objects o where o.bucket_id = 'floorplans'
     and o.name !~ '/\.[^/]*$')                                           as pdfs_left_in_storage;
