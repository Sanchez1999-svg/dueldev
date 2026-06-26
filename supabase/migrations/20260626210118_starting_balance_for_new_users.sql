-- New users were created with balance 0 and literally couldn't play until
-- someone topped them up. Grant a starting balance of 5000 DLC on signup.
-- Set both the column default (so any direct insert is covered) and make
-- the signup trigger explicit.
alter table public.profiles alter column balance set default 5000;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    5000
  );
  return new;
end;
$$;
