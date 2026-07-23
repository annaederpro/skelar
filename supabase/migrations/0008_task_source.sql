alter table public.tasks
  add column if not exists source text not null default 'app'
    check (source in ('app', 'telegram'));
