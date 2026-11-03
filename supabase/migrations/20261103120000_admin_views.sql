-- Admin views for the Supabase dashboard (Table Editor → schema "admin").
-- The admin schema isn't exposed to the Data API, and players get no access to it,
-- so this only shows up for whoever is signed in to the dashboard.

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- Square names by board index (mirrors src/data/board.ts)
create view admin.squares (idx, name) as values
  (0, 'GO'),
  (1, 'Makoko'),
  (2, 'Ajo Box'),
  (3, 'Ajegunle'),
  (4, 'Agbero Levy'),
  (5, 'CMS BRT'),
  (6, 'Mushin'),
  (7, 'Wahala'),
  (8, 'Oshodi'),
  (9, 'Agege'),
  (10, 'Kirikiri'),
  (11, 'Isolo'),
  (12, 'NEPA Light'),
  (13, 'Surulere'),
  (14, 'Yaba'),
  (15, 'Red Line'),
  (16, 'Festac'),
  (17, 'Ajo Box'),
  (18, 'Gbagada'),
  (19, 'Magodo'),
  (20, 'Third Mainland Go-Slow'),
  (21, 'Ajah'),
  (22, 'Wahala'),
  (23, 'Allen Avenue'),
  (24, 'Ikeja GRA'),
  (25, 'MMIA Airport'),
  (26, 'Lekki Phase 1'),
  (27, 'Oniru'),
  (28, 'Borehole'),
  (29, 'Victoria Island'),
  (30, 'Go to Kirikiri'),
  (31, 'Parkview'),
  (32, 'Old Ikoyi'),
  (33, 'Ajo Box'),
  (34, 'Osborne'),
  (35, 'Five Cowries Ferry'),
  (36, 'Wahala'),
  (37, 'Eko Atlantic'),
  (38, 'Owambe Spray'),
  (39, 'Banana Island');

-- Games still being played, most recently active first
create view admin.running_games as
select
  g.id,
  g.code as room,
  g.updated_at as last_move,
  (g.state->>'turn')::int as turn,
  g.state->'players'->((g.state->>'current')::int)->>'name' as now_playing,
  (
    select string_agg(
      (p->>'name') || case when p->>'robot' is not null then ' (robot)' else '' end || ' ₦' || (p->>'cash') || 'M'
        || case when (p->>'bankrupt')::boolean then ' [out]' else '' end,
      ', ' order by i)
    from jsonb_array_elements(g.state->'players') with ordinality as t(p, i)
  ) as players
from public.games g
where g.status = 'playing'
order by g.updated_at desc;

-- Every player in every game: filter by game_id
create view admin.players as
select
  g.id as game_id,
  (t.i - 1)::int as idx,
  p->>'name' as name,
  p->>'robot' as robot,
  (p->>'cash')::int as cash,
  (p->'loan'->>'balance')::int as loan,
  case
    when (p->>'left')::boolean then 'left'
    when (p->>'bankrupt')::boolean then 'bankrupt'
    when (p->>'inJail')::boolean then 'in jail'
    else 'playing'
  end as status,
  s.name as on_square,
  (select count(*) from jsonb_each_text(g.state->'owners') o where o.value::int = t.i - 1) as properties,
  (t.i - 1) = (g.state->>'current')::int as their_turn
from public.games g
cross join lateral jsonb_array_elements(g.state->'players') with ordinality as t(p, i)
left join admin.squares s on s.idx = (p->>'position')::int
where g.status = 'playing';

-- Every owned square in every game: filter by game_id
create view admin.properties as
select
  g.id as game_id,
  o.value::int as owner_idx,
  g.state->'players'->(o.value::int)->>'name' as owner,
  s.name as square,
  case coalesce((g.state->'buildings'->>o.key)::int, 0)
    when 0 then '' when 5 then 'hotel' else (g.state->'buildings'->>o.key) || ' houses'
  end as buildings,
  g.state->'mortgaged' ? o.key as mortgaged
from public.games g
cross join lateral jsonb_each_text(g.state->'owners') o
join admin.squares s on s.idx = o.key::int
where g.status = 'playing'
order by g.id, o.key::int;

-- Set a player's cash (in millions) by name, ignoring case:
--   select admin.set_cash('<game id>', 'Z', 1000);
-- Then have everyone in that game refresh.
create function admin.set_cash(game uuid, player_name text, amount int) returns text
language plpgsql as $$
declare
  i int;
begin
  select t.i - 1 into i
  from public.games g, jsonb_array_elements(g.state->'players') with ordinality as t(p, i)
  where g.id = game and lower(t.p->>'name') = lower(player_name);
  if i is null then
    raise exception 'No player called % in that game', player_name;
  end if;
  update public.games
  set state = jsonb_set(
        jsonb_set(
          jsonb_set(state, array['players', i::text, 'cash'], to_jsonb(amount)),
          array['players', i::text, 'creditor'],
          case when amount >= 0 then 'null'::jsonb else coalesce(state->'players'->i->'creditor', '"bank"') end),
        '{seq}', to_jsonb((state->>'seq')::int + 1)),
      version = version + 1
  where id = game;
  return format('%s now has ₦%sM. Everyone in the game should refresh.', player_name, amount);
end;
$$;

revoke all on all tables in schema admin from public, anon, authenticated;
revoke all on function admin.set_cash(uuid, text, int) from public, anon, authenticated;
