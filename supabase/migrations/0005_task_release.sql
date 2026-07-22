alter table public.tasks add column if not exists released_at timestamptz;
create index if not exists tasks_released_at_idx on public.tasks(released_at);
