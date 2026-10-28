create table if not exists public.realm_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now()
);

create table if not exists public.realm_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists realm_invitations_one_pending_email_idx
  on public.realm_invitations (lower(email))
  where status = 'pending';

alter table public.realm_members enable row level security;
alter table public.realm_invitations enable row level security;

create or replace function public.is_realm_member_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'mau.san.0275@gmail.com'
    or exists (
      select 1
      from public.realm_members
      where user_id = auth.uid()
    );
$$;

revoke all on function public.is_realm_member_or_admin() from public, anon;
grant execute on function public.is_realm_member_or_admin() to authenticated;

drop policy if exists "Realm members can view accepted members" on public.realm_members;
create policy "Realm members can view accepted members"
  on public.realm_members for select
  to authenticated
  using (public.is_realm_member_or_admin());

drop policy if exists "Only admin can remove realm members" on public.realm_members;
create policy "Only admin can remove realm members"
  on public.realm_members for delete
  to authenticated
  using (
    lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
    and user_id <> (select auth.uid())
  );

drop policy if exists "Admin manages realm invitations" on public.realm_invitations;
create policy "Admin manages realm invitations"
  on public.realm_invitations for all
  to authenticated
  using (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com')
  with check (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com');

drop policy if exists "Invited users can view their pending invitations" on public.realm_invitations;
create policy "Invited users can view their pending invitations"
  on public.realm_invitations for select
  to authenticated
  using (
    status = 'pending'
    and lower(email) = lower((select auth.jwt() ->> 'email'))
  );

revoke all on public.realm_members from anon, authenticated;
grant select, delete on public.realm_members to authenticated;

revoke all on public.realm_invitations from anon, authenticated;
grant select, insert, update, delete on public.realm_invitations to authenticated;

create or replace function public.accept_realm_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_invited_by uuid;
begin
  if v_user_id is null or v_email = '' then
    raise exception 'Debes iniciar sesión con el correo invitado.';
  end if;

  select invited_by
    into v_invited_by
    from public.realm_invitations
    where id = p_invitation_id
      and lower(email) = v_email
      and status = 'pending'
    for update;

  if not found then
    raise exception 'La invitación no existe, ya fue procesada o pertenece a otro correo.';
  end if;

  insert into public.realm_members (user_id, invited_by)
    values (v_user_id, v_invited_by)
    on conflict (user_id) do nothing;

  update public.realm_invitations
    set status = 'accepted', accepted_at = now()
    where id = p_invitation_id;
end;
$$;

revoke all on function public.accept_realm_invitation(uuid) from public, anon;
grant execute on function public.accept_realm_invitation(uuid) to authenticated;

insert into public.realm_members (user_id, invited_by)
select id, id
from auth.users
where lower(email) = 'mau.san.0275@gmail.com'
on conflict (user_id) do nothing;

create or replace function public.add_realm_admin_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(new.email, '')) = 'mau.san.0275@gmail.com' then
    insert into public.realm_members (user_id, invited_by)
      values (new.id, new.id)
      on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_realm_admin_created on auth.users;
create trigger on_realm_admin_created
  after insert on auth.users
  for each row execute function public.add_realm_admin_member();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'realm_members'
  ) then
    alter publication supabase_realtime add table public.realm_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'realm_invitations'
  ) then
    alter publication supabase_realtime add table public.realm_invitations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
