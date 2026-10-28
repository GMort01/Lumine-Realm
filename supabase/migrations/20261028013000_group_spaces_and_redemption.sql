create table if not exists public.realm_relationships (
  id uuid primary key default gen_random_uuid(),
  initiator_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'ended')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  constraint realm_relationships_distinct_members check (initiator_id <> partner_id)
);

create unique index if not exists realm_relationships_one_active_per_member_idx
  on public.realm_relationships (
    (least(initiator_id, partner_id)),
    (greatest(initiator_id, partner_id))
  )
  where status in ('pending', 'accepted');

create index if not exists realm_relationships_pending_recipient_idx
  on public.realm_relationships (partner_id, created_at desc)
  where status = 'pending';

alter table public.realm_relationships enable row level security;
grant select, insert, update on public.realm_relationships to authenticated;

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

drop policy if exists "Realm members can view their relationships" on public.realm_relationships;
create policy "Realm members can view their relationships"
  on public.realm_relationships for select
  to authenticated
  using (
    public.is_realm_member_or_admin()
    and (initiator_id = (select auth.uid()) or partner_id = (select auth.uid()))
  );

drop policy if exists "Realm members can invite a partner" on public.realm_relationships;
create policy "Realm members can invite a partner"
  on public.realm_relationships for insert
  to authenticated
  with check (
    initiator_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.realm_members where user_id = initiator_id)
    and exists (select 1 from public.realm_members where user_id = partner_id)
  );

revoke insert, update on public.realm_relationships from authenticated;

create or replace function public.invite_realm_partner(p_partner_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_relationship_id uuid;
begin
  if v_user_id is null or p_partner_id is null or p_partner_id = v_user_id then
    raise exception 'Selecciona a otro miembro del Realm.';
  end if;
  if not exists (select 1 from public.realm_members where user_id = v_user_id)
     or not exists (select 1 from public.realm_members where user_id = p_partner_id) then
    raise exception 'Ambos usuarios deben pertenecer al Realm.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(v_user_id::text, p_partner_id::text), 1));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_user_id::text, p_partner_id::text), 1));

  if exists (
    select 1 from public.realm_relationships
    where status in ('pending', 'accepted')
      and (
        initiator_id in (v_user_id, p_partner_id)
        or partner_id in (v_user_id, p_partner_id)
      )
  ) then
    raise exception 'Uno de los miembros ya tiene una invitación o vínculo activo.';
  end if;

  insert into public.realm_relationships (initiator_id, partner_id)
  values (v_user_id, p_partner_id)
  returning id into v_relationship_id;

  return v_relationship_id;
end;
$$;

create or replace function public.respond_realm_relationship(
  p_relationship_id uuid,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_response not in ('accepted', 'declined') then
    raise exception 'La respuesta a la invitación no es válida.';
  end if;
  if p_response = 'accepted' and not exists (
    select 1
    from public.realm_relationships relationship
    join public.realm_members initiator on initiator.user_id = relationship.initiator_id
    join public.realm_members partner on partner.user_id = relationship.partner_id
    where relationship.id = p_relationship_id
  ) then
    raise exception 'Ambos usuarios deben seguir perteneciendo al Realm.';
  end if;

  update public.realm_relationships
  set status = p_response,
      accepted_at = case when p_response = 'accepted' then now() else null end
  where id = p_relationship_id
    and partner_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'La invitación ya fue respondida o no está disponible.';
  end if;
end;
$$;

create or replace function public.end_realm_relationship(p_relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.realm_relationships
  set status = 'ended'
  where id = p_relationship_id
    and status = 'accepted'
    and (initiator_id = auth.uid() or partner_id = auth.uid());

  if not found then
    raise exception 'El vínculo ya no está activo o no está disponible.';
  end if;
end;
$$;

revoke all on function public.respond_realm_relationship(uuid, text) from public, anon;
revoke all on function public.end_realm_relationship(uuid) from public, anon;
revoke all on function public.invite_realm_partner(uuid) from public, anon;
grant execute on function public.respond_realm_relationship(uuid, text) to authenticated;
grant execute on function public.end_realm_relationship(uuid) to authenticated;
grant execute on function public.invite_realm_partner(uuid) to authenticated;

create or replace function public.is_realm_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'mau.san.0275@gmail.com';
$$;

revoke all on function public.is_realm_admin() from public, anon;
grant execute on function public.is_realm_admin() to authenticated;

create or replace function public.can_access_realm_audience(
  p_audience text,
  p_recipient_id uuid,
  p_relationship_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_realm_admin()
    or p_created_by = auth.uid()
    or (
      public.is_realm_member_or_admin()
      and p_audience = 'realm'
    )
    or (
      public.is_realm_member_or_admin()
      and p_audience = 'individual'
      and p_recipient_id = auth.uid()
    )
    or (
      public.is_realm_member_or_admin()
      and p_audience = 'relationship'
      and exists (
        select 1
        from public.realm_relationships relationships
        where relationships.id = p_relationship_id
          and relationships.status = 'accepted'
          and (relationships.initiator_id = auth.uid() or relationships.partner_id = auth.uid())
      )
    );
$$;

revoke all on function public.can_access_realm_audience(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.can_access_realm_audience(text, uuid, uuid, uuid) to authenticated;

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

drop policy if exists "Realm members can read directory profiles" on public.profiles;
create policy "Realm members can read directory profiles"
  on public.profiles for select
  to authenticated
  using (public.is_realm_member_or_admin());
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

revoke select on public.profiles from authenticated;
grant select (id, username, country, avatar_url) on public.profiles to authenticated;

create or replace view public.admin_registered_profiles as
select id, username, country, avatar_url, email
from public.profiles
where lower(coalesce(auth.jwt() ->> 'email', '')) = 'mau.san.0275@gmail.com';
grant select on public.admin_registered_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload their own profile avatar" on storage.objects;
create policy "Members upload their own profile avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Members update their own profile avatar" on storage.objects;
create policy "Members update their own profile avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Members delete their own profile avatar" on storage.objects;
create policy "Members delete their own profile avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter table public.gifts
  add column if not exists audience_scope text not null default 'realm',
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists relationship_id uuid references public.realm_relationships(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.gifts enable row level security;

update public.gifts
set created_by = (select id from auth.users where lower(email) = 'mau.san.0275@gmail.com' limit 1)
where created_by is null;

alter table public.gifts
  drop constraint if exists gifts_audience_scope_check;
alter table public.gifts
  add constraint gifts_audience_scope_check
  check (audience_scope in ('realm', 'individual', 'relationship'));
alter table public.gifts
  drop constraint if exists gifts_audience_target_check;
alter table public.gifts
  add constraint gifts_audience_target_check
  check (
    (audience_scope = 'realm' and recipient_user_id is null and relationship_id is null)
    or (audience_scope = 'individual' and recipient_user_id is not null and relationship_id is null)
    or (audience_scope = 'relationship' and recipient_user_id is null and relationship_id is not null)
  );

drop policy if exists "Visible gifts follow their audience" on public.gifts;
create policy "Visible gifts follow their audience"
  on public.gifts as restrictive for select
  to authenticated
  using (
    public.is_realm_member_or_admin()
    and public.can_access_realm_audience(audience_scope, recipient_user_id, relationship_id, created_by)
  );

drop policy if exists "Realm members can contribute gifts" on public.gifts;
create policy "Realm members can contribute gifts"
  on public.gifts for insert
  to authenticated
  with check (
    public.is_realm_member_or_admin()
    and created_by = (select auth.uid())
    and (
      audience_scope = 'realm'
      or (
        audience_scope = 'individual'
        and recipient_user_id <> (select auth.uid())
        and exists (select 1 from public.realm_members where user_id = recipient_user_id)
      )
      or (
        audience_scope = 'relationship'
        and exists (
          select 1 from public.realm_relationships relationships
          where relationships.id = relationship_id
            and relationships.status = 'accepted'
            and (relationships.initiator_id = (select auth.uid()) or relationships.partner_id = (select auth.uid()))
        )
      )
    )
  );
grant insert on public.gifts to authenticated;

insert into storage.buckets (id, name, public)
values ('gift-attachments', 'gift-attachments', false)
on conflict (id) do nothing;
drop policy if exists "Members upload their own gift attachments" on storage.objects;
create policy "Members upload their own gift attachments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gift-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_realm_member_or_admin()
  );
drop policy if exists "Gift attachment visibility follows gift audience" on storage.objects;
create policy "Gift attachment visibility follows gift audience"
  on storage.objects as restrictive for select to authenticated
  using (
    bucket_id <> 'gift-attachments'
    or exists (
      select 1 from public.gifts
      where gifts.media_url = storage.objects.name
        and public.can_access_realm_audience(
          gifts.audience_scope, gifts.recipient_user_id, gifts.relationship_id, gifts.created_by
        )
    )
  );
drop policy if exists "Gift owners and admin can delete attachments" on storage.objects;
create policy "Gift owners and admin can delete attachments"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'gift-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_realm_admin()
    )
  );

alter table public.coupon_prizes
  add column if not exists audience_scope text not null default 'realm',
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists relationship_id uuid references public.realm_relationships(id) on delete cascade,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.coupon_prizes
set created_by = (select id from auth.users where lower(email) = 'mau.san.0275@gmail.com' limit 1)
where created_by is null;

alter table public.coupon_prizes
  drop constraint if exists coupon_prizes_audience_scope_check;
alter table public.coupon_prizes
  add constraint coupon_prizes_audience_scope_check
  check (audience_scope in ('realm', 'individual', 'relationship'));
alter table public.coupon_prizes
  drop constraint if exists coupon_prizes_audience_target_check;
alter table public.coupon_prizes
  add constraint coupon_prizes_audience_target_check
  check (
    (audience_scope = 'realm' and recipient_user_id is null and relationship_id is null)
    or (audience_scope = 'individual' and recipient_user_id is not null and relationship_id is null)
    or (audience_scope = 'relationship' and recipient_user_id is null and relationship_id is not null)
  );

drop policy if exists "Coupon prize audience visibility" on public.coupon_prizes;
create policy "Coupon prize audience visibility"
  on public.coupon_prizes as restrictive for select
  to authenticated
  using (
    public.is_realm_member_or_admin()
    and (
      public.is_realm_admin()
      or created_by = (select auth.uid())
      or (
        is_active
        and public.can_access_realm_audience(audience_scope, recipient_user_id, relationship_id, created_by)
      )
    )
  );

drop policy if exists "Realm members can create coupon prizes" on public.coupon_prizes;
create policy "Realm members can create coupon prizes"
  on public.coupon_prizes for insert
  to authenticated
  with check (
    public.is_realm_member_or_admin()
    and created_by = (select auth.uid())
    and (
      audience_scope = 'realm'
      or (
        audience_scope = 'individual'
        and recipient_user_id <> (select auth.uid())
        and exists (select 1 from public.realm_members where user_id = recipient_user_id)
      )
      or (
        audience_scope = 'relationship'
        and exists (
          select 1 from public.realm_relationships relationships
          where relationships.id = relationship_id
            and relationships.status = 'accepted'
            and (relationships.initiator_id = (select auth.uid()) or relationships.partner_id = (select auth.uid()))
        )
      )
    )
  );
grant insert on public.coupon_prizes to authenticated;

drop policy if exists "Prize owners and admin can update prizes" on public.coupon_prizes;
create policy "Prize owners and admin can update prizes"
  on public.coupon_prizes for update
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin())
  with check (created_by = (select auth.uid()) or public.is_realm_admin());

drop policy if exists "Prize owners and admin can delete prizes" on public.coupon_prizes;
create policy "Prize owners and admin can delete prizes"
  on public.coupon_prizes for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin());

alter table public.timeline_events
  add column if not exists audience_scope text not null default 'realm',
  add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists relationship_id uuid references public.realm_relationships(id) on delete cascade;

alter table public.timeline_events
  drop constraint if exists timeline_events_audience_scope_check;
alter table public.timeline_events
  add constraint timeline_events_audience_scope_check
  check (audience_scope in ('realm', 'individual', 'relationship'));
alter table public.timeline_events
  drop constraint if exists timeline_events_audience_target_check;
alter table public.timeline_events
  add constraint timeline_events_audience_target_check
  check (
    (audience_scope = 'realm' and recipient_user_id is null and relationship_id is null)
    or (audience_scope = 'individual' and recipient_user_id is not null and relationship_id is null)
    or (audience_scope = 'relationship' and recipient_user_id is null and relationship_id is not null)
  );

drop policy if exists "Timeline events follow their audience" on public.timeline_events;
create policy "Timeline events follow their audience"
  on public.timeline_events as restrictive for select
  to authenticated
  using (
    public.is_realm_member_or_admin()
    and public.can_access_realm_audience(audience_scope, recipient_user_id, relationship_id, created_by)
  );

drop policy if exists "Realm members can create timeline memories" on public.timeline_events;
create policy "Realm members can create timeline memories"
  on public.timeline_events for insert
  to authenticated
  with check (
    public.is_realm_member_or_admin()
    and created_by = (select auth.uid())
    and event_date <= current_date
    and (
      audience_scope = 'realm'
      or (
        audience_scope = 'individual'
        and recipient_user_id <> (select auth.uid())
        and exists (select 1 from public.realm_members where user_id = recipient_user_id)
      )
      or (
        audience_scope = 'relationship'
        and exists (
          select 1 from public.realm_relationships relationships
          where relationships.id = relationship_id
            and relationships.status = 'accepted'
            and (relationships.initiator_id = (select auth.uid()) or relationships.partner_id = (select auth.uid()))
        )
      )
    )
  );

drop policy if exists "Timeline authors and admin can update memories" on public.timeline_events;
create policy "Timeline authors and admin can update memories"
  on public.timeline_events for update
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin())
  with check (created_by = (select auth.uid()) or public.is_realm_admin());

drop policy if exists "Timeline authors and admin can delete memories" on public.timeline_events;
create policy "Timeline authors and admin can delete memories"
  on public.timeline_events for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin());

drop policy if exists "Only admin uploads timeline images" on storage.objects;
drop policy if exists "Realm members upload their own timeline images" on storage.objects;
create policy "Realm members upload their own timeline images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'realm-timeline-images'
    and public.is_realm_member_or_admin()
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
drop policy if exists "Only admin deletes timeline images" on storage.objects;
drop policy if exists "Realm members delete their own timeline images" on storage.objects;
create policy "Realm members delete their own timeline images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'realm-timeline-images'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or public.is_realm_admin()
    )
  );
drop policy if exists "Timeline image visibility follows event audience" on storage.objects;
create policy "Timeline image visibility follows event audience"
  on storage.objects as restrictive for select to authenticated
  using (
    bucket_id <> 'realm-timeline-images'
    or exists (
      select 1 from public.timeline_events
      where timeline_events.image_path = storage.objects.name
        and public.can_access_realm_audience(
          timeline_events.audience_scope,
          timeline_events.recipient_user_id,
          timeline_events.relationship_id,
          timeline_events.created_by
        )
    )
  );

create or replace function public.admin_approve_coupon_redemption(p_coupon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coupon public.coupons%rowtype;
begin
  if not public.is_realm_admin() then
    raise exception 'Solo el administrador puede aprobar solicitudes de canje.';
  end if;

  update public.coupons
  set status = 'redeemed',
      is_redeemed = true,
      redeemed_at = now()
  where id = p_coupon_id
    and status = 'requested'
  returning * into v_coupon;

  if not found then
    raise exception 'La solicitud ya fue atendida o no está disponible.';
  end if;

  return to_jsonb(v_coupon);
end;
$$;

revoke all on function public.admin_approve_coupon_redemption(uuid) from public, anon;
grant execute on function public.admin_approve_coupon_redemption(uuid) to authenticated;

create or replace function public.spin_gacha_for_current_user()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prize_list jsonb;
  v_prize_id uuid;
  v_prize jsonb;
  v_coupon public.coupons%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Inicia sesión antes de girar la ruleta.'; end if;
  if not public.is_realm_member_or_admin() then
    raise exception 'Debes pertenecer al Realm para girar la ruleta.';
  end if;

  with eligible as (
    select prize.*
    from public.coupon_prizes prize
    where prize.is_active
      and public.can_access_realm_audience(
        prize.audience_scope,
        prize.recipient_user_id,
        prize.relationship_id,
        prize.created_by
      )
  )
  select
    jsonb_agg(to_jsonb(eligible) order by eligible.created_at, eligible.id),
    (array_agg(eligible.id order by random()))[1]
  into v_prize_list, v_prize_id
  from eligible;

  if v_prize_id is null or jsonb_array_length(v_prize_list) < 2 then
    raise exception 'Se necesitan al menos dos premios disponibles para girar.';
  end if;

  select prize.value
  into v_prize
  from jsonb_array_elements(v_prize_list) as prize(value)
  where prize.value ->> 'id' = v_prize_id::text;

  insert into public.coupons (user_id, title, description, is_redeemed, status, redeemed_at)
  values (
    v_user_id,
    v_prize ->> 'title',
    coalesce(v_prize ->> 'description', ''),
    false,
    'available',
    null
  )
  returning * into v_coupon;

  return jsonb_build_object(
    'coupon', to_jsonb(v_coupon),
    'prize', v_prize,
    'prizes', v_prize_list
  );
end;
$$;

revoke all on function public.spin_gacha_for_current_user() from public, anon;
grant execute on function public.spin_gacha_for_current_user() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'realm_relationships'
  ) then
    alter publication supabase_realtime add table public.realm_relationships;
  end if;
end
$$;
