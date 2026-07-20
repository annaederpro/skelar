-- Gentle Productivity — Block 1 initial schema
-- Run this in Supabase SQL editor (or as a migration file)

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- ENUM types
-- ─────────────────────────────────────────────
do $$ begin
  create type resource_status as enum ('depleted', 'normal', 'high');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo', 'completed');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- users
-- Mirrors auth.users (Supabase Auth). id matches auth.users.id 1:1.
-- ─────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  current_resource_status resource_status not null default 'normal',
  telegram_chat_id text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  status task_status not null default 'todo',
  energy_level smallint not null check (energy_level between 1 and 3),
  duration_minutes int not null default 30,
  is_backlog boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_energy_level_idx on public.tasks(energy_level);

-- ─────────────────────────────────────────────
-- Auto-create a public.users row whenever a new auth.users row appears
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.tasks enable row level security;

create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on public.tasks for delete
  using (auth.uid() = user_id);

-- Service role (used by the Telegram bot / server routes with the service key)
-- bypasses RLS automatically, so no extra policy is needed for that path.
