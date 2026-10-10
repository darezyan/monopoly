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

## Voice chat (optional)

Online rooms get voice chat through [LiveKit](https://livekit.io). Without it the game works the same; the voice strip just says it isn't available.

1. Create a project on [LiveKit Cloud](https://cloud.livekit.io) and note its WebSocket URL, API key and API secret (**Settings → API Keys**).
2. In Supabase, **Edge Functions → Secrets**, add `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
3. Deploy [`supabase/functions/livekit-token`](supabase/functions/livekit-token/index.ts) as a function named `livekit-token` (dashboard: **Edge Functions → Deploy a new function → Via Editor**, or `npx supabase functions deploy livekit-token --no-verify-jwt`). Turn **Verify JWT** off: the function checks the player's session and seat itself.

Players join listening with their mic off. Controls: mic, speaker off (deafen), push-to-talk (hold **V**), voice and game-sound volumes, and muting individual players for yourself.

## Layout

- `src/data/` — board squares and Wahala / Ajo Box cards (edit text here)
- `src/game/game.ts` — all game rules, as one pure reducer over plain JSON state
- `src/game/useGame.ts` — animation timers, plus loading/saving through `persistence.ts`
- `src/components/` — board, tiles, dice, tokens, cards and sidebar
- `src/voice/useVoice.ts` — voice chat; `src/components/VoiceDock.tsx` — its controls
- `supabase/migrations/` — database schema
- `supabase/functions/livekit-token/` — hands out voice passes
