-- Defense-in-depth: these invariants were only enforced in the frontend
-- (range sliders, dropdowns), so any direct REST/RPC call — or a future
-- bug like the accept/finish-duel races already fixed — could push the
-- data into a nonsensical or exploitable state.
alter table public.duels
  add constraint duels_stake_positive check (stake > 0),
  add constraint duels_duration_positive check (duration_minutes > 0),
  add constraint duels_creator_not_opponent check (creator_id is distinct from opponent_id);

alter table public.profiles
  add constraint profiles_balance_nonnegative check (balance >= 0);
