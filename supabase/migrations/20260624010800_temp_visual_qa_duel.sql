-- Temporary fixture for visual QA of the redesigned duel room layout.
-- Removed by the next migration.
insert into duels (id, creator_id, opponent_id, task, language, duration_minutes, stake, status, started_at)
values (
  '00000000-0000-0000-0000-0000000000aa',
  '8774ca1a-30b2-4aea-ae67-0a5cad38a264',
  '5ce7e3cd-907c-4a7c-9952-1c87c62b9e80',
  'Two Sum — найти два числа в массиве, сумма которых равна заданному значению',
  'JavaScript',
  60,
  100,
  'live',
  now()
);
