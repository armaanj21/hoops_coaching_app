# Hoops Coaching

A Progressive Web App for basketball coaches to assign drills to their roster, and for
players to complete drills, upload video for AI-powered feedback, and track progress.

## Stack

- React 18 + TypeScript + Vite
- `react-router-dom` for routing
- Supabase (Auth, Postgres, Storage)
- `vite-plugin-pwa` for installability + offline caching
- Deployment target: Vercel

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase project's URL and anon key
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). `VITE_ANTHROPIC_API_KEY` is only
   needed once the AI Analysis Module is wired up for real (see below).
3. Run the migrations in `supabase/migrations/` in order (`0001`, `0002`, `0003`) via
   the Supabase SQL editor, or the Supabase CLI.
4. `npm run dev`

## Project status: scaffold only

This is a structural scaffold, not a working app yet. Routes, pages, components, and
the database schema are in place for every v1 feature in the brief, but most data
calls are stubbed with `TODO` comments rather than talking to Supabase. Notably:

- **Auth** (`src/lib/auth.ts`) stores a local mock session and does not yet call
  `supabase.auth`. Wire this up once a real Supabase project exists.
- **Coach dashboard, player home, drill library, progress, reference profiles** all
  render with empty/stub data rather than fetching from the tables in
  `supabase/migrations/0001_init.sql`.
- **AI Analysis Module** (`src/lib/analysis/`) is built as a swappable
  `AnalysisClient` interface, per the brief's instruction to build and test this piece
  in isolation first. `claudeAnalysisClient.ts` currently returns a mocked
  `AnalysisResult` — see the TODOs there for what real integration requires (frame
  extraction, reference-profile context, and running server-side rather than in the
  client bundle).
- **RLS policies** are not yet defined on any table — add these before any real user
  data is stored.
- **PWA icons** in `public/icons/` are placeholders and should be replaced with real
  app icons (192x192 and 512x512 PNGs) before shipping.

## Build order (per project brief)

1. Auth & roles
2. Coach dashboard
3. Player view
4. Drill / content library
5. AI Analysis Module (isolated, then integrated)
6. Reference player profiles
7. PWA configuration (manifest/service worker — do this last)

## Out of scope for v1

- Payments/billing
- School-district-specific features
- Live/scheduled coaching sessions
