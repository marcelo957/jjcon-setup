# Supabase setup

Run these in order, once each, in Supabase → **SQL Editor** → **New query** → paste → **Run**:

1. `01_tables.sql` — the eight tables (people, sectors, content blocks, material items, tasks,
   steps, information rows, photo entries). Row level security is on for all of them with no
   rules yet, so nothing can be read or changed through the public key until step 5.
2. `02_demo_data.sql` — the demo's 5 people and 27 sectors (25 active, 2 archived) with their
   plans, lists, steps and task deadlines. Generated from the app's demo data by
   `app/src/supabase/demoSql.ts`.

3. `03_logins.sql` — step 4a, logins. Links each Supabase login to a person on the People list
   (by email) with a role: admin, editor or crew. The first login linked becomes admin. Adds
   the functions the app calls for "who am I" and for the People page's login list, role
   changes, withdrawing unused invitations and signing someone out everywhere (admins only).
   Run it before creating the first user.

All scripts run inside a transaction: if anything fails, nothing is left half-created.
Running `01_tables.sql` a second time stops with "relation already exists" and changes nothing.

Task done / not done is deliberately not stored: the app works it out from what exists.
