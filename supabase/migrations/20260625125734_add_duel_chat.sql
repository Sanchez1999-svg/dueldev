create table public.messages (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references public.duels(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  text text not null check (char_length(text) > 0 and char_length(text) <= 2000),
  created_at timestamptz not null default now()
);

create index messages_duel_id_idx on public.messages(duel_id, created_at);

alter table public.messages enable row level security;

-- Only the two participants of a duel can read or write its chat.
create policy "Participants can view messages" on public.messages
  for select
  using (
    exists (
      select 1 from duels d
      where d.id = messages.duel_id
        and auth.uid() in (d.creator_id, d.opponent_id)
    )
  );

create policy "Participants can send messages" on public.messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from duels d
      where d.id = messages.duel_id
        and auth.uid() in (d.creator_id, d.opponent_id)
    )
  );

alter publication supabase_realtime add table public.messages;
