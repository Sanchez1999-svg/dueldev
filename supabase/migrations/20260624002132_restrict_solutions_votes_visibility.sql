-- "Participants can view solutions"/"votes" were `using (true)` — anyone
-- (including non-participants) could read a duel's solutions/votes via
-- REST directly, in particular an opponent could read the other player's
-- code before submitting their own. Restrict SELECT to: the row owner,
-- a participant who already submitted/voted themselves, or anyone once
-- the duel is decided.
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
    or exists (
      select 1 from solutions s2
      where s2.duel_id = solutions.duel_id and s2.user_id = auth.uid()
    )
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
    or exists (
      select 1 from votes v2
      where v2.duel_id = votes.duel_id and v2.voter_id = auth.uid()
    )
  );
