-- Èkó: in-game text chat for online rooms.
-- Run after 20261010180000_rooms.sql.

create table public.game_messages (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

-- Loading a game's latest messages
create index game_messages_game_id_idx on public.game_messages (game_id, id desc);

alter table public.game_messages enable row level security;

-- Only players seated in the game can read its chat, and only as themselves can they post
create policy "players read their game's chat" on public.game_messages
  for select to authenticated using (public.is_member(game_id));

create policy "players post in their game's chat" on public.game_messages
  for insert to authenticated with check (user_id = auth.uid() and public.is_member(game_id));

-- New tables aren't auto-exposed to the Data API, so grant explicitly.
-- No update or delete: messages are kept as sent (deleting the game removes them).
grant select, insert on public.game_messages to authenticated;

-- New messages arrive live
alter publication supabase_realtime add table public.game_messages;
