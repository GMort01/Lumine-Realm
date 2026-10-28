alter table public.profiles
  add column if not exists last_group_spin_at timestamptz,
  add column if not exists last_relationship_spin_at timestamptz;

update public.profiles
set last_group_spin_at = coalesce(last_group_spin_at, last_spin_at),
    last_relationship_spin_at = coalesce(last_relationship_spin_at, last_spin_at)
where last_spin_at is not null;

grant select (last_group_spin_at, last_relationship_spin_at)
  on public.profiles
  to authenticated;
revoke update (last_group_spin_at, last_relationship_spin_at)
  on public.profiles
  from authenticated;

create or replace function public.spin_gacha_for_current_user(p_audience_filter text default 'realm')
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
  v_last_spin_at timestamptz;
  v_spin_at timestamptz;
  v_is_admin boolean;
begin
  if v_user_id is null then raise exception 'Inicia sesión antes de girar la ruleta.'; end if;
  if not public.is_realm_member_or_admin() then
    raise exception 'Debes pertenecer al Realm para girar la ruleta.';
  end if;
  if p_audience_filter not in ('realm', 'relationship') then
    raise exception 'El filtro de audiencia de la ruleta no es válido.';
  end if;

  v_is_admin := public.is_realm_admin();
  select case
      when p_audience_filter = 'relationship' then profile.last_relationship_spin_at
      else profile.last_group_spin_at
    end
    into v_last_spin_at
  from public.profiles profile
  where profile.id = v_user_id
  for update;

  if not found then
    raise exception 'No se encontró tu perfil para comprobar el tiempo de espera de la ruleta.';
  end if;
  if not v_is_admin and v_last_spin_at is not null
     and v_last_spin_at > clock_timestamp() - interval '24 hours' then
    raise exception 'Esta ruleta vuelve a estar disponible después de completar 24 horas.';
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

  v_spin_at := clock_timestamp();
  if p_audience_filter = 'relationship' then
    update public.profiles
    set last_relationship_spin_at = v_spin_at,
        last_spin_at = v_spin_at
    where id = v_user_id;
  else
    update public.profiles
    set last_group_spin_at = v_spin_at,
        last_spin_at = v_spin_at
    where id = v_user_id;
  end if;

  return jsonb_build_object(
    'coupon', to_jsonb(v_coupon),
    'prize', v_prize,
    'prizes', v_prize_list,
    'last_spin_at', v_spin_at
  );
end;
$$;

revoke all on function public.spin_gacha_for_current_user(text) from public, anon;
grant execute on function public.spin_gacha_for_current_user(text) to authenticated;

notify pgrst, 'reload schema';
