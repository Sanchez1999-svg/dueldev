-- Temp fixture: an open duel owned by the QA test user so the cancel flow
-- can be exercised in the browser. Removed by the cleanup migration.
insert into duels (id, creator_id, task, language, duration_minutes, stake, status)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '8774ca1a-30b2-4aea-ae67-0a5cad38a264',
  'QA: отмена открытой дуэли', 'JavaScript', 60, 500, 'open'
);
