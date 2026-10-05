# Veloce-Dev

Client-acquisition platform: a custom-website sales page, personalised client-referral pages, and a lead/introduction pipeline backed by PostgreSQL.

Next.js (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Radix UI · React Hook Form + Zod · Prisma 7 + PostgreSQL.

Docs: [`docs/SOURCE_AUDIT.md`](docs/SOURCE_AUDIT.md) · [`docs/FEATURE_MAPPING.md`](docs/FEATURE_MAPPING.md) · [`docs/TECHNICAL_DECISIONS.md`](docs/TECHNICAL_DECISIONS.md) · [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md)

## Local development (no Docker)

```bash
npm install
cp .env.example .env            # then edit; see docs/DEPLOYMENT.md for every variable
npm run db:dev                  # terminal 1: real PostgreSQL via embedded-postgres, data in .dev-db/
npm run db:migrate              # terminal 2: apply migrations (creates the schema)
npm run db:seed                 # company, services, and DEMO campaigns (dev only; prints tokens)
npm run dev                     # http://localhost:3000
```

Demo URLs after seeding: `/?ref=<token>` (prospect view) and `/refer/<token>` (referrer page).
Create a real campaign: `npx tsx scripts/create-campaign.ts --name "…" --referrer "…" --show-name --offer-title "…" --expires 2026-12-31`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm test` | Vitest: unit + integration (integration is skipped if the DB is unreachable) |
| `npm run test:e2e` | Playwright at mobile/tablet/desktop; reuses a running server on :3000 or builds and starts one |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:deploy` | Apply migrations in production |

## Layout

`src/app` routes · `src/components` (ui, site, marketing, forms) · `src/content` marketing copy as data · `src/schemas` Zod (shared client/server) · `src/server` actions → services → Prisma, plus security and notifications · `prisma` schema, migrations, seed · `tests`.

Components never import Prisma; services never import React.

## Design notes

The sales page uses the violet/teal theme, the referral page the Organic theme. The logo, restored mockups, stats strip (content counts, not results), footer flip buttons and capability bento are described in `docs/TECHNICAL_DECISIONS.md`.
