create or replace function public.can_publish_realm_audience(
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
    p_created_by = auth.uid()
    and public.is_realm_member_or_admin()
    and (
      (
        p_audience = 'realm'
        and p_recipient_id is null
        and p_relationship_id is null
      )
      or (
        p_audience = 'individual'
        and p_recipient_id is not null
        and p_recipient_id <> auth.uid()
        and p_relationship_id is null
        and exists (select 1 from public.realm_members where user_id = p_recipient_id)
      )
      or (
        p_audience = 'relationship'
        and p_recipient_id is null
        and p_relationship_id is not null
        and exists (
          select 1 from public.realm_relationships relationship
          where relationship.id = p_relationship_id
            and relationship.status = 'accepted'
            and (relationship.initiator_id = auth.uid() or relationship.partner_id = auth.uid())
        )
      )
    );
$$;

revoke all on function public.can_publish_realm_audience(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.can_publish_realm_audience(text, uuid, uuid, uuid) to authenticated;

drop policy if exists "Gift authors and admin can update gifts" on public.gifts;
create policy "Gift authors and admin can update gifts"
  on public.gifts for update
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin())
  with check (
    public.is_realm_admin()
    or public.can_publish_realm_audience(audience_scope, recipient_user_id, relationship_id, created_by)
  );

drop policy if exists "Gift authors and admin can delete gifts" on public.gifts;
create policy "Gift authors and admin can delete gifts"
  on public.gifts for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin());

drop policy if exists "Gift owners and admin can delete attachments" on storage.objects;
create policy "Gift owners and admin can delete attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gift-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_realm_admin()
    )
  );

drop policy if exists "Realm members delete their own timeline images" on storage.objects;
create policy "Realm members delete their own timeline images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'realm-timeline-images'
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or public.is_realm_admin()
    )
  );

drop policy if exists "Admins remove avatars during member cleanup" on storage.objects;
create policy "Admins remove avatars during member cleanup"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'profile-avatars' and public.is_realm_admin());

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

drop policy if exists "Prize owners can view their inactive prizes" on public.coupon_prizes;
create policy "Prize owners can view their inactive prizes"
  on public.coupon_prizes for select
  to authenticated
  using (created_by = (select auth.uid()));

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

drop policy if exists "Prize owners and admin can update prizes" on public.coupon_prizes;
create policy "Prize owners and admin can update prizes"
  on public.coupon_prizes for update
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin())
  with check (
    public.is_realm_admin()
    or public.can_publish_realm_audience(audience_scope, recipient_user_id, relationship_id, created_by)
  );

drop policy if exists "Prize owners and admin can delete prizes" on public.coupon_prizes;
create policy "Prize owners and admin can delete prizes"
  on public.coupon_prizes for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin());

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
  with check (
    event_date <= current_date
    and (
      public.is_realm_admin()
      or public.can_publish_realm_audience(audience_scope, recipient_user_id, relationship_id, created_by)
    )
  );

drop policy if exists "Timeline authors and admin can delete memories" on public.timeline_events;
create policy "Timeline authors and admin can delete memories"
  on public.timeline_events for delete
  to authenticated
  using (created_by = (select auth.uid()) or public.is_realm_admin());

drop function if exists public.spin_gacha_for_current_user();
create or replace function public.spin_gacha_for_current_user(p_audience_filter text default 'all')
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
  if p_audience_filter not in ('all', 'realm', 'relationship') then
    raise exception 'El filtro de audiencia de la ruleta no es válido.';
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
      and (
        p_audience_filter = 'all'
        or (p_audience_filter = 'realm' and prize.audience_scope = 'realm')
        or (p_audience_filter = 'relationship' and prize.audience_scope = 'relationship')
      )
  )
  select
    jsonb_agg(to_jsonb(eligible) order by eligible.created_at, eligible.id),
    (array_agg(eligible.id order by random()))[1]
  into v_prize_list, v_prize_id
  from eligible;

  if v_prize_id is null or jsonb_array_length(v_prize_list) < 2 then
    raise exception 'Se necesitan al menos dos premios disponibles en este modo para girar.';
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

revoke all on function public.spin_gacha_for_current_user(text) from public, anon;
grant execute on function public.spin_gacha_for_current_user(text) to authenticated;

create or replace function public.admin_remove_realm_member(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gift_paths text[];
  v_timeline_paths text[];
begin
  if not public.is_realm_admin() then
    raise exception 'Solo el Game Master puede quitar miembros del Realm.';
  end if;
  if p_user_id is null or p_user_id = auth.uid() then
    raise exception 'No puedes quitar tu propia cuenta del Realm.';
  end if;

  select coalesce(array_agg(distinct gifts.media_url), '{}'::text[])
  into v_gift_paths
  from public.gifts
  where gifts.media_url is not null
    and gifts.media_url !~* '^https?://'
    and (
      gifts.created_by = p_user_id
      or gifts.relationship_id in (
        select id from public.realm_relationships
        where initiator_id = p_user_id or partner_id = p_user_id
      )
    );

  select coalesce(array_agg(distinct events.image_path), '{}'::text[])
  into v_timeline_paths
  from public.timeline_events events
  where events.image_path is not null
    and (
      events.created_by = p_user_id
      or events.relationship_id in (
        select id from public.realm_relationships
        where initiator_id = p_user_id or partner_id = p_user_id
      )
    );

  delete from public.gifts where created_by = p_user_id;
  delete from public.coupon_prizes where created_by = p_user_id;
  delete from public.timeline_events where created_by = p_user_id;
  delete from public.realm_relationships
    where initiator_id = p_user_id or partner_id = p_user_id;
  delete from public.realm_members where user_id = p_user_id;

  return jsonb_build_object(
    'gift_paths', to_jsonb(v_gift_paths),
    'timeline_paths', to_jsonb(v_timeline_paths)
  );
end;
$$;

revoke all on function public.admin_remove_realm_member(uuid) from public, anon;
grant execute on function public.admin_remove_realm_member(uuid) to authenticated;
