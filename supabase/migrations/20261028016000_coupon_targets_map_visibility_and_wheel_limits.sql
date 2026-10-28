alter table public.coupons
  add column if not exists audience_scope text not null default 'realm',
  add column if not exists relationship_id uuid,
  add column if not exists redemption_target_user_id uuid references auth.users(id) on delete set null,
  add column if not exists redemption_for_all boolean not null default false;

update public.coupons
set redemption_for_all = true
where status = 'requested'
  and redemption_target_user_id is null;

alter table public.coupons
  drop constraint if exists coupons_audience_scope_check;
alter table public.coupons
  add constraint coupons_audience_scope_check
  check (audience_scope in ('realm', 'relationship'));
alter table public.coupons
  drop constraint if exists coupons_audience_relationship_check;
alter table public.coupons
  add constraint coupons_audience_relationship_check
  check (
    (audience_scope = 'realm' and relationship_id is null)
    or (audience_scope = 'relationship' and relationship_id is not null)
  );
alter table public.coupons
  drop constraint if exists coupons_redemption_target_check;
alter table public.coupons
  add constraint coupons_redemption_target_check
  check (
    status <> 'requested'
    or (
      audience_scope = 'realm'
      and (
        (redemption_for_all and redemption_target_user_id is null)
        or (not redemption_for_all and redemption_target_user_id is not null)
      )
    )
    or (
      audience_scope = 'relationship'
      and not redemption_for_all
      and redemption_target_user_id is not null
    )
  );

revoke update on public.coupons from authenticated;
revoke update (status, is_redeemed, redeemed_at) on public.coupons from authenticated;

create or replace function public.request_coupon_redemption(
  p_coupon_id uuid,
  p_target_user_id uuid default null,
  p_for_all boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_coupon public.coupons%rowtype;
  v_user_id uuid := auth.uid();
  v_target_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Inicia sesión para solicitar el canje.';
  end if;

  select * into v_coupon
  from public.coupons
  where id = p_coupon_id
    and user_id = v_user_id
  for update;

  if not found
     or v_coupon.status <> 'available'
     or v_coupon.is_redeemed
     or (v_coupon.expires_at is not null and v_coupon.expires_at <= now()) then
    raise exception 'El cupón ya fue solicitado o no está disponible.';
  end if;

  if v_coupon.audience_scope = 'relationship' then
    if p_for_all or p_target_user_id is not null or not exists (
      select 1
      from public.realm_relationships relationship
      join public.realm_members owner_member on owner_member.user_id = v_user_id
      join public.realm_members target_member
        on target_member.user_id = case
          when relationship.initiator_id = v_user_id then relationship.partner_id
          else relationship.initiator_id
        end
      where relationship.id = v_coupon.relationship_id
        and relationship.status = 'accepted'
        and (relationship.initiator_id = v_user_id or relationship.partner_id = v_user_id)
    ) then
      raise exception 'Este cupón solo se puede canjear dentro del vínculo de pareja que lo obtuvo.';
    end if;

    select case
      when relationship.initiator_id = v_user_id then relationship.partner_id
      else relationship.initiator_id
    end into v_target_user_id
    from public.realm_relationships relationship
    where relationship.id = v_coupon.relationship_id
      and relationship.status = 'accepted'
      and (relationship.initiator_id = v_user_id or relationship.partner_id = v_user_id);

    if v_target_user_id is null then
      raise exception 'El vínculo de pareja de este cupón ya no está disponible.';
    end if;
  else
    if p_for_all = (p_target_user_id is not null) then
      raise exception 'Elige un miembro o selecciona canjearlo para todos.';
    end if;
    if p_for_all then
      v_target_user_id := null;
    else
      if not exists (select 1 from public.realm_members where user_id = p_target_user_id) then
        raise exception 'El destinatario debe pertenecer al Realm.';
      end if;
      v_target_user_id := p_target_user_id;
    end if;
  end if;

  update public.coupons
  set status = 'requested',
      redemption_target_user_id = v_target_user_id,
      redemption_for_all = p_for_all
  where id = p_coupon_id
  returning * into v_coupon;

  return to_jsonb(v_coupon);
end;
$$;

revoke all on function public.request_coupon_redemption(uuid, uuid, boolean) from public, anon;
grant execute on function public.request_coupon_redemption(uuid, uuid, boolean) to authenticated;

create or replace function public.enforce_coupon_prize_wheel_limit()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_pool_key text;
  v_active_count integer;
begin
  if not new.is_active then
    return new;
  end if;

  v_pool_key := case
    when new.audience_scope = 'relationship' then 'relationship:' || new.relationship_id::text
    else 'realm'
  end;
  perform pg_advisory_xact_lock(hashtextextended(v_pool_key, 0));

  select count(*) into v_active_count
  from public.coupon_prizes prize
  where prize.is_active
    and prize.id is distinct from new.id
    and (
      (v_pool_key = 'realm' and prize.audience_scope in ('realm', 'individual'))
      or (
        new.audience_scope = 'relationship'
        and prize.audience_scope = 'relationship'
        and prize.relationship_id = new.relationship_id
      )
    );

  if v_active_count >= 8 then
    raise exception 'Cada ruleta admite como máximo 8 premios activos. Desactiva uno antes de añadir otro.';
  end if;
  return new;
end;
$$;

drop trigger if exists coupon_prizes_enforce_wheel_limit on public.coupon_prizes;
create trigger coupon_prizes_enforce_wheel_limit
  before insert or update of is_active, audience_scope, relationship_id
  on public.coupon_prizes
  for each row execute function public.enforce_coupon_prize_wheel_limit();

drop function if exists public.spin_gacha_for_current_user(text);
create function public.spin_gacha_for_current_user(p_audience_filter text default 'realm')
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
  v_audience_scope text;
  v_relationship_id uuid;
begin
  if v_user_id is null then raise exception 'Inicia sesión antes de girar la ruleta.'; end if;
  if not public.is_realm_member_or_admin() then
    raise exception 'Debes pertenecer al Realm para girar la ruleta.';
  end if;
  if p_audience_filter not in ('realm', 'relationship') then
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
        (p_audience_filter = 'realm' and prize.audience_scope in ('realm', 'individual'))
        or (
          p_audience_filter = 'relationship'
          and prize.audience_scope = 'relationship'
          and exists (
            select 1 from public.realm_relationships relationship
            where relationship.id = prize.relationship_id
              and relationship.status = 'accepted'
              and (relationship.initiator_id = v_user_id or relationship.partner_id = v_user_id)
          )
        )
      )
  )
  select
    jsonb_agg(to_jsonb(eligible) order by eligible.created_at, eligible.id),
    (array_agg(eligible.id order by random()))[1]
  into v_prize_list, v_prize_id
  from eligible;

  if v_prize_id is null or jsonb_array_length(v_prize_list) < 2 then
    raise exception 'Se necesitan al menos dos premios disponibles en esta ruleta para girar.';
  end if;
  if jsonb_array_length(v_prize_list) > 8 then
    raise exception 'La ruleta supera el límite de 8 premios activos. Desactiva algunos premios.';
  end if;

  select prize.value into v_prize
  from jsonb_array_elements(v_prize_list) as prize(value)
  where prize.value ->> 'id' = v_prize_id::text;

  v_audience_scope := case
    when v_prize ->> 'audience_scope' = 'relationship' then 'relationship'
    else 'realm'
  end;
  if v_audience_scope = 'relationship' then
    v_relationship_id := (v_prize ->> 'relationship_id')::uuid;
  end if;

  insert into public.coupons (
    user_id, title, description, is_redeemed, status, redeemed_at,
    audience_scope, relationship_id
  )
  values (
    v_user_id,
    v_prize ->> 'title',
    coalesce(v_prize ->> 'description', ''),
    false,
    'available',
    null,
    v_audience_scope,
    v_relationship_id
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

create table if not exists public.realm_map_hidden_members (
  viewer_id uuid not null references auth.users(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (viewer_id, member_id),
  constraint realm_map_hidden_members_distinct check (viewer_id <> member_id)
);

alter table public.realm_map_hidden_members enable row level security;
grant select, insert, delete on public.realm_map_hidden_members to authenticated;

drop policy if exists "Users manage their own hidden map members" on public.realm_map_hidden_members;
create policy "Users manage their own hidden map members"
  on public.realm_map_hidden_members for all
  to authenticated
  using (viewer_id = (select auth.uid()))
  with check (
    viewer_id = (select auth.uid())
    and exists (select 1 from public.realm_members where user_id = viewer_id)
    and exists (select 1 from public.realm_members where user_id = member_id)
  );
