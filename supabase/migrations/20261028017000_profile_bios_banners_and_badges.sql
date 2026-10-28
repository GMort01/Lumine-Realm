alter table public.profiles
  add column if not exists bio text,
  add column if not exists banner_url text,
  add column if not exists custom_status text,
  add column if not exists badge text not null default 'Player';

update public.profiles
set badge = 'Player'
where badge is null;

alter table public.profiles
  alter column badge set default 'Player',
  alter column badge set not null;

alter table public.profiles
  drop constraint if exists profiles_bio_length_check,
  add constraint profiles_bio_length_check check (bio is null or char_length(bio) <= 300),
  drop constraint if exists profiles_custom_status_length_check,
  add constraint profiles_custom_status_length_check check (custom_status is null or char_length(custom_status) <= 100);

grant update (bio, banner_url, custom_status) on public.profiles to authenticated;
grant select (bio, banner_url, custom_status, badge) on public.profiles to authenticated;
