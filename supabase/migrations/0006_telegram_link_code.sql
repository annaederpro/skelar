alter table public.users
  add column if not exists telegram_link_code text;
alter table public.users
  add column if not exists telegram_link_code_expires_at timestamptz;
