create or replace function public.get_gacha_cooldown_for_current_user(p_audience_filter text)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_spin_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Inicia sesión antes de consultar la ruleta.';
  end if;
  if not public.is_realm_member_or_admin() then
    raise exception 'Debes pertenecer al Realm para consultar la ruleta.';
  end if;
  if p_audience_filter is null or p_audience_filter not in ('realm', 'relationship') then
    raise exception 'El filtro de audiencia de la ruleta no es válido.';
  end if;

  select case
      when p_audience_filter = 'relationship' then profile.last_relationship_spin_at
      else profile.last_group_spin_at
    end
    into v_last_spin_at
  from public.profiles profile
  where profile.id = v_user_id;

  if not found then
    raise exception 'No se encontró tu perfil para comprobar el tiempo de espera de la ruleta.';
  end if;

  return v_last_spin_at;
end;
$$;

revoke all on function public.get_gacha_cooldown_for_current_user(text) from public, anon;
grant execute on function public.get_gacha_cooldown_for_current_user(text) to authenticated;

notify pgrst, 'reload schema';
