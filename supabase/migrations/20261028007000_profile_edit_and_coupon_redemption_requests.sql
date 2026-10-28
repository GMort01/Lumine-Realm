alter table public.coupons
  add column if not exists expires_at timestamptz,
  add column if not exists status text default 'available';

update public.coupons
set status = case
  when is_redeemed then 'redeemed'
  else coalesce(nullif(status, ''), 'available')
end
where status is null
   or status not in ('available', 'requested', 'redeemed')
   or (is_redeemed and status <> 'redeemed');

alter table public.coupons
  alter column status set default 'available',
  alter column status set not null;

alter table public.coupons
  drop constraint if exists coupons_status_check;

alter table public.coupons
  add constraint coupons_status_check
  check (status in ('available', 'requested', 'redeemed'));

alter table public.profiles enable row level security;

drop policy if exists "Usuarios pueden actualizar su propio perfil" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (username, country, avatar_url) on public.profiles to authenticated;

alter table public.coupons enable row level security;

drop policy if exists "Usuarios canjean sus propios cupones" on public.coupons;
drop policy if exists "Users can redeem their own coupons" on public.coupons;
drop policy if exists "Usuarios canjean cupones propios una vez" on public.coupons;
drop policy if exists "Users can request their own coupon redemption" on public.coupons;
drop policy if exists "Realm admin can approve coupon redemptions" on public.coupons;
drop policy if exists "Realm admin can view requested coupons" on public.coupons;

create policy "Users can request their own coupon redemption"
  on public.coupons for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'available'
    and not is_redeemed
    and (expires_at is null or expires_at > now())
  )
  with check (
    (select auth.uid()) = user_id
    and status = 'requested'
    and not is_redeemed
    and redeemed_at is null
  );

create policy "Realm admin can view requested coupons"
  on public.coupons for select
  to authenticated
  using (
    status = 'requested'
    and lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
  );

create policy "Realm admin can approve coupon redemptions"
  on public.coupons for update
  to authenticated
  using (
    status = 'requested'
    and lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
  )
  with check (
    status = 'redeemed'
    and is_redeemed
    and redeemed_at is not null
    and lower((select auth.jwt() ->> 'email')) = 'mau.san.0275@gmail.com'
  );

revoke update on public.coupons from authenticated;
grant update (status, is_redeemed, redeemed_at) on public.coupons to authenticated;
