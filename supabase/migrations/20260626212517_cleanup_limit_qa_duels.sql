-- Remove the 5 open duels created while verifying the open-duel limit trigger.
delete from duels
where creator_id = '8774ca1a-30b2-4aea-ae67-0a5cad38a264'
  and status = 'open'
  and task like 'QA limit test %';
