-- "Anyone can view profiles for duels" had `using (true)`, meaning a
-- completely anonymous, unauthenticated REST request could read every
-- profile's full row -- including `balance` -- for every user. Confirmed
-- live: an anon request returned everyone's balance. Usernames/wins/losses
-- legitimately need to be public (duel cards, leaderboard), but balance is
-- financial data and must stay private to the account owner.
--
-- Views in Postgres default to security_invoker = false, meaning the view
-- runs with its owner's privileges rather than the querying role's -- so a
-- view owned by the table owner bypasses RLS on the underlying table for
-- exactly the columns it selects. That lets us expose a public subset of
-- `profiles` without a public `using (true)` policy on the table itself.
create view public.public_profiles as
  select id, username, wins, losses from public.profiles;

grant select on public.public_profiles to anon, authenticated;

drop policy "Anyone can view profiles for duels" on public.profiles;
-- "Users can view own profile" (auth.uid() = id) remains, so the account
-- owner still sees their own balance.
