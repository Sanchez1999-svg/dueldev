insert into duels (id, creator_id, opponent_id, task, language, duration_minutes, stake, status, started_at, winner_id)
values
  ('00000000-0000-0000-0000-0000000000cc', '8774ca1a-30b2-4aea-ae67-0a5cad38a264', '5ce7e3cd-907c-4a7c-9952-1c87c62b9e80',
   'QA: история - победа', 'JavaScript', 30, 200, 'finished', now() - interval '2 hours', '8774ca1a-30b2-4aea-ae67-0a5cad38a264'),
  ('00000000-0000-0000-0000-0000000000dd', '5ce7e3cd-907c-4a7c-9952-1c87c62b9e80', '8774ca1a-30b2-4aea-ae67-0a5cad38a264',
   'QA: история - ничья', 'Python', 30, 150, 'voided', now() - interval '1 day', null);

update profiles set wins = wins + 1 where id = '8774ca1a-30b2-4aea-ae67-0a5cad38a264';
update profiles set losses = losses + 1 where id = '5ce7e3cd-907c-4a7c-9952-1c87c62b9e80';
