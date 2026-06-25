-- The previous migration's policies queried `solutions`/`votes` from
-- within their own SELECT policy, which Postgres re-evaluates through the
-- same policy -> infinite recursion (42P17). Move the self-check into a
-- SECURITY DEFINER function: as the table owner it bypasses RLS, so the
-- inner lookup doesn't re-trigger the policy.
create or replace function public.has_submitted_solution(p_duel_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from solutions where duel_id = p_duel_id and user_id = p_user_id);
$$;

create or replace function public.has_cast_vote(p_duel_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from votes where duel_id = p_duel_id and voter_id = p_user_id);
$$;

drop policy if exists "Participants can view solutions" on solutions;
create policy "Participants can view solutions" on solutions
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from duels d
      where d.id = solutions.duel_id
        and auth.uid() in (d.creator_id, d.opponent_id)
        and d.status in ('finished', 'voided')
    )
    or public.has_submitted_solution(solutions.duel_id, auth.uid())
  );

drop policy if exists "Participants can view votes" on votes;
create policy "Participants can view votes" on votes
  for select
  using (
    auth.uid() = voter_id
    or exists (
      select 1 from duels d
      where d.id = votes.duel_id
        and auth.uid() in (d.creator_id, d.opponent_id)
        and d.status in ('finished', 'voided')
    )
    or public.has_cast_vote(votes.duel_id, auth.uid())
  );
