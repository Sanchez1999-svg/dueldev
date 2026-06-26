-- Remove the throwaway QA signup used to verify the 5000 starting balance.
-- Deleting the auth user cascades to public.profiles via the FK.
delete from auth.users where id = 'fef722c7-b669-4e71-a676-c381a3bfba7d';
