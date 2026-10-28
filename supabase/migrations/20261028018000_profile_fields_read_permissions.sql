grant select (bio, banner_url, custom_status, badge)
  on public.profiles
  to authenticated;

notify pgrst, 'reload schema';
