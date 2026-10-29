-- JJCON SetUp · set every sector's build status back to "Not started"
-- Run once, in Supabase → SQL Editor → New query → paste → Run.
--
-- The demo gave some sectors "In progress" or "Complete" (the physical build on site).
-- 10_clear_sector_content.sql left that as it was. One row comes back: sectors not "Not started" (should be 0).

update sectors set build_status = 'none' where build_status <> 'none';

select count(*) as not_reset from sectors where build_status <> 'none';
