-- Fixed-window rate limiting for the public /diagnose AI endpoints.
-- Only the service role (server-side route handlers) can touch this table.

create table if not exists public.diagnose_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists diagnose_rate_limits_window_idx
  on public.diagnose_rate_limits (window_start);

alter table public.diagnose_rate_limits enable row level security;

-- Atomically counts one request against `p_bucket` for the current window and
-- returns whether it is still within `p_limit`.
create or replace function public.consume_diagnose_quota(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.diagnose_rate_limits as r (bucket, window_start, request_count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
  do update set request_count = r.request_count + 1
  returning r.request_count into v_count;

  -- Opportunistic cleanup of windows older than two days.
  if random() < 0.01 then
    delete from public.diagnose_rate_limits where window_start < now() - interval '2 days';
  end if;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_diagnose_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_diagnose_quota(text, integer, integer) to service_role;
