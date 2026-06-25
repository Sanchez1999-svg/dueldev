-- Creating a duel debits the creator's stake immediately (handlePublish),
-- but if nobody ever accepts an open duel there was no way to back out --
-- the stake stayed frozen forever. Add an atomic cancel that only the
-- creator can call, only while the duel is still open, refunding the stake.
-- Mirrors the hardening pattern of accept_duel/finish_duel/void_duel.
create or replace function public.cancel_duel(p_duel_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_duel duels;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  select * into v_duel from duels where id = p_duel_id for update;

  if v_duel is null then
    raise exception 'duel not found';
  end if;

  if v_duel.creator_id <> auth.uid() then
    raise exception 'only the creator can cancel this duel';
  end if;

  if v_duel.status <> 'open' then
    raise exception 'only an open duel can be cancelled';
  end if;

  update duels set status = 'cancelled' where id = p_duel_id;
  update profiles set balance = balance + v_duel.stake where id = v_duel.creator_id;
end;
$$;

revoke all on function public.cancel_duel(uuid) from public, anon;
grant execute on function public.cancel_duel(uuid) to authenticated;
