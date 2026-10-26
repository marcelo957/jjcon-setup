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

4. `04_storage.sql` — step 3, file storage. A private Storage bucket `floorplans` (PDF only,
   50 MB each), files kept as `<sector>/<plan-G | plan-A | … | custom block id>/<file>.pdf`.
   Anyone signed in and active can view; admins, and editors on the sectors they lead or own, can
   upload and delete. `stored_files()` tells the app what exists, so plan status follows Storage:
   a deleted file (even one deleted from the dashboard) makes that plan outstanding again.
5. `functions/invite/index.ts` — step 4b, the **invite** Edge Function the People page calls to
   send (or re-send) an invitation. Deploy it in Supabase → Edge Functions → Deploy a new function
   → Via Editor, named `invite`, with "Verify JWT" left on. Only an active admin can use it; it
   replaces an unused invitation but never touches a login that has been used.
6. `email/invite.html` and `email/reset-password.html` — optional wording for Supabase's
   "Invite user" and "Reset password" email templates (Authentication → Emails).

All scripts run inside a transaction: if anything fails, nothing is left half-created.
Running `01_tables.sql` a second time stops with "relation already exists" and changes nothing.

Task done / not done is deliberately not stored: the app works it out from what exists.
