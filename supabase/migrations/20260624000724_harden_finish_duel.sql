-- finish_duel was a SECURITY DEFINER RPC with zero validation: any caller
-- (including anon, unauthenticated) could pass an arbitrary duel_id and
-- winner_id and have the prize credited to that profile, bypassing the
-- game entirely. Lock it down to: caller must be a participant, the duel
-- must still be live, the winner must be one of the two participants, and
-- the two votes (if both present) must actually agree on that winner.
create or replace function public.finish_duel(p_duel_id uuid, p_winner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
  v_loser_id uuid;
  v_vote_count integer;
  v_agreeing_votes integer;
  v_prize integer;
begin
  select * into v_duel from duels where id = p_duel_id for update;

  if v_duel is null then
    raise exception 'duel not found';
  end if;

  if v_duel.status <> 'live' then
    raise exception 'duel is not live';
  end if;

  if auth.uid() is null or auth.uid() not in (v_duel.creator_id, v_duel.opponent_id) then
    raise exception 'only a participant can finish this duel';
  end if;

  if p_winner_id not in (v_duel.creator_id, v_duel.opponent_id) then
    raise exception 'winner must be a participant';
  end if;

  select count(*), count(*) filter (where voted_for = p_winner_id)
    into v_vote_count, v_agreeing_votes
    from votes where duel_id = p_duel_id;

  if v_vote_count < 2 or v_agreeing_votes < 2 then
    raise exception 'both participants must vote for the same winner';
  end if;

  v_loser_id := case when p_winner_id = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end;
  v_prize := round(v_duel.stake * 2 * 0.9);

  update duels set status = 'finished', winner_id = p_winner_id where id = p_duel_id;
  update profiles set balance = balance + v_prize, wins = wins + 1 where id = p_winner_id;
  update profiles set losses = losses + 1 where id = v_loser_id;
end;
$$;

revoke all on function public.finish_duel(uuid, uuid) from public, anon;
grant execute on function public.finish_duel(uuid, uuid) to authenticated;

-- "Anyone can accept open duels" let the creator accept their own duel
-- (opponent_id = creator_id), double-counting their stake and corrupting
-- solutions/votes since both "sides" would share one user id.
drop policy if exists "Anyone can accept open duels" on duels;
create policy "Anyone can accept open duels" on duels
  for update
  using (status = 'open')
  with check (auth.uid() = opponent_id and auth.uid() <> creator_id);

-- Drop the temporary introspection helper used to audit the schema.
drop function if exists public.__debug_introspect();
