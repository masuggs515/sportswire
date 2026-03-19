# Mint Street Sports — Web App

Personalised sports news for NBA, NFL, and NCAAB. Built with Next.js 15, Supabase, and Tailwind CSS.

## Features

- Personalised feed sorted by followed teams → hot stories → newest
- League tabs: All / NBA / NFL / NCAAB
- Live game scores with real-time updates (Supabase Realtime)
- Story detail page with AI analysis, recent scores, standings, and related stories
- Scores page with LIVE / TODAY / UPCOMING / RECENT sections
- Team follow preferences saved to localStorage (no login required)

## Setup

Copy `.env.local.example` to `.env.local` and fill in the values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_MIXPANEL_TOKEN=
```

## Run Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint check
npx tsc --noEmit     # TypeScript check
```
