-- JJCON SetUp · step 3 · file storage for floorplans and PDF sheets
-- Run once, in Supabase → SQL Editor → New query → paste → Run (after 03_logins.sql).
--
-- Creates a private Storage bucket, "floorplans", for PDFs only (up to 50 MB each). Files are
-- kept per sector and plan:  <sector id>/<plan-G | plan-A | … | custom block id>/<file>.pdf
--
-- Storage is the record of which plans have a file. The app asks stored_files() what exists, so
-- an upload shows for everyone and a deleted file (even one deleted from this dashboard) turns
-- that plan back to "not done" for everyone.
--
-- Who can do what with the files:
--   view / download   anyone signed in whose person is active (admin, editor, crew)
--   upload / delete   admins, and editors on the sectors they lead or own
-- Nobody can reach the files with the public key alone.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('floorplans', 'floorplans', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Signed in, and their person is still active.
create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a join people p on p.id = a.person_id
    where a.user_id = auth.uid() and p.active
  );
$$;

-- May change this sector's content: an admin, or an editor who leads or owns it.
create function public.can_edit_sector(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a join people p on p.id = a.person_id
    where a.user_id = auth.uid() and p.active
      and (a.role = 'admin'
           or (a.role = 'editor' and exists (
                 select 1 from sectors s where s.id = sid and (s.lead_id = a.person_id or s.owner_id = a.person_id))))
  );
$$;

create policy "floorplans: team members can view"
  on storage.objects for select to authenticated
  using (bucket_id = 'floorplans' and public.is_member());

create policy "floorplans: sector editors can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'floorplans' and public.can_edit_sector((storage.foldername(name))[1]));

create policy "floorplans: sector editors can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'floorplans' and public.can_edit_sector((storage.foldername(name))[1]));

-- What is stored: the newest file in each sector/plan folder.
create function public.stored_files()
returns table (sector_id text, slot text, path text, name text, size bigint, pages integer,
               uploaded_at timestamptz, uploaded_by text, replaced_uploaded_at timestamptz)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.is_member() then return; end if;
  return query
    select distinct on (f.parts[1], f.parts[2])
      f.parts[1], f.parts[2], o.name,
      coalesce(o.user_metadata ->> 'name', regexp_replace(o.name, '^.*/', '')),
      (o.metadata ->> 'size')::bigint,
      coalesce((o.user_metadata ->> 'pages')::integer, 1),
      o.created_at,
      a.person_id,
      (o.user_metadata ->> 'replaces')::timestamptz
    from storage.objects o
    cross join lateral (select storage.foldername(o.name) as parts) f
    left join accounts a on a.user_id::text = coalesce(o.owner_id, o.owner::text)
    where o.bucket_id = 'floorplans' and array_length(f.parts, 1) >= 2
    order by f.parts[1], f.parts[2], o.created_at desc;
end $$;

-- Demo plans that were drawn by the app, not uploaded, and later removed.
create function public.removed_demo_files()
returns table (sector_id text, slot text)
language sql stable security definer set search_path = public as $$
  select b.sector_id, b.slot from content_blocks b
  where public.is_member() and b.kind in ('floorplan', 'custom_pdf') and b.file_path is null;
$$;

-- Remove one of the demo's drawn plans (they aren't files in Storage).
create function public.remove_demo_file(sid text, block_slot text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_edit_sector(sid) then raise exception 'Only an admin or this sector''s editor can remove its plans' using errcode = '42501'; end if;
  update content_blocks
    set file_path = null, file_name = null, file_size = null, file_pages = null,
        file_uploaded_at = null, file_uploaded_by = null, file_replaced_uploaded_at = null
    where sector_id = sid and slot = block_slot and file_path like 'sample:%';
end $$;

revoke all on function public.is_member(), public.can_edit_sector(text), public.stored_files(),
  public.removed_demo_files(), public.remove_demo_file(text, text) from public, anon;
grant execute on function public.is_member(), public.can_edit_sector(text), public.stored_files(),
  public.removed_demo_files(), public.remove_demo_file(text, text) to authenticated;

commit;
