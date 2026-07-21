alter table public.tasks
  add column if not exists is_seeded boolean not null default false;
