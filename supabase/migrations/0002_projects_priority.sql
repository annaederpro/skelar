create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.tasks
  add column if not exists priority smallint not null default 4 check (priority between 1 and 4);
alter table public.tasks
  add column if not exists due_date date;

create index if not exists tasks_project_id_idx on public.tasks(project_id);
create index if not exists tasks_due_date_idx on public.tasks(due_date);
create index if not exists tasks_priority_idx on public.tasks(priority);

alter table public.projects enable row level security;

create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);
create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);
