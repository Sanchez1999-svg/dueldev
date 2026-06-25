-- Remove the cancel-QA fixture duel and undo the +500 refund the test
-- exercised, restoring the test user's balance to its pre-test value.
delete from duels where id = '00000000-0000-0000-0000-0000000000a1';
update profiles set balance = balance - 500 where id = '8774ca1a-30b2-4aea-ae67-0a5cad38a264';
