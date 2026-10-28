create table if not exists public.coupon_prizes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.coupon_prizes
  add column if not exists is_active boolean not null default true;

alter table public.coupon_prizes enable row level security;

drop policy if exists "Anyone authenticated can view active coupon prizes" on public.coupon_prizes;
create policy "Anyone authenticated can view active coupon prizes"
  on public.coupon_prizes for select
  to authenticated
  using (
    is_active
    or lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
  );

drop policy if exists "Only admin manages coupon prizes" on public.coupon_prizes;
create policy "Only admin manages coupon prizes"
  on public.coupon_prizes for all
  to authenticated
  using (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com')
  with check (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com');

grant select, insert, update, delete on public.coupon_prizes to authenticated;

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_date date not null,
  image_path text,
  is_anniversary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.timeline_events
  add column if not exists image_path text,
  add column if not exists is_anniversary boolean not null default false,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.timeline_events enable row level security;

drop policy if exists "Realm members can read timeline events" on public.timeline_events;
create policy "Realm members can read timeline events"
  on public.timeline_events for select
  to authenticated
  using (public.is_realm_member_or_admin());

drop policy if exists "Only admin creates timeline events" on public.timeline_events;
create policy "Only admin creates timeline events"
  on public.timeline_events for insert
  to authenticated
  with check (
    lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
    and created_by = (select auth.uid())
  );

drop policy if exists "Only admin updates timeline events" on public.timeline_events;
create policy "Only admin updates timeline events"
  on public.timeline_events for update
  to authenticated
  using (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com')
  with check (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com');

drop policy if exists "Only admin deletes timeline events" on public.timeline_events;
create policy "Only admin deletes timeline events"
  on public.timeline_events for delete
  to authenticated
  using (lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com');

grant select, insert, update, delete on public.timeline_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'realm-timeline-images',
  'realm-timeline-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Realm members can read timeline images" on storage.objects;
create policy "Realm members can read timeline images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'realm-timeline-images'
    and public.is_realm_member_or_admin()
  );

drop policy if exists "Only admin uploads timeline images" on storage.objects;
create policy "Only admin uploads timeline images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'realm-timeline-images'
    and lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
  );

drop policy if exists "Only admin deletes timeline images" on storage.objects;
create policy "Only admin deletes timeline images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'realm-timeline-images'
    and lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'timeline_events'
  ) then
    alter publication supabase_realtime add table public.timeline_events;
  end if;
end
$$;
