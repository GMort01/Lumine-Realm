alter table public.profiles
  add column if not exists email text;

update public.profiles as profiles
set email = users.email
from auth.users as users
where profiles.id = users.id
  and profiles.email is distinct from users.email;

create or replace function public.sync_profile_email_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_email_from_auth_user on auth.users;
create trigger sync_profile_email_from_auth_user
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth_user();

alter table public.profiles enable row level security;

drop policy if exists "Realm admin can read registered profiles" on public.profiles;
create policy "Realm admin can read registered profiles"
  on public.profiles for select
  to authenticated
  using (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com');

grant select on public.profiles to authenticated;

drop policy if exists "Only admin can add realm members" on public.realm_members;
create policy "Only admin can add realm members"
  on public.realm_members for insert
  to authenticated
  with check (
    lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
    and invited_by = (select auth.uid())
  );

grant insert (user_id, invited_by) on public.realm_members to authenticated;
