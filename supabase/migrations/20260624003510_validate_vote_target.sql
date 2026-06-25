-- The INSERT policies on solutions/votes only checked `auth.uid() = user_id`
-- / `auth.uid() = voter_id` — they never verified the inserter is actually
-- a participant of that duel, or (for votes) that `voted_for` is one of
-- the two participants. A non-participant could insert solution/vote rows
-- for a duel they have nothing to do with, and votes could point at an
-- arbitrary profile instead of the opponent. This can't be expressed as a
-- plain CHECK (it needs a lookup into `duels`), so use BEFORE INSERT
-- triggers.
create or replace function public.validate_solution_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
begin
  select * into v_duel from duels where id = new.duel_id;
  if v_duel is null then
    raise exception 'duel not found';
  end if;
  if new.user_id not in (v_duel.creator_id, v_duel.opponent_id) then
    raise exception 'only a participant of this duel can submit a solution';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_solution_participant_trigger on solutions;
create trigger validate_solution_participant_trigger
  before insert on solutions
  for each row execute function public.validate_solution_participant();

create or replace function public.validate_vote_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
begin
  select * into v_duel from duels where id = new.duel_id;
  if v_duel is null then
    raise exception 'duel not found';
  end if;
  if new.voter_id not in (v_duel.creator_id, v_duel.opponent_id) then
    raise exception 'only a participant of this duel can vote';
  end if;
  if new.voted_for not in (v_duel.creator_id, v_duel.opponent_id) then
    raise exception 'can only vote for a participant of this duel';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_vote_participant_trigger on votes;
create trigger validate_vote_participant_trigger
  before insert on votes
  for each row execute function public.validate_vote_participant();
