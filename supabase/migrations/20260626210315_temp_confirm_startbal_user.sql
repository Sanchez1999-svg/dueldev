-- Confirm the throwaway QA signup so we can log in and read its starting
-- balance to verify the 5000 grant. Harmless (test account).
update auth.users set email_confirmed_at = now()
where id = 'fef722c7-b669-4e71-a676-c381a3bfba7d';
