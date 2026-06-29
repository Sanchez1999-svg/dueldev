-- Allow betting a physical item instead of DLC. The app cannot transfer a
-- real-world item -- it can only record what was agreed and who won; the
-- two participants exchange it themselves (this is the low-stakes,
-- "friends settling a bet" use case, not a money/escrow feature).
alter table public.duels add column if not exists stake_type text not null default 'dlc';
alter table public.duels add column if not exists item_description text;

alter table public.duels
  add constraint duels_stake_type_check check (stake_type in ('dlc', 'item'));

alter table public.duels
  add constraint duels_item_description_check check (
    (stake_type = 'item' and item_description is not null and char_length(item_description) between 1 and 300)
    or (stake_type = 'dlc' and item_description is null)
  );

-- Item duels move no DLC, so the existing "stake > 0" rule must allow 0
-- for them; dlc duels keep the original positive-stake requirement.
alter table public.duels drop constraint if exists duels_stake_positive;
alter table public.duels
  add constraint duels_stake_positive check (
    (stake_type = 'dlc' and stake > 0) or (stake_type = 'item' and stake = 0)
  );

-- accept_duel only checks/deducts balance for staked (stake > 0) duels, so
-- item duels (stake = 0) skip the balance requirement entirely.
create or replace function public.accept_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
  v_balance integer;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_duel from duels where id = p_duel_id for update;

  if v_duel is null then
    raise exception 'duel not found';
  end if;

  if v_duel.status <> 'open' then
    raise exception 'duel already accepted';
  end if;

  if v_duel.creator_id = auth.uid() then
    raise exception 'cannot accept your own duel';
  end if;

  if v_duel.stake > 0 then
    select balance into v_balance from profiles where id = auth.uid() for update;
    if v_balance is null or v_balance < v_duel.stake then
      raise exception 'insufficient balance';
    end if;
    update profiles set balance = balance - v_duel.stake where id = auth.uid();
  end if;

  update duels set opponent_id = auth.uid(), status = 'live', started_at = now() where id = p_duel_id;
end;
$$;
