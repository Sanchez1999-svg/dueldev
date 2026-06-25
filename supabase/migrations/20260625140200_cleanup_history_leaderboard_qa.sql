delete from duels where id in ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-0000000000dd');
update profiles set wins = wins - 1 where id = '8774ca1a-30b2-4aea-ae67-0a5cad38a264';
update profiles set losses = losses - 1 where id = '5ce7e3cd-907c-4a7c-9952-1c87c62b9e80';
