-- Anti-abuse: stop a single user from flooding the board with open duels.
-- Cap each creator at 5 simultaneously open (unaccepted) duels. Enforced in
-- the DB so it can't be bypassed via direct REST calls.
create or replace function public.enforce_open_duel_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_count integer;
begin
  if new.status = 'open' then
    select count(*) into v_open_count
      from duels
      where creator_id = new.creator_id and status = 'open';
    if v_open_count >= 5 then
      raise exception 'open duel limit reached';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_open_duel_limit_trigger on duels;
create trigger enforce_open_duel_limit_trigger
  before insert on duels
  for each row execute function public.enforce_open_duel_limit();
