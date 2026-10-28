create or replace function public.get_realm_profiles_for_admin()
returns table (
  user_id uuid,
  username text,
  email text,
  country text,
  avatar_url text,
  role text,
  is_member boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'mau.san.0275@gmail.com' then
    raise exception 'Solo el administrador puede consultar los perfiles registrados.';
  end if;

  return query
  select
    users.id,
    coalesce(nullif(trim(profiles.username), ''), nullif(split_part(users.email, '@', 1), ''), 'Jugador'),
    coalesce(users.email, ''),
    coalesce(profiles.country, ''),
    profiles.avatar_url,
    case
      when lower(coalesce(users.email, '')) = 'mau.san.0275@gmail.com' then 'admin'
      else 'player'
    end,
    exists (
      select 1
      from public.realm_members members
      where members.user_id = users.id
    )
  from auth.users users
  left join public.profiles profiles on profiles.id = users.id
  where profiles.id is not null
     or lower(coalesce(users.email, '')) = 'mau.san.0275@gmail.com'
  order by
    case when lower(coalesce(users.email, '')) = 'mau.san.0275@gmail.com' then 0 else 1 end,
    lower(coalesce(profiles.username, users.email, ''));
end;
$$;

revoke all on function public.get_realm_profiles_for_admin() from public, anon;
grant execute on function public.get_realm_profiles_for_admin() to authenticated;

create or replace function public.set_realm_member_enabled(
  p_user_id uuid,
  p_is_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'mau.san.0275@gmail.com' then
    raise exception 'Solo el administrador puede gestionar los miembros del Realm.';
  end if;

  if p_user_id is null or p_is_enabled is null then
    raise exception 'El usuario y el estado de vinculación son obligatorios.';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'No existe una cuenta registrada con ese identificador.';
  end if;

  if not p_is_enabled and p_user_id = auth.uid() then
    raise exception 'No puedes quitar tu propia cuenta del Realm.';
  end if;

  if p_is_enabled then
    insert into public.realm_members (user_id, invited_by)
    values (p_user_id, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from public.realm_members
    where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.set_realm_member_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_realm_member_enabled(uuid, boolean) to authenticated;

create or replace function public.link_realm_user_by_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_invitation_id uuid;
  v_already_member boolean;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'mau.san.0275@gmail.com' then
    raise exception 'Solo el administrador puede invitar o vincular usuarios.';
  end if;

  if v_email = '' or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Escribe un correo electrónico válido.';
  end if;

  select users.id
    into v_user_id
    from auth.users users
    where lower(users.email) = v_email
    limit 1;

  if v_user_id is not null then
    select exists (
      select 1 from public.realm_members members where members.user_id = v_user_id
    )
    into v_already_member;

    insert into public.realm_members (user_id, invited_by)
    values (v_user_id, auth.uid())
    on conflict (user_id) do nothing;

    update public.realm_invitations
      set status = 'accepted', accepted_at = now()
      where lower(email) = v_email and status = 'pending';

    return jsonb_build_object(
      'kind', 'member',
      'email', v_email,
      'already_member', v_already_member
    );
  end if;

  select invitations.id
    into v_invitation_id
    from public.realm_invitations invitations
    where lower(invitations.email) = v_email
      and invitations.status = 'pending'
    limit 1;

  if v_invitation_id is not null then
    return jsonb_build_object(
      'kind', 'invitation',
      'email', v_email,
      'invitation_id', v_invitation_id,
      'already_invited', true
    );
  end if;

  insert into public.realm_invitations (email, invited_by)
  values (v_email, auth.uid())
  returning id into v_invitation_id;

  return jsonb_build_object(
    'kind', 'invitation',
    'email', v_email,
    'invitation_id', v_invitation_id,
    'already_invited', false
  );
end;
$$;

revoke all on function public.link_realm_user_by_email(text) from public, anon;
grant execute on function public.link_realm_user_by_email(text) to authenticated;

create or replace function public.add_realm_admin_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation_id uuid;
  v_invited_by uuid;
begin
  if lower(coalesce(new.email, '')) = 'mau.san.0275@gmail.com' then
    insert into public.realm_members (user_id, invited_by)
    values (new.id, new.id)
    on conflict (user_id) do nothing;
  else
    select invitations.id, invitations.invited_by
      into v_invitation_id, v_invited_by
      from public.realm_invitations invitations
      where lower(invitations.email) = lower(new.email)
        and invitations.status = 'pending'
      order by invitations.created_at
      limit 1
      for update;

    if v_invitation_id is not null then
      insert into public.realm_members (user_id, invited_by)
      values (new.id, v_invited_by)
      on conflict (user_id) do nothing;

      update public.realm_invitations
        set status = 'accepted', accepted_at = now()
        where id = v_invitation_id;
    end if;
  end if;

  return new;
end;
$$;
