create table if not exists public.realm_status (
  id uuid primary key default gen_random_uuid(),
  is_player2_connected boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.realm_status
  add column if not exists is_player2_connected boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

with ranked_rows as (
  select ctid, row_number() over (order by updated_at desc, id) as row_number
  from public.realm_status
)
delete from public.realm_status as status
using ranked_rows
where status.ctid = ranked_rows.ctid
  and ranked_rows.row_number > 1;

create unique index if not exists realm_status_singleton_idx
  on public.realm_status ((true));

insert into public.realm_status (is_player2_connected)
select false
where not exists (select 1 from public.realm_status);

alter table public.realm_status enable row level security;

drop policy if exists "Estado del Realm visible para todos" on public.realm_status;
drop policy if exists "Authenticated users can read realm status" on public.realm_status;
create policy "Authenticated users can read realm status"
  on public.realm_status for select
  to authenticated
  using (true);

drop policy if exists "Solo Admin actualiza estado del Realm" on public.realm_status;
drop policy if exists "Only realm admin can update realm status" on public.realm_status;
create policy "Only realm admin can update realm status"
  on public.realm_status for update
  to authenticated
  using (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com')
  with check (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com');

revoke all on public.realm_status from anon, authenticated;
grant select on public.realm_status to authenticated;
grant update (is_player2_connected, updated_at) on public.realm_status to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'realm_status'
  ) then
    alter publication supabase_realtime add table public.realm_status;
  end if;
end
$$;
