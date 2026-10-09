# Deployment

The app is a standard Node server (`next start`). Any Node host works (Vercel, a VPS, Railway, Fly…). Nothing here has been deployed yet; these steps are untested on a real host.

## 1. Requirements

- Node.js 20+ (developed on 24)
- A PostgreSQL database reachable from the host (managed Postgres such as Neon or Supabase is fine; free tiers exist, the account is yours to create)
- Optional: a transactional email account (Resend is implemented; SMTP is not)

## 2. Environment variables

Use `.env.production.example` as the production variable list. Copy it to ignored `.env.production.local` for a local release build, or set its values in the hosting project's **Production** environment. Fill in the public HTTPS origin and production database URL and copy the existing hosted Cal credentials from `.env`. The example contains no credentials. `.env.development.local` contains the local scheduler overrides and Next.js excludes it from production builds.

Run `npm run check:production` before releasing. It fails for a local database or origin, disabled booking, local Cal settings, or incomplete booking credentials. This checks configuration; it does not register the Cal webhook, test a connected calendar, or install a maintenance schedule. Those must be verified on the target host. A local `.env` is not uploaded to managed hosting automatically.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/db` (add `?sslmode=require` if the host needs TLS) |
| `NEXT_PUBLIC_SITE_URL` | yes | Public origin, no trailing path. Used for canonical URLs, sitemap and **referral links** |
| `HASH_SECRET` | yes | 32+ random chars. Keys the hashes of IPs/emails. Changing it resets rate limits and breaks dedupe of in-flight notifications |
| `COMPANY_NAME`, `COMPANY_DESCRIPTION`, `COMPANY_CONTACT_EMAIL`, `COMPANY_TIMEZONE` | yes | Defaults are placeholders ("Your Company", hello@example.com). **Set real values.** The `Company` DB row, if present, overrides these |
| `COMPANY_WHATSAPP`, `SOCIAL_FACEBOOK_URL`, `SOCIAL_INSTAGRAM_URL`, `SOCIAL_LINKEDIN_URL`, `SOCIAL_GITHUB_URL`, `SOCIAL_X_URL`, `SOCIAL_DISCORD_URL` | no | Contact channels in the VELOCE flip row (closing section and footer). Empty ones still show as inactive tiles ("not set up yet"); X and Discord are listed only once set |
| `NOTIFY_TEAM_EMAIL` | no | Where new-inquiry mail goes. Defaults to `COMPANY_CONTACT_EMAIL` |
| `RESEND_API_KEY`, `NOTIFY_FROM_EMAIL` | for email | Both needed. The sending domain must be verified with the provider (SPF/DKIM). With neither set, notifications are logged as `SKIPPED` and **nothing is sent** |
| `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` | for email | Alternative to Resend; takes priority when all four are set. Setup in `docs/EMAILJS.md` |
| `NOTIFY_REFERRER` | no | `true` also emails a confirmation to the referrer. Leave `false` until delivery is verified; the UI only claims a confirmation was emailed if the send succeeded |

Secrets are server-only. Only `NEXT_PUBLIC_SITE_URL` is public.

## 3. Database

```bash
npm ci
# On the host, DATABASE_URL must already be set to production.
# For local administration, explicitly load the production file for Prisma:
NODE_ENV=production node --env-file=.env.production.local node_modules/prisma/build/index.js migrate deploy
NODE_ENV=production node --env-file=.env.production.local --import tsx prisma/seed.ts
```

Never run `db:migrate` (dev) against production. Create real campaigns with `scripts/create-campaign.ts` (needs `DATABASE_URL`) until the admin UI exists.

## 4. Build and run

```bash
npm run build            # runs prisma generate, then next build
npm start                # port 3000; set PORT to change
```

On Vercel, set the env vars, use `npm run build`, and run `npm run db:deploy` from CI or locally against the production URL (migrations are not run by the build).

## 5. After deploying

1. `GET /api/health` returns `{"status":"ok"}` (503 `degraded` if the DB is unreachable).
2. Submit a real inquiry and confirm: a `Lead` row, a `NotificationLog` row per message, and whether status is `SENT` (provider works) or `SKIPPED`/`FAILED` (it doesn't).
3. Open a campaign's `/refer/<token>` and `/?ref=<token>`; confirm the referral link in the share message uses your production origin.
4. Replace the draft `/privacy` and `/terms` text (owner/legal).
5. Put the app behind a proxy that sets `x-forwarded-for` (Vercel does). Without one, rate limiting by IP is spoofable.

## 6. Operations notes

- Rate-limit counters live in the `RateLimit` table and self-clean.
- `NotificationLog` stores hashed recipients; failed rows keep `lastError`. Booking notifications retry through the authenticated booking maintenance endpoint; schedule it every five minutes as described in the meeting guide.
- Backups, retention and deletion of old leads are the operator's responsibility; no purge job exists yet.

## Optional footer channels

Set any of `COMPANY_WHATSAPP`, `SOCIAL_FACEBOOK_URL`, `SOCIAL_INSTAGRAM_URL`, `SOCIAL_LINKEDIN_URL`, `SOCIAL_GITHUB_URL`. Unset channels are not shown. Email is always shown.

## Meeting appointments

Follow [Meeting booking setup and operation](./MEETING_BOOKING.md) for the Cal.com event, environment variables, webhook, calendar acceptance check and five-minute maintenance schedule. Scheduling is disabled by default; meeting requests remain available. Rebuild/restart when enabling the calendar and restart after generating the updated Prisma client.
