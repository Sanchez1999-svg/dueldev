-- When the two participants vote for different winners, the duel used to
-- stay stuck in "live" forever with both stakes frozen (the UI only
-- handles the agreeing-votes case). Add a "voided" outcome: both stakes
-- get refunded and the duel is marked finished with no winner.
create or replace function public.void_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
  v_vote_count integer;
  v_distinct_winners integer;
begin
  select * into v_duel from duels where id = p_duel_id for update;

  if v_duel is null then
    raise exception 'duel not found';
  end if;

  if v_duel.status <> 'live' then
    raise exception 'duel is not live';
  end if;

  if auth.uid() is null or auth.uid() not in (v_duel.creator_id, v_duel.opponent_id) then
    raise exception 'only a participant can void this duel';
  end if;

  select count(*), count(distinct voted_for) into v_vote_count, v_distinct_winners
    from votes where duel_id = p_duel_id;

  if v_vote_count < 2 or v_distinct_winners < 2 then
    raise exception 'voiding requires two disagreeing votes';
  end if;

  update duels set status = 'voided' where id = p_duel_id;
  update profiles set balance = balance + v_duel.stake where id in (v_duel.creator_id, v_duel.opponent_id);
end;
$$;

revoke all on function public.void_duel(uuid) from public, anon;
grant execute on function public.void_duel(uuid) to authenticated;
