# Release Readiness Report

Date: 2026-10-02. Verdict: **ready for owner review and content; not ready to launch publicly** until the items in "Blockers to launch" are done.

## Verification actually run

| Check | Result |
|---|---|
| `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | pass |
| ESLint (next config) | pass, 0 warnings |
| Vitest unit (49) + integration (18, real PostgreSQL via embedded-postgres) | 67/67 pass |
| `next build` (Turbopack) | pass |
| Playwright e2e against the **production build**, mobile 390 / tablet 820 / desktop 1440 | 78 pass, 3 skipped (mobile-only menu test on non-mobile projects), 0 fail |
| axe-core (WCAG 2 A/AA, 2.1 AA, 2.2 AA) on sales page, referral page, privacy page, and the open inquiry dialog | 0 violations |
| Token contrast (25 foreground/background pairs, computed) | all meet AA |
| `prisma migrate` on a fresh database | applied (1 migration, `init`) |

Not run: Lighthouse / Web Vitals (no performance numbers are claimed), screen-reader testing, real-device testing, Safari/Firefox, load testing, any deployment.

## Status by area

**Implemented and tested**
- Sales page `/` with config-driven services, custom-vs-template, 6-stage approach, capabilities tabs, expectations, CTAs, footer; responsive nav with keyboard-operable mobile menu; mobile sticky CTA.
- Personalised referral page `/refer/[token]` (noindex, no-store, 404 for unknown tokens), with defaults when optional campaign data is missing.
- Offer logic: shown only when configured and within its window; expired/upcoming/none never shown as valid; no default offer text exists in code.
- Share: editable message containing the prospect link; copy with real success/failure feedback; encoded `mailto:` and `wa.me` links; copy-link.
- Inquiry and introduction forms: shared Zod validation (client + server), field errors, pending state, double-submit protection (idempotency key), success states that state only what happens, honeypot + minimum-fill-time, privacy/permission consent.
- Persistence and attribution from a **server-verified** public token; unverified "someone referred me" claims stored as `REFERRAL_UNVERIFIED`; client-supplied campaign ids ignored (tested by tampering with the request).
- Lead status model, separate attribution table, notification log with unique dedupe key (no duplicate sends on retry), hashed recipients.
- Postgres-backed rate limiting; security headers (CSP, nosniff, referrer policy, HSTS in production); robots/sitemap excluding personal pages; canonical URL.

**Implemented, not verified against a real service**
- Email via Resend (`src/server/notifications/provider.ts`): tested only with fake providers. No API key was available, so **no email has ever been delivered**. Without a key, logs show `SKIPPED`.

**Partially implemented**
- SEO: titles, descriptions, Open Graph/Twitter basics, canonical. No generated OG image, no JSON-LD.
- Hosting-specific hardening (CSP uses `'unsafe-inline'` for scripts/styles because of Next inline bootstrap; nonce-based CSP not done).

**Planned, not built**
- Admin UI and authentication (no `/admin` route exists; nothing is exposed). Campaigns are created with `scripts/create-campaign.ts`; leads are read in the database.
- Notification retry job; data-retention purge job.
- Analytics / conversion tracking (no vendor chosen, no stub code).
- CAPTCHA/Turnstile (not added; revisit if spam appears).
- Consultation scheduling and payments (out of scope; "Request a consultation" is an inquiry with `intent=CONSULTATION`).
- Testimonials: `TestimonialCard` exists but is not rendered anywhere because no real testimonials exist.

## Deviations from the brief / earlier docs

- No Framer Motion (CSS only). No `pnpm` (npm).
- Local Postgres uses `embedded-postgres` (npm package) instead of Docker, at your request. Production still needs a hosted Postgres.
- The source's decorative booking/checkout/dashboard mockups and the React code card were **not** recreated, because they implied features the site doesn't have.
- The "headline" and "markPlaceholders" authoring toggles were dropped. The checked-by-default "I was introduced" box became an unchecked "Someone referred me" claim, with real attribution from the link.
- `Service` rows in the DB override `src/content/site.ts` defaults; three services (redesigns, automation, integrations) are my proposed additions for owner approval.
- `FEATURE_MAPPING.md` mentioned a campaign flag for "worked with us" claims; I instead made the referral note neutral by default and customisable via the campaign's `personalMessage`.
- `TECHNICAL_DECISIONS.md` listed an analytics stub and Turnstile adapter; neither was built (see above).

## Blockers to launch (need you)

1. Real company name, contact email, website URL, timezone, logo (currently placeholders: "Your Company", hello@example.com, a letter-in-circle logo).
2. The real referral offer terms, and whether the referrer receives anything. None is shown today.
3. Production PostgreSQL and hosting; run `docs/DEPLOYMENT.md` steps.
4. Email provider account + verified sending domain, then a recorded real delivery test.
5. Privacy notice and terms: the pages are marked drafts. Retention period and data controller details are missing; legal review is yours.
6. Decide: may prospects see the referrer's name (`showReferrerName`, per campaign, default off) and are referred people contacted automatically (default: no, the team contacts them manually).
7. Confirm provenance/licence of the "Organic" design tokens (only values were reused) and the font choices (Caprasimo, Figtree: SIL OFL, self-hosted via `next/font`).

## Known limitations

- The IP in rate limiting comes from `x-forwarded-for`; spoofable without a trusted proxy.
- Fixed-window rate limits allow short bursts at window edges.
- Honeypot/min-time stops simple bots only. A determined script can still submit.
- The success view is shown even if the user closes the dialog mid-request; the submission is idempotent so a retry is safe.
- Dev and test runs leave rows in the local dev database (`.dev-db/`, git-ignored).
- `next dev` generated `AGENTS.md`/`CLAUDE.md` in the repo root; delete them or set `agentRules: false` if unwanted.
- Nothing was committed or pushed.

## Status after the full-fidelity pass

- Verified locally: typecheck, lint, 73 unit tests (both palettes' contrast), production build, 78 Playwright passes (3 skipped) across mobile/tablet/desktop with 0 axe violations and no horizontal overflow.
- Still open: owner-supplied company details, offer terms, privacy/terms text, hosted Postgres, email provider (email delivery has never been tested), VengeanceUI licence check, admin UI not built. Nothing has been committed or pushed.
