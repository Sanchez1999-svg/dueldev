-- handleAccept() did the "claim the duel" UPDATE and the "deduct balance"
-- UPDATE as two separate client calls, and never checked whether the first
-- UPDATE actually matched a row. If two players accepted the same duel at
-- the same instant, the loser of the race got 0 rows affected (no error),
-- but the client still unconditionally deducted their stake — debiting a
-- player who never became a participant. Move both steps into one atomic
-- SECURITY DEFINER RPC.
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

  select balance into v_balance from profiles where id = auth.uid() for update;

  if v_balance is null or v_balance < v_duel.stake then
    raise exception 'insufficient balance';
  end if;

  update duels set opponent_id = auth.uid(), status = 'live', started_at = now() where id = p_duel_id;
  update profiles set balance = balance - v_duel.stake where id = auth.uid();
end;
$$;

revoke all on function public.accept_duel(uuid) from public, anon;
grant execute on function public.accept_duel(uuid) to authenticated;

-- The RPC (SECURITY DEFINER) is now the only sanctioned way to transition
-- a duel from open -> live; drop the direct-UPDATE policy that the old,
-- racy client code relied on.
drop policy if exists "Anyone can accept open duels" on duels;
