alter table public.coupons
  drop constraint if exists coupons_status_check;
alter table public.coupons
  add constraint coupons_status_check
  check (status in ('available', 'requested', 'redeemed', 'declined'));

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
     or v_coupon.status not in ('available', 'declined')
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
      if p_target_user_id = v_user_id then
        raise exception 'No puedes solicitar el canje de tu cupón para ti mismo.';
      end if;
      if not exists (select 1 from public.realm_members where user_id = p_target_user_id) then
        raise exception 'El destinatario debe pertenecer al Realm.';
      end if;
      v_target_user_id := p_target_user_id;
    end if;
  end if;

  update public.coupons
  set status = 'requested',
      redemption_target_user_id = v_target_user_id,
      redemption_for_all = p_for_all,
      redeemed_at = null,
      is_redeemed = false
  where id = p_coupon_id
  returning * into v_coupon;

  return to_jsonb(v_coupon);
end;
$$;

create or replace function public.get_my_incoming_coupon_redemption_requests()
returns setof public.coupons
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Inicia sesión para consultar solicitudes de canje.';
  end if;
  if not public.is_realm_member_or_admin() then
    raise exception 'Debes pertenecer al Realm para consultar solicitudes de canje.';
  end if;

  return query
  select coupon.*
  from public.coupons coupon
  where coupon.status = 'requested'
    and coupon.redemption_target_user_id = v_user_id
    and coupon.user_id <> v_user_id
    and (
      (coupon.audience_scope = 'realm' and exists (
        select 1 from public.realm_members member
        where member.user_id = v_user_id
      ))
      or (
        coupon.audience_scope = 'relationship'
        and exists (
          select 1 from public.realm_relationships relationship
          where relationship.id = coupon.relationship_id
            and relationship.status = 'accepted'
            and (relationship.initiator_id = v_user_id or relationship.partner_id = v_user_id)
        )
      )
    )
  order by coupon.created_at asc;
end;
$$;

create or replace function public.respond_to_coupon_redemption(
  p_coupon_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_coupon public.coupons%rowtype;
begin
  if v_user_id is null then
    raise exception 'Inicia sesión para responder a la solicitud.';
  end if;
  if p_accept is null then
    raise exception 'La respuesta a la solicitud no es válida.';
  end if;

  select * into v_coupon
  from public.coupons coupon
  where coupon.id = p_coupon_id
    and coupon.status = 'requested'
    and coupon.redemption_target_user_id = v_user_id
    and coupon.user_id <> v_user_id
  for update;

  if not found then
    raise exception 'La solicitud ya fue atendida o no está dirigida a tu cuenta.';
  end if;
  if v_coupon.audience_scope = 'relationship' and not exists (
    select 1 from public.realm_relationships relationship
    where relationship.id = v_coupon.relationship_id
      and relationship.status = 'accepted'
      and (relationship.initiator_id = v_user_id or relationship.partner_id = v_user_id)
  ) then
    raise exception 'El vínculo de pareja ya no está activo.';
  end if;
  if v_coupon.audience_scope = 'realm' and not exists (
    select 1 from public.realm_members member
    where member.user_id = v_user_id
  ) then
    raise exception 'Ya no perteneces al Realm.';
  end if;

  update public.coupons
  set status = case when p_accept then 'redeemed' else 'declined' end,
      is_redeemed = p_accept,
      redeemed_at = case when p_accept then now() else null end
  where id = p_coupon_id
  returning * into v_coupon;

  return to_jsonb(v_coupon);
end;
$$;

revoke all on function public.request_coupon_redemption(uuid, uuid, boolean) from public, anon;
revoke all on function public.get_my_incoming_coupon_redemption_requests() from public, anon;
revoke all on function public.respond_to_coupon_redemption(uuid, boolean) from public, anon;
grant execute on function public.request_coupon_redemption(uuid, uuid, boolean) to authenticated;
grant execute on function public.get_my_incoming_coupon_redemption_requests() to authenticated;
grant execute on function public.respond_to_coupon_redemption(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
