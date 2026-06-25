-- Existing `timestamp` (no time zone) columns store UTC instants but are
-- returned by PostgREST without a `Z` suffix, which makes JS parse them as
-- local time. Convert to `timestamptz`, telling Postgres the stored naive
-- values are already UTC so no value actually shifts.

alter table public.duels
  alter column created_at type timestamptz using created_at at time zone 'utc',
  alter column started_at type timestamptz using started_at at time zone 'utc';

alter table public.duels
  alter column created_at set default now();

alter table public.solutions
  alter column submitted_at type timestamptz using submitted_at at time zone 'utc',
  alter column submitted_at set default now();
