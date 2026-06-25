-- Same issue as duels.created_at/started_at and solutions.submitted_at,
-- fixed earlier: these were `timestamp` (no time zone), which PostgREST
-- serializes without a `Z`/offset, making JS parse them as local time.
-- Not currently read by the frontend, but fixing for consistency before
-- anything starts relying on them.
alter table public.profiles
  alter column created_at type timestamptz using created_at at time zone 'utc',
  alter column created_at set default now();

alter table public.votes
  alter column created_at type timestamptz using created_at at time zone 'utc',
  alter column created_at set default now();
