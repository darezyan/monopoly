-- Èkó: games and their action log.
-- The full game state is stored as JSON (it's exactly what the reducer produces),
-- and every player action is appended to game_actions so games can be replayed
-- or validated server-side later.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'playing' check (status in ('lobby', 'playing', 'finished')),
  settings jsonb not null default '{}'::jsonb,
  state jsonb not null,
  -- Bumped on every save; updates must match the version they read (optimistic locking)
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_created_by_idx on public.games (created_by, updated_at desc);

create table public.game_actions (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  actor uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action jsonb not null,
  created_at timestamptz not null default now()
);

create index game_actions_game_idx on public.game_actions (game_id, id);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_touch_updated_at
before update on public.games
for each row execute function public.touch_updated_at();

-- Row level security: for now a game belongs to the (anonymous) user who created it.
-- When online play arrives, these policies widen to the game's players.
alter table public.games enable row level security;
alter table public.game_actions enable row level security;

create policy "owners read their games" on public.games
  for select to authenticated using (created_by = auth.uid());
create policy "users create their own games" on public.games
  for insert to authenticated with check (created_by = auth.uid());
create policy "owners update their games" on public.games
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "owners delete their games" on public.games
  for delete to authenticated using (created_by = auth.uid());

create policy "owners read their game actions" on public.game_actions
  for select to authenticated
  using (exists (select 1 from public.games g where g.id = game_id and g.created_by = auth.uid()));
create policy "owners append actions to their games" on public.game_actions
  for insert to authenticated
  with check (
    actor = auth.uid()
    and exists (select 1 from public.games g where g.id = game_id and g.created_by = auth.uid())
  );

-- New tables aren't auto-exposed to the Data API, so grant explicitly.
-- Anonymous sign-ins use the "authenticated" role; plain "anon" gets nothing.
grant select, insert, update, delete on public.games to authenticated;
grant select, insert on public.game_actions to authenticated;
