alter table public.users
  add column if not exists daily_reminder_enabled boolean not null default false;

alter table public.tasks
  add column if not exists telegram_confirmation_message_id bigint;
