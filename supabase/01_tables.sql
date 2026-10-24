-- JJCON SetUp · step 2 · tables
-- Run once, in Supabase → SQL Editor → New query → paste → Run.
-- Creates the tables for what the app already holds. Safe to read before running:
-- nothing here deletes or changes data that already exists.
--
-- Ids are text so the demo data keeps the app's own ids (e.g. 'p-diego', 'customer');
-- new rows get a random id automatically.
--
-- Row level security is switched ON for every table, with no rules yet: until step 5 adds
-- the rules, nobody can read or change these tables through the app's public (anon) key.

begin;

-- 1. People: everyone who can own a sector or a task.
create table people (
  id              text primary key default gen_random_uuid()::text,
  name            text not null,
  job_title       text not null default '',
  email           text,
  active          boolean not null default true,
  deactivated_at  timestamptz,
  deactivated_by  text references people (id) on delete set null,
  added_inline_at timestamptz,            -- added by name only, from an assignment field
  created_at      timestamptz not null default now()
);
create unique index people_email_unique on people (lower(email)) where email is not null and email <> '';

-- 2. Sectors.
create table sectors (
  id                 text primary key default gen_random_uuid()::text,
  name               text not null default '',
  sector_group       text not null check (sector_group in ('ibjjf', 'third', 'ops')),  -- IBJJF Sectors, Third Party Services, Operations
  lead_id            text references people (id) on delete set null,
  owner_id           text references people (id) on delete set null,
  location           text not null default '',
  build_day          date not null,
  window_from        time not null,
  window_to          time not null,
  build_status       text not null default 'none' check (build_status in ('none', 'progress', 'complete')),
  no_floorplans      boolean not null default false,  -- staff-type sectors that need no floorplan
  archived_at        timestamptz,
  archived_by        text references people (id) on delete set null,
  archive_reason     text,
  related_sector_id  text references sectors (id) on delete set null,
  related_text       text,                -- "Bags are filled at the"
  related_tail       text,                -- " in room 208. …"
  packet_printed_at  timestamptz,
  content_changed_at timestamptz,
  created_at         timestamptz not null default now()
);
create index sectors_lead on sectors (lead_id);
create index sectors_owner on sectors (owner_id);

-- 3. Content blocks: every floorplan and block that belongs to a sector.
--    slot: 'plan:G' 'plan:A' 'plan:B' 'plan:C' 'plan:D' for the five floorplans;
--          'mainMat' 'netMat' 'instr' 'install' 'info' 'link' for the standard blocks;
--          the block's own id for custom blocks.
create table content_blocks (
  id                 text primary key default gen_random_uuid()::text,
  sector_id          text not null references sectors (id) on delete cascade,
  slot               text not null,
  kind               text not null check (kind in (
                       'floorplan', 'main_materials', 'network_list', 'instructions', 'installation', 'information', 'external_link',
                       'custom_pdf', 'custom_checklist', 'custom_text', 'custom_gallery', 'custom_link')),
  plan_key           text check (plan_key in ('G', 'A', 'B', 'C', 'D')),
  name               text,                -- custom blocks only
  is_on              boolean not null default false,   -- floorplans: required for this sector
  position           integer not null default 0,
  -- links
  link_label         text,
  link_url           text,
  -- checklists
  footnote           text,
  -- floorplans and PDF blocks: the uploaded file (the file itself goes to Storage in step 3)
  file_path          text,
  file_name          text,
  file_size          bigint,
  file_pages         integer,
  file_uploaded_at   timestamptz,
  file_uploaded_by   text references people (id) on delete set null,
  file_replaced_uploaded_at timestamptz,  -- when the file this one replaced was uploaded
  -- who last changed the content, and the optional Final lock
  edited_by          text references people (id) on delete set null,
  edited_at          timestamptz,
  final_by           text references people (id) on delete set null,
  final_at           timestamptz,
  unlocked_by        text references people (id) on delete set null,
  unlocked_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (sector_id, slot),
  check ((kind = 'floorplan') = (plan_key is not null))
);

-- 4. Material items: lines of a material list, network list or checklist.
create table material_items (
  id        text primary key default gen_random_uuid()::text,
  block_id  text not null references content_blocks (id) on delete cascade,
  position  integer not null default 0,
  item      text not null default '',
  quantity  integer not null default 0 check (quantity >= 0),
  note      text,
  arrived   boolean not null default false   -- ticked on site
);
create index material_items_block on material_items (block_id, position);

-- 5. Tasks: one per required floorplan and switched-on block. Done / not done is NOT stored:
--    the app works it out from what exists (file uploaded, content written).
create table tasks (
  id             text primary key default gen_random_uuid()::text,
  block_id       text not null unique references content_blocks (id) on delete cascade,
  due_date       date,                    -- empty: the standard lead time before build day
  responsible_id text references people (id) on delete set null,  -- empty: sector owner (lead for instructions/installation)
  unassigned     boolean not null default false,                  -- explicitly nobody
  note_text      text,                    -- delay note
  note_by        text references people (id) on delete set null,
  note_at        timestamptz,
  updated_by     text references people (id) on delete set null,
  updated_at     timestamptz,
  check (not (unassigned and responsible_id is not null))
);

-- 6. Instruction steps: Instructions, Installation and custom Text blocks.
create table steps (
  id        text primary key default gen_random_uuid()::text,
  block_id  text not null references content_blocks (id) on delete cascade,
  position  integer not null default 0,
  text      text not null default '',
  finished  boolean not null default false   -- ticked on site
);
create index steps_block on steps (block_id, position);

-- 7. Information rows: label and value pairs.
create table info_rows (
  id        text primary key default gen_random_uuid()::text,
  block_id  text not null references content_blocks (id) on delete cascade,
  position  integer not null default 0,
  label     text not null default '',
  value     text not null default ''
);
create index info_rows_block on info_rows (block_id, position);

-- 8. Photo entries: title and caption of each entry in a photo set.
create table photo_entries (
  id        text primary key default gen_random_uuid()::text,
  block_id  text not null references content_blocks (id) on delete cascade,
  position  integer not null default 0,
  title     text not null default '',
  caption   text not null default ''
);
create index photo_entries_block on photo_entries (block_id, position);

-- Closed until step 5 writes the rules.
alter table people         enable row level security;
alter table sectors        enable row level security;
alter table content_blocks enable row level security;
alter table material_items enable row level security;
alter table tasks          enable row level security;
alter table steps          enable row level security;
alter table info_rows      enable row level security;
alter table photo_entries  enable row level security;

commit;
