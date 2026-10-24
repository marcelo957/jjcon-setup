-- JJCON SetUp · step 4a · logins
-- Run once, in Supabase → SQL Editor → New query → paste → Run, BEFORE creating the first user.
--
-- Supabase Auth keeps the email and password. This adds what the app needs on top:
--   accounts  one row per login: which person on the People list it is, and their role
--             (admin, editor or crew). A login whose email matches nobody on the People list
--             gets no account and can't open the app.
--   me()      what the signed-in person may know about themselves: name, email, role, and
--             whether they are still active. Deactivated people are signed straight out.
--   Admin-only functions for the People page: the login list, changing a role, withdrawing an
--   invitation that hasn't been used, and signing someone out of all devices.
-- The very first login linked to a person becomes admin; everyone after gets the role they
-- were invited with (crew if none).

begin;

create table accounts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  person_id  text not null unique references people (id) on delete cascade,
  role       text not null default 'crew' check (role in ('admin', 'editor', 'crew')),
  invited_by text references people (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table accounts enable row level security;   -- read only through the functions below

-- Link a new login to the person with the same email.
create function public.link_login(u auth.users) returns void
language plpgsql security definer set search_path = public as $$
declare
  pid text;
  r   text := coalesce(u.raw_user_meta_data ->> 'role', 'crew');
  inv text := u.raw_user_meta_data ->> 'invited_by';
begin
  select id into pid from people where lower(email) = lower(u.email) order by created_at limit 1;
  if pid is null or exists (select 1 from accounts where user_id = u.id or person_id = pid) then return; end if;
  if r not in ('admin', 'editor', 'crew') then r := 'crew'; end if;
  if not exists (select 1 from accounts where role = 'admin') then r := 'admin'; end if;
  if inv is not null and not exists (select 1 from people where id = inv) then inv := null; end if;
  insert into accounts (user_id, person_id, role, invited_by) values (u.id, pid, r, inv);
end $$;

create function public.on_login_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.link_login(new);
  return new;
end $$;

create trigger on_login_created after insert on auth.users
  for each row execute function public.on_login_created();

-- Logins created before this script ran (oldest first, so the first becomes admin).
do $$ declare u auth.users; begin
  for u in select * from auth.users order by created_at loop perform public.link_login(u); end loop;
end $$;

-- The signed-in person.
create function public.me()
returns table (person_id text, name text, email text, role text, active boolean,
               deactivated_at timestamptz, deactivated_by_name text, invited_by_name text, invited_by_email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, coalesce(nullif(p.email, ''), u.email), a.role, p.active,
         p.deactivated_at, d.name, i.name, i.email
  from accounts a
  join people p on p.id = a.person_id
  join auth.users u on u.id = a.user_id
  left join people d on d.id = p.deactivated_by
  left join people i on i.id = a.invited_by
  where a.user_id = auth.uid();
$$;

-- An invited person confirms the name shown on sectors and tasks.
create function public.set_my_name(new_name text) returns void
language sql security definer set search_path = public as $$
  update people set name = trim(new_name)
  where trim(coalesce(new_name, '')) <> ''
    and id = (select person_id from accounts where user_id = auth.uid());
$$;

-- Admin checks.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from accounts a join people p on p.id = a.person_id
    where a.user_id = auth.uid() and a.role = 'admin' and p.active
  );
$$;

create function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only an admin can do this' using errcode = '42501'; end if;
end $$;

-- People page: everyone with a login or an invitation.
create function public.access_list()
returns table (person_id text, role text, login text, last_sign_in_at timestamptz,
               invited_at timestamptz, invited_by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select a.person_id, a.role,
           case when u.last_sign_in_at is not null or u.email_confirmed_at is not null and u.invited_at is null then 'active'
                when u.invited_at is not null then 'invited' else 'active' end,
           u.last_sign_in_at, u.invited_at, i.name
    from accounts a
    join auth.users u on u.id = a.user_id
    left join people i on i.id = a.invited_by;
end $$;

create function public.set_role(target_person text, new_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if new_role not in ('admin', 'editor', 'crew') then raise exception 'Unknown role %', new_role; end if;
  if target_person = (select person_id from accounts where user_id = auth.uid()) then
    raise exception 'You can''t change your own role' using errcode = '42501';
  end if;
  update accounts set role = new_role where person_id = target_person;
end $$;

-- Withdraw an invitation nobody has used yet. A login that has been used is never deleted here.
create function public.revoke_invite(target_person text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from auth.users u using accounts a
  where a.person_id = target_person and u.id = a.user_id and u.last_sign_in_at is null;
end $$;

-- End every session the person has, on every device.
create function public.sign_out_everywhere(target_person text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  delete from auth.sessions s using accounts a where a.person_id = target_person and s.user_id = a.user_id;
end $$;

-- Only signed-in people can call these; nothing is callable with the public key alone.
revoke all on function public.link_login(auth.users), public.on_login_created(), public.me(), public.set_my_name(text),
  public.is_admin(), public.require_admin(), public.access_list(), public.set_role(text, text),
  public.revoke_invite(text), public.sign_out_everywhere(text) from public, anon;
grant execute on function public.me(), public.set_my_name(text), public.is_admin(), public.access_list(),
  public.set_role(text, text), public.revoke_invite(text), public.sign_out_everywhere(text) to authenticated;

commit;
