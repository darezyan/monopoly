-- Èkó: online rooms that friends join with a short code (e.g. EKO-7KQ2).
-- Run after 20261010120000_init.sql.

-- ---------- Rooms ----------

alter table public.games add column code text unique;

-- Who sits where in a game. Robots have no user_id.
create table public.game_players (
  game_id uuid not null references public.games (id) on delete cascade,
  seat smallint not null check (seat between 0 and 7),
  user_id uuid references auth.users (id) on delete set null,
  nickname text not null check (char_length(nickname) between 1 and 16),
  token text not null check (token in ('danfo', 'okada', 'taxi', 'canoe', 'jollof', 'drum', 'agbada', 'gen')),
  robot text check (robot in ('easy', 'normal', 'sharp')),
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (game_id, seat),
  unique (game_id, token),
  unique (game_id, user_id)
);

-- ---------- Membership helpers ----------
-- security definer so policies can check membership without recursing into
-- game_players' own row-level security.

create function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.game_players p where p.game_id = g and p.user_id = auth.uid())
$$;

create function public.is_host(g uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.games x where x.id = g and x.created_by = auth.uid())
$$;

-- ---------- Creating and joining ----------

create function public.create_room(p_nickname text, p_token text, p_settings jsonb default '{}'::jsonb)
returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
  c text;
  -- No 0/O or 1/I/L, so codes are easy to read out over the phone
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  loop
    c := 'EKO-';
    for i in 1..4 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.games where code = c);
  end loop;

  insert into public.games (created_by, status, settings, state, code)
  values (auth.uid(), 'lobby', coalesce(p_settings, '{}'::jsonb), '{}'::jsonb, c)
  returning * into g;

  insert into public.game_players (game_id, seat, user_id, nickname, token)
  values (g.id, 0, auth.uid(), trim(p_nickname), p_token);

  return g;
end;
$$;

create function public.join_room(p_code text, p_nickname text, p_token text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
  normalized text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  free_seat smallint;
  chosen text := p_token;
  all_tokens constant text[] := array['danfo', 'okada', 'taxi', 'canoe', 'jollof', 'drum', 'agbada', 'gen'];
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  -- Accept "7KQ2" as well as "EKO-7KQ2"
  if normalized not like 'EKO-%' then
    normalized := 'EKO-' || regexp_replace(normalized, '^EKO', '');
  end if;

  select * into g from public.games where code = normalized for update;
  if not found then
    raise exception 'No room with that code' using errcode = 'P0002';
  end if;

  -- Rejoining your own seat always works, even mid-game
  if exists (select 1 from public.game_players where game_id = g.id and user_id = auth.uid()) then
    return g.id;
  end if;
  if g.status <> 'lobby' then
    raise exception 'That game has already started';
  end if;

  select min(n)::smallint into free_seat
  from generate_series(0, 7) n
  where n not in (select seat from public.game_players where game_id = g.id);
  if free_seat is null then
    raise exception 'That room is full';
  end if;

  -- If the token they wanted is taken, give them the first free one
  if chosen is null or exists (select 1 from public.game_players where game_id = g.id and token = chosen) then
    select t into chosen from unnest(all_tokens) t
    where t not in (select token from public.game_players where game_id = g.id)
    limit 1;
  end if;

  insert into public.game_players (game_id, seat, user_id, nickname, token)
  values (g.id, free_seat, auth.uid(), trim(p_nickname), chosen);

  return g.id;
end;
$$;

revoke all on function public.create_room(text, text, jsonb) from public, anon;
revoke all on function public.join_room(text, text, text) from public, anon;
revoke all on function public.is_member(uuid) from public, anon;
revoke all on function public.is_host(uuid) from public, anon;
grant execute on function public.create_room(text, text, jsonb) to authenticated;
grant execute on function public.join_room(text, text, text) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_host(uuid) to authenticated;

-- ---------- Access rules ----------
-- Games are now visible to everyone seated in them, not just the creator.

drop policy "owners read their games" on public.games;
drop policy "owners update their games" on public.games;
drop policy "owners read their game actions" on public.game_actions;
drop policy "owners append actions to their games" on public.game_actions;

create policy "players read their games" on public.games
  for select to authenticated using (created_by = auth.uid() or public.is_member(id));
-- For now any seated player may save the shared state; a server function will take this over.
create policy "players update their games" on public.games
  for update to authenticated
  using (created_by = auth.uid() or public.is_member(id))
  with check (created_by = auth.uid() or public.is_member(id));

create policy "players read game actions" on public.game_actions
  for select to authenticated using (public.is_host(game_id) or public.is_member(game_id));
create policy "players append game actions" on public.game_actions
  for insert to authenticated
  with check (actor = auth.uid() and (public.is_host(game_id) or public.is_member(game_id)));

alter table public.game_players enable row level security;

create policy "players see who is in their game" on public.game_players
  for select to authenticated using (public.is_member(game_id) or public.is_host(game_id));
-- The host adds robots in the lobby (people join through join_room)
create policy "host adds robots" on public.game_players
  for insert to authenticated
  with check (user_id is null and robot is not null and public.is_host(game_id));
-- You can change your own seat (nickname, token, last seen); the host can change robots
create policy "players edit their own seat" on public.game_players
  for update to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_host(game_id)))
  with check (user_id = auth.uid() or (user_id is null and public.is_host(game_id)));
-- Leave a room yourself, or the host removes a seat
create policy "players leave, host removes" on public.game_players
  for delete to authenticated using (user_id = auth.uid() or public.is_host(game_id));

grant select, insert, update, delete on public.game_players to authenticated;

-- ---------- Live updates ----------
-- Push changes to everyone in the room (Realtime still respects the policies above).

alter publication supabase_realtime add table public.games, public.game_players;
