# Èkó — the Lagos property game

A Lagos-themed Monopoly-style board game. Vite + React + TypeScript, with Supabase for saved games.

## Run it

```sh
npm install
npm run dev
```

Without Supabase keys the game runs fully offline.

## Supabase setup

1. Create a Supabase project with **Data API on**, **automatically expose new tables off**, and **automatic RLS on**.
2. **Authentication → Sign In / Providers → Anonymous sign-ins: on.** Each browser plays as a silent guest account that owns its games.
3. Apply the schema: paste [`supabase/migrations/20261010120000_init.sql`](supabase/migrations/20261010120000_init.sql) into **SQL Editor** and run it (or `npx supabase link` then `npx supabase db push`).
4. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key from **Project Settings → API Keys**.
5. Restart `npm run dev`. The sidebar shows **Saved** once it's connected, and the URL gets `?game=<id>`, so reloading or sharing that link (from the same browser, for now) restores the game.

## Layout

- `src/data/` — board squares and Wahala / Ajo Box cards (edit text here)
- `src/game/game.ts` — all game rules, as one pure reducer over plain JSON state
- `src/game/useGame.ts` — animation timers, plus loading/saving through `persistence.ts`
- `src/components/` — board, tiles, dice, tokens, cards and sidebar
- `supabase/migrations/` — database schema
