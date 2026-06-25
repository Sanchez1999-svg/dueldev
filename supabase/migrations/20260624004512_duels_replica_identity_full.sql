-- Realtime's UPDATE payload only includes the primary key in `old` by
-- default (REPLICA IDENTITY DEFAULT). To detect a specific transition
-- (e.g. status open -> live) on the client we need the full previous row.
alter table public.duels replica identity full;
