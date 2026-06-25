-- When the submission deadline passes, nothing used to happen server-side:
-- the duel stayed "live" forever and both stakes stayed frozen. Add an RPC
-- that resolves a duel once its deadline has actually passed (computed
-- server-side, not trusted from the client clock):
--   - nobody submitted  -> void, refund both stakes
--   - exactly one submitted -> that player wins automatically
--   - both submitted -> no-op, the normal voting flow already handles it
create or replace function public.resolve_duel_timeout(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
  v_deadline timestamptz;
  v_submitted_ids uuid[];
  v_prize integer;
  v_winner uuid;
  v_loser uuid;
begin
  select * into v_duel from duels where id = p_duel_id for update;

  if v_duel is null then
    raise exception 'duel not found';
  end if;

  if v_duel.status <> 'live' then
    return;
  end if;

  if auth.uid() is null or auth.uid() not in (v_duel.creator_id, v_duel.opponent_id) then
    raise exception 'only a participant can resolve this duel';
  end if;

  v_deadline := coalesce(v_duel.started_at, v_duel.created_at) + (v_duel.duration_minutes || ' minutes')::interval;

  if now() < v_deadline then
    raise exception 'deadline has not passed yet';
  end if;

  select array_agg(user_id) into v_submitted_ids from solutions where duel_id = p_duel_id;

  if v_submitted_ids is null or array_length(v_submitted_ids, 1) = 0 then
    update duels set status = 'voided' where id = p_duel_id;
    update profiles set balance = balance + v_duel.stake where id in (v_duel.creator_id, v_duel.opponent_id);
  elsif array_length(v_submitted_ids, 1) = 1 then
    v_winner := v_submitted_ids[1];
    v_loser := case when v_winner = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end;
    v_prize := round(v_duel.stake * 2 * 0.9);
    update duels set status = 'finished', winner_id = v_winner where id = p_duel_id;
    update profiles set balance = balance + v_prize, wins = wins + 1 where id = v_winner;
    update profiles set losses = losses + 1 where id = v_loser;
  end if;
  -- both submitted: leave as-is, the voting flow on the client takes over
end;
$$;

revoke all on function public.resolve_duel_timeout(uuid) from public, anon;
grant execute on function public.resolve_duel_timeout(uuid) to authenticated;
