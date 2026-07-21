alter table public.tasks
  add column if not exists due_time time;

do $$ begin
  alter table public.tasks
    add constraint tasks_due_time_requires_due_date
    check (due_time is null or due_date is not null);
exception when duplicate_object then null; end $$;
