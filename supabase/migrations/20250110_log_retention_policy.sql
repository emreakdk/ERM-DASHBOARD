-- Log retention maintenance: cleanup function + supporting indexes

create or replace function public.cleanup_old_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove activity logs older than 30 days
  delete from public.activity_logs
  where created_at < (now() - interval '30 days');

  -- Remove system error logs older than 15 days
  delete from public.system_errors
  where created_at < (now() - interval '15 days');
end;
$$;

comment on function public.cleanup_old_logs is 'Deletes activity_logs older than 30 days and system_errors older than 15 days.';

-- Ensure efficient pruning by indexing created_at columns (idempotent)
create index if not exists idx_activity_logs_created_at
  on public.activity_logs using btree (created_at);

create index if not exists idx_system_errors_created_at
  on public.system_errors using btree (created_at);
