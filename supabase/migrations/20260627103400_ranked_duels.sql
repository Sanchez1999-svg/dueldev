-- Ranked (auto-judged) duels: a duel with a problem_id is scored by hidden
-- test cases instead of mutual voting. Scores and the winner are written
-- ONLY by the server (service_role) via the judging route, so players can't
-- forge results.

alter table public.duels add column if not exists problem_id text;

-- Verified pass counts, written by the server after running the tests.
alter table public.solutions add column if not exists score integer;
alter table public.solutions add column if not exists total integer;

-- For ranked duels, a solution may only be inserted by the trusted server
-- (service_role) — never directly by a player's client — so the recorded
-- score is always the judged one. Custom (voting) duels are unaffected.
create or replace function public.enforce_ranked_solution_source()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from duels d where d.id = new.duel_id and d.problem_id is not null) then
    if coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'ranked solutions must be submitted through judging';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_ranked_solution_source_trigger on solutions;
create trigger enforce_ranked_solution_source_trigger
  before insert on solutions
  for each row execute function public.enforce_ranked_solution_source();

-- Finalize a ranked duel from the server-recorded scores. Winner = higher
-- score; tie on score -> earlier submission; if the top score is 0 (both
-- failed everything) -> void and refund. Callable only by the server.
create or replace function public.finish_ranked_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
  v_sol_count integer;
  v_winner uuid;
  v_loser uuid;
  v_top_score integer;
  v_prize integer;
begin
  select * into v_duel from duels where id = p_duel_id for update;
  if v_duel is null then raise exception 'duel not found'; end if;
  if v_duel.problem_id is null then raise exception 'not a ranked duel'; end if;
  if v_duel.status <> 'live' then return; end if;

  select count(*) into v_sol_count from solutions where duel_id = p_duel_id;
  if v_sol_count < 2 then raise exception 'both solutions required'; end if;

  select user_id, score into v_winner, v_top_score
    from solutions
    where duel_id = p_duel_id
    order by score desc nulls last, submitted_at asc
    limit 1;

  if coalesce(v_top_score, 0) = 0 then
    -- nobody passed anything: void and refund both stakes
    update duels set status = 'voided' where id = p_duel_id;
    update profiles set balance = balance + v_duel.stake
      where id in (v_duel.creator_id, v_duel.opponent_id);
    return;
  end if;

  v_loser := case when v_winner = v_duel.creator_id then v_duel.opponent_id else v_duel.creator_id end;
  v_prize := round(v_duel.stake * 2 * 0.9);

  update duels set status = 'finished', winner_id = v_winner where id = p_duel_id;
  update profiles set balance = balance + v_prize, wins = wins + 1 where id = v_winner;
  update profiles set losses = losses + 1 where id = v_loser;
end;
$$;

revoke all on function public.finish_ranked_duel(uuid) from public, anon, authenticated;
-- service_role bypasses GRANTs as table owner-level, but be explicit:
grant execute on function public.finish_ranked_duel(uuid) to service_role;
