-- Placeholder for the future on-chain token (see solana-token/ tooling,
-- kept outside this repo since it holds a local treasury keypair).
--
-- Design (variant A, agreed with the user): the on-chain token's full
-- supply stays in a treasury wallet the project controls. Users never
-- hold the token directly -- `profiles.balance` remains the single
-- source of truth for what each user owns, exactly as today. This row
-- just records which on-chain mint that balance conceptually represents,
-- once one exists. Nothing in the app reads this table yet.
create table public.token_config (
  id boolean primary key default true,
  constraint token_config_singleton check (id),
  name text not null default 'DuelCoin',
  symbol text not null default 'DLC',
  decimals smallint not null default 0,
  cluster text not null default 'devnet',
  mint_address text,
  treasury_address text,
  updated_at timestamptz not null default now()
);

insert into public.token_config (id) values (true);

alter table public.token_config enable row level security;

-- Not secret, just project metadata; readable by anyone, writable only
-- via migrations/service role (no insert/update/delete policy defined).
create policy "Anyone can view token config" on public.token_config
  for select
  using (true);
