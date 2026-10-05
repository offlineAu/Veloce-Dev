`# Technical Decisions (Proposed)
`
`Stage A/B deliverable. **Nothing here is implemented yet.** Items marked *Needs confirmation* are the ones I will not assume.
`
`## 0. Environment findings
`
`- Repo `D:\perso\Veloce-Dev` is empty (a single `README.md`). **There is no existing stack to conflict with**, so the preferred stack is adopted without deviation.
`- Local tooling: Node v24.16.0, npm 12.0.2. **Not installed:** `pnpm`, `psql`, `docker`. See D8 for what that means for database testing.
`- Windows 11, PowerShell/Git Bash. Scripts must avoid POSIX-only constructs (use `cross-env` or Node scripts).
`
`## D1. Stack (as per brief)
`
`| Concern | Choice | Notes |
`|---|---|---|
`| Framework | Next.js (App Router), React, TypeScript `strict` | Latest stable at install time; the exact versions are pinned in `package.json` and recorded here after install. |
`| Styling | Tailwind CSS + shadcn/ui (Radix) + `lucide-react` | Organic tokens mapped to CSS variables, which Tailwind reads. Customised, not default shadcn look. |
`| Forms | React Hook Form + Zod (`@hookform/resolvers`) | One Zod schema per form, imported by both client and server action. |
`| Data | PostgreSQL + Prisma | Migrations via `prisma migrate`. |
`| Motion | **CSS only**; no Framer Motion | The source needs only reveal/hover/dialog transitions. Avoids ~tens of KB of client JS. Revisit only if a need appears. |
`| Fonts | `next/font` self-hosting Caprasimo + Figtree | No runtime request to Google. SIL OFL. |
`| Package manager | **npm** | `pnpm` is not installed; do not add a tool for no benefit. |
`| Tests | Vitest (unit/integration), Playwright (e2e, responsive), `@axe-core/playwright` (a11y) | |
`
`**Visual direction (Q3):** adopt the Organic palette and type as the default, since it is the system both pages derive from. Page 2's violet/teal override is treated as a theme variant and *not* shipped, to satisfy "consistent across both experiences". Tokens live in one place so the owner can swap the palette in one file.
`
`## D2. Project structure
`
````
`src/
`  app/
`    (site)/page.tsx                 # sales page
`    (site)/privacy/ terms/
`    refer/[token]/page.tsx          # referrer page (noindex)
`    api/health/route.ts
`    admin/…                         # deferred, auth-gated
`    sitemap.ts robots.ts layout.tsx
`  components/
`    ui/                             # shadcn primitives (customised)
`    site/                           # SiteHeader, SiteFooter, ResponsiveNavigation, SectionHeading
`    marketing/                      # ServiceCard, FeatureCard, ProcessStep, ReferralOfferCard, TestimonialCard
`    forms/                          # InquiryDialog, InquiryForm, ReferralIntroForm, ContactForm, ShareActions
`  content/                          # typed site content: services, capabilities, process, copy (no business facts)
`  config/                           # env-driven company config, validated at boot
`  server/
`    actions/                        # server actions (thin: parse → call service → map result)
`    services/                       # lead, referral, campaign, offer, notification (business logic)
`    repositories/                   # Prisma access only
`    security/                       # rate limit, honeypot, token, origin checks
`    notifications/                  # provider interface, templates, outbox
`  lib/                              # share-url builders, formatting, utils (pure, unit-tested)
`  schemas/                          # Zod schemas shared client/server
`prisma/ schema.prisma migrations/ seed.ts
`tests/ unit/ integration/ e2e/
`docs/
````
`
`Layering rule: components → server actions → services → repositories. Components never import Prisma. Services never import React. This is the "presentation / logic / data" split from the brief, with no extra abstraction layers.
`
`**No hardcoded business info:** company name, email, URL, description, and the logo come from `config/company.ts`, which reads env vars, with the DB `Company` row overriding when present (D4). Templates contain no literal company facts.
`
`## D3. Referral link and attribution design *(Needs confirmation of URL shapes)*
`
`Problem in the source: the share message has no link, "Copy link" copies the company site, and the offer is claimed with a self-declared checkbox.
`
`Design:
`- Each `ReferralCampaign` has a **`publicToken`**: 16+ random bytes, base64url (≈22 chars), generated server-side, unique-indexed. It is the only identifier in any URL. The DB `id` (cuid) is never exposed.
`- **Referrer page:** `/refer/[token]`. `robots: noindex, nofollow`, `Cache-Control` private-ish (`no-store` unless we decide to cache). Shows the referrer's *name/role/company* only, which is data the owner has entered for that campaign.
`- **Prospect link** (in the share message): `${SITE_URL}/?ref=[token]`. Same token. The sales page resolves it server-side:
`  - valid + active → personalised offer card + hidden `refToken` carried to the form;
`  - expired → no offer, neutral note; inquiry still accepted and *still attributed* (the introduction happened);
`  - unknown/malformed → treated as no referral. No error page, no enumeration signal.
`- **Attribution is derived on the server:** the action receives the token, looks the campaign up, and writes `referralCampaignId` itself. A client-supplied campaign **id** is never accepted.
`- **Why one token for both pages:** simpler for a small team. Trade-off: the prospect link reveals the referrer's name (intentional and expected, "introduced by X") but nothing else. If the owner wants separate tokens (so a prospect link cannot reach the referrer page), the schema supports adding `shareToken` later. Flag for the owner: *do they want the prospect to see the referrer's name at all?* It requires the referrer's consent. The campaign has `showReferrerName` for this.
`- `utm_*` and the landing path are stored in `Attribution` fields, truncated and sanitised.
`
`## D4. Data model (reviewed)
`
`Entities are the brief's proposals, trimmed to what the v1 flows need.
`
````
`Company            id, name, description, logoUrl, websiteUrl, contactEmail, branding(Json), createdAt, updatedAt
`Service            id, companyId→, slug(unique per company), title, description, benefit, icon, displayOrder, active
`ReferralCampaign   id, companyId→, name, publicToken(unique), referrerName, referrerRole, referrerCompany,
`                   referrerEmail?(private), personalMessage?, showReferrerName(bool),
`                   offerTitle?, offerDescription?, offerStartsAt?, offerExpiresAt?, active, createdAt
`Lead               id, companyId→, name, email, companyName?, currentWebsite?, projectType, websiteType?,
`                   projectGoals, additionalDetails?, intent, status(enum), source(enum),
`                   referralCampaignId?→, referralClaimed(bool, unverified), idempotencyKey(unique),
`                   consentAt, createdAt, updatedAt
`LeadAttribution    leadId(unique)→, landingPath, utmSource?, utmMedium?, utmCampaign?, createdAt
`ReferralIntroduction id, campaignId?→, referrerName, referrerEmail, referredName, referredEmail,
`                   referredCompany?, projectInterest, message?, referrerConsentAt, status(enum),
`                   idempotencyKey(unique), createdAt
`NotificationLog    id, kind(enum), leadId?→, introductionId?→, recipientHash, status(enum),
`                   providerRef?, attempts, lastError?, dedupeKey(unique), createdAt, updatedAt
````
`
`Decisions:
`- **`LeadAttribution` is a separate 1:1 table** (brief §5.4: keep attribution apart from sensitive form data).
`- **`ReferralCampaign.referrerEmail` is optional and never sent to the browser.** It is used only for the optional referrer notification.
`- **Lead status enum:** `NEW, CONTACTED, CONSULTATION_SCHEDULED, PROPOSAL_IN_PROGRESS, CONVERTED, NOT_PROCEEDING`.
`- **Idempotency:** client generates a UUID per form mount, and the server stores it as a unique key. A retry with the same key returns the original result and creates nothing new (also prevents duplicate notifications).
`- **NotificationLog** is the outbox: a row is created with a unique `dedupeKey` (`kind:entityId:recipient`) *before* sending; a unique-violation means "already queued/sent". `recipientHash` stores a hash, not the raw address, to keep logs privacy-conscious.
`- **Indexes:** `Lead(status, createdAt)`, `Lead(referralCampaignId)`, `Lead(email)`, `ReferralCampaign(publicToken)` unique, `Service(companyId, displayOrder)`, `NotificationLog(status)`.
`- **Single-company by design, multi-company ready:** every table carries `companyId` per the brief, but v1 runs one company resolved from config. No tenant switching UI.
`- **Deliberately not created:** Users/Sessions tables (until admin auth is chosen), Offer table (offer fields live on the campaign; a general promotion is a campaign with no referrer), Testimonial table (no content exists).
`- **Lifecycle/privacy:** `deletedAt` is not added in v1; instead a documented retention job (planned) purges `NOT_PROCEEDING` leads and unconverted introductions after a period set by the owner (*Needs confirmation*, suggested 12 months).
`- **General promotions:** a campaign with `referrerName = null`, same machinery. Satisfies "both referral-specific and general campaigns".
`
`## D5. Offer validity
`
``offerState(campaign, now)` is a pure, unit-tested function returning `none | upcoming | active | expired`. Compared in UTC, rendered with an explicit timezone (company timezone from config). The page never shows a discount or benefit unless `offerTitle` or `offerDescription` is set. No default offer text exists in code.
`
`## D6. Forms and server processing
`
`Server action pipeline:
`1. Origin/`Host` check, content-length cap.
`2. Honeypot field filled → silently succeed (no signal to bots), nothing stored.
`3. Rate limit (per IP hash + per email), see D7.
`4. Zod parse + normalise (trim, lowercase email, collapse whitespace, strip control characters, URL must be `http(s)`).
`5. Idempotency lookup.
`6. Resolve campaign from token (server-side only).
`7. Transaction: create `Lead` (or `ReferralIntroduction`) + `LeadAttribution` + `NotificationLog` rows.
`8. After commit: dispatch notifications; failures update the log row and **never fail the user's submission**.
`9. Return a discriminated result `{ ok: true } | { ok: false, fieldErrors } | { ok: false, code: 'RATE_LIMITED' | 'UNAVAILABLE' }`. Internal errors are logged without PII and mapped to a generic message.
`
`Client: RHF + Zod resolver, a disabled submit while pending, a unique idempotency key per form instance, focus moves to the first error, a success view replaces the form, an `aria-live` status region.
`
`Sanitisation: values are stored as plain text and rendered through React (escaped). We do not store HTML. Emails escape all interpolated values and use plain-text alternatives.
`
`## D7. Security and abuse prevention
`
`- **Rate limiting:** v1 uses a Postgres-backed counter (`RateLimit(key, windowStart, count)`) so there is **no extra infrastructure** and it works across serverless instances. Alternative if traffic grows: Upstash/Redis (a paid/managed service, not added now). In-memory limiting is rejected: it fails on multi-instance deployments.
`- **Honeypot + minimum-time check** as baseline spam controls.
`- **CAPTCHA:** not added by default (friction, privacy, dependency). Turnstile adapter is behind `TURNSTILE_SECRET_KEY`; the decision is revisited if spam appears after launch.
`- **Security headers** in `next.config`: CSP (self + needed hosts), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` (also keeps the `ref` token out of third-party referrers), `Permissions-Policy`, HSTS in production, `frame-ancestors 'none'`.
`- **Secrets:** server-only env, validated by a Zod `env.ts` at boot; only `NEXT_PUBLIC_SITE_URL` is public. `.env.example` documents all; `.env` is git-ignored.
`- **Logging:** structured logger that never logs request bodies, emails or names; logs ids, codes and hashed IPs only.
`- **Admin:** all `/admin` pages and actions check the session **on the server** (middleware is a convenience, not the control). Deny by default.
`- **Token handling:** constant-time compare is unnecessary for DB lookup by unique index; tokens are high-entropy, so enumeration is infeasible, and invalid tokens return the same response as no token.
`
`## D8. Database, local development and testing *(Blocker for real DB tests)*
`
``psql` and Docker are not installed. Options:
`1. **Docker Desktop** + `docker-compose.yml` for Postgres (the usual route).
`2. Native PostgreSQL install on Windows.
`3. A hosted free-tier Postgres (Neon/Supabase) for dev/test: no local install, but needs an account and a connection string. *Cost/credentials: free tier exists; owner must create the account.*
`
`I recommend **(1) or (2) for local work, and a hosted Postgres for production**. Until one of these exists, I can write the schema, migrations, services and unit tests, and run type checks, lint, unit tests and the build, but I **cannot** run the migrations or the integration/e2e suites against a real database, and I will report them as **not run** rather than passed. Service tests will use an injectable repository so business logic is tested without a DB, with a separate DB-backed suite that is skipped unless `DATABASE_URL` is set.
`
`## D9. Notifications
`
`- `NotificationProvider` interface (`send({to, subject, text, html, dedupeKey}) → {providerRef}`) with implementations: `ConsoleProvider` (dev), `ResendProvider` (proposed default: simple API, free tier available, requires a verified sending domain and API key). *Provider not yet chosen; Needs confirmation.* SMTP via `nodemailer` is the vendor-neutral alternative.
`- Messages: team notification of a new inquiry; acknowledgment to the prospect; introduction notification to the team; **optional** referrer copy gated by `NOTIFY_REFERRER=true`; **referred-person outreach is not automatic**; the team contacts them manually after review. This is the default consistent with the privacy requirement not to mail third parties who haven't opted in. *Needs confirmation of policy.*
`- Retries: failed log rows are re-sent by a retry function (cron/route handler, planned) up to N attempts. v1 sends inline once and records the outcome.
`- **Claim discipline:** the docs and final report mark email as *implemented, not verified* until a real provider key is configured and a delivery test is recorded.
`
`## D10. Privacy and legal *(Needs confirmation)*
`
`- Likely applicable law: Philippines Data Privacy Act of 2012 (inferred from the user's email domain, not stated). Also GDPR if EU visitors are expected. **I'm not giving legal advice**; the owner should supply the privacy policy text and confirm the controller identity and retention. The pages `/privacy` and `/terms` ship with clearly marked draft text.
`- Inquiry form: consent checkbox linking to the privacy page (required).
`- Introduction form: a required attestation that the referrer has the referred person's permission, plus a notice of exactly what is done with the referred person's details. **No marketing subscription of any kind.**
`- Minimisation: no phone, address or DOB collected. IPs are stored only as a keyed hash for rate limiting with a short TTL.
`- Referral pages are `noindex`, excluded from the sitemap, and send `Referrer-Policy`.
`
`## D11. SEO, accessibility, performance
`
`- `generateMetadata` per route; Open Graph and Twitter cards; a generated OG image; canonical URLs (the canonical for `/?ref=…` is `/`, so tokens are never indexed); `sitemap.ts`, `robots.ts`; JSON-LD `Organization` (and `Service` if justified) only with real data.
`- Accessibility targets: WCAG 2.2 AA. Semantic landmarks, a skip link, focus-visible ring, labelled controls, Radix dialog focus management, a roving-tabindex tablist, `aria-live` regions, `prefers-reduced-motion`. Contrast of every token pair is checked in a unit test.
`- Performance: Server Components by default; client components only for dialogs, forms, share actions, tabs and the mobile menu. Self-hosted fonts, `next/image`. Lighthouse/Web Vitals are **measured and reported**, not asserted.
`
`## D12. Testing plan (Phase 10)
`
`- **Unit:** share URL builders (encoding, length cap), `offerState`, Zod schemas, normalisation, idempotency/dedupe key logic, rate-limit logic.
`- **Service tests (fake repositories):** attribution from valid/invalid/expired tokens, duplicate submission, notification triggered once, failure isolation.
`- **Integration (needs Postgres):** migrations apply, constraints, seed, end-to-end action → DB.
`- **E2E (Playwright, 3 viewports):** sales page, referral page, missing optional data, copy button states (with permission granted/denied), email/WhatsApp hrefs, validation errors, success, failure, double-click submit, expired/invalid token.
`- **A11y:** axe on key pages and the open dialog + manual keyboard checklist documented.
`- **Security:** invalid/oversized input, bogus tokens, forged `campaignId` in the payload ignored, unauthenticated `/admin` rejected, response bodies free of IDs/stack traces.
`- **Build gate:** `npm ci`, `tsc --noEmit`, `eslint`, `vitest`, `next build`, `prisma validate`.
`
`## D13. Costs and external services
`
`| Service | Needed for | Required in v1? | Cost note |
`|---|---|---|---|
`| PostgreSQL host | persistence | **Yes** (production) | Free tiers exist (Neon, Supabase); self-host is free but needs ops. |
`| Transactional email (Resend or SMTP) | notifications | Needed for real notifications | Free tier exists; needs a verified domain. |
`| Hosting (e.g. Vercel, or a Node host) | deployment | Yes | Free tier exists for low traffic; owner decision. |
`| Analytics | conversion tracking | No (stub) | Not chosen; privacy-friendly options exist (Plausible is paid, Umami self-host). |
`| Turnstile/CAPTCHA | spam | No | Free tier; add only if needed. |
`| Scheduling (Cal.com, Calendly) | consultations | No | Planned. |
`| Payments | checkout | No | Not needed for lead-gen. |
`
`No paid integration is introduced without your approval.
`
`## D14. Risks
`
`1. The lack of a local Postgres blocks DB-backed verification (D8).
`2. The real company data and offer don't exist yet. I'll use clearly labelled placeholder config and a demo-only seed, and nothing in the UI will look like a real claim.
`3. Referral naming of real clients without consent: mitigated by `showReferrerName` and wording.
`4. Email deliverability depends on the owner's domain (SPF/DKIM).
`5. The Organic design system's provenance is unconfirmed. Only token values and structure are reused.
`
`## D15. Proposed stages and what I need before Stage B
`
`Stage A (this document set) is complete. I have not scaffolded anything.
`
`**Please confirm or correct** (the defaults in `FEATURE_MAPPING.md §H` apply if you just say "go"):
`1. Palette: Organic terracotta/sage (default), or violet/teal, or a new brand?
`2. Company name, contact email, website URL and logo, or approve placeholders for now.
`3. The referral offer (or "none until I provide it") and whether the referrer receives anything.
`4. Whether the prospect link may show the referrer's name, and whether referred people are contacted automatically (default: **no**, manual by the team).
`5. Postgres route for local dev (Docker, native, or hosted).
`
`## Update: full-fidelity clone pass
`
`- **Per-page themes (reverses the earlier "single palette" decision).** Each page keeps its original palette: the sales page and legal pages use the violet/teal theme (`src/lib/themes.ts`, applied by `ThemeScope` as an inline `:root` override so portalled dialogs inherit it); the referral page uses the Organic terracotta/sage tokens. Both palettes are covered by `tests/unit/contrast.test.ts`.
`- **Logo.** The three-polygon mark from the original offer page is `src/components/brand/logo.tsx` (header badge, footer), `src/app/icon.svg` (favicon) and `src/app/opengraph-image.tsx` (share card). The Gemini JPG was not shipped; the vector mark it depicts was reused.
`- **VengeanceUI components (third-party, adapted).** `stats-counter`, `social-flip-button` and the research-bento-grid idea (`capability-bento`) were adapted from the VengeanceUI registry to our tokens, with reduced-motion support and accessible labels. Check their licence terms before launch.
`  - Stats show counts derived from our own content (service types, process stages, capability items). They are **not** business results. Do not replace them with client or performance numbers unless the owner supplies verified figures.
`  - The flip buttons live in the footer, fed by `company.channels`: email always; WhatsApp and socials only when the env vars are set.
`  - The bento uses illustrative capability tiles, with no prices, brands or invented outcomes.
`- **Restored mockups.** Hero compositions and the booking/dashboard/checkout panels are decorative, `aria-hidden` and captioned "Illustrative example", not client work.
`- New optional env vars: `COMPANY_WHATSAPP`, `SOCIAL_FACEBOOK_URL`, `SOCIAL_INSTAGRAM_URL`, `SOCIAL_LINKEDIN_URL`, `SOCIAL_GITHUB_URL`.
`
`## Update: Veloce brand copy and shadcn/ui
`
`- **Brand copy** (tagline, short and long description, value proposition, philosophy, promise, brand message) was supplied by the owner and lives in `brand`, `philosophy`, `defaultServices` and `processSteps` in `src/content/site.ts`. The company name, description and contact email come from env (`COMPANY_*`) and `npm run db:seed` syncs the Company row and Service rows to them. No prices, clients, testimonials or results were added.
`- **shadcn/ui.** `components.json` is committed (style new-york, Tailwind 4, aliases `@/components/ui`, `@/lib/utils`). `button`, `dialog`, `tabs`, `input`, `textarea`, `label`, `badge`, `card` and `separator` are shadcn components, mapped to brand tokens through the `--color-*` aliases at the top of `globals.css`. Unified `radix-ui` replaces the three `@radix-ui/react-*` packages.
`  - Button variants follow shadcn (`default`, `outline`, `secondary`, `ghost`, `link`, `destructive`) plus `light` for dark panels; sizes are `default`, `sm`, `lg`, `icon`.
`  - `ModalContent` (scrollable form modal) and `useOpenerFocus` are built on the shadcn dialog primitives.
`  - Forms use shadcn `Input`/`Textarea`/`Label` via `ui/field.tsx`. Selects stay native `<select>` for mobile usability and simple form wiring.
`  - shadcn's `accent` and `muted` tokens mean something different from ours (brand fill, text colour), so generated components use neutral tints instead.
`  - The shadcn CLI's own dependency step tried to install an unrelated npm package named `cn` and failed, so component sources were fetched from the registry directly with their `cn` import pointed at `@/lib/utils`. Future `npx shadcn add` runs may need the same workaround.

## Update: motion, notch header and search

- Motion components live in `src/components/motion`; `Providers` wraps the app in `MotionConfig reducedMotion="user"`. Everything animates opacity/transform only and has a reduced-motion path. No GSAP, three.js or smooth-scroll library.
- Added dependencies: `sonner`, `cmdk`, `tw-animate-css` (shadcn animate-in/out utilities). VengeanceUI code (MIT) adapted: stagger-text, border-beam, and the visual design of notch-navbar and search-modal; highlight-grid and the aura are independent implementations of the same ideas. Keep the MIT notice for the adapted files.
- Tailwind 4 defaults borders to currentColor, so `globals.css` sets a default border colour (`--color-line`).
- The palette's "Start a conversation" entry clicks the page's `[data-primary-cta]` button, so it works on both pages without sharing form context.
- Search is client-side over page content only.

## Update: Ember palette, Offer tab, stats, dock, perspective grid, full social flip

- **Palette.** The site now uses the owner's Color Hunt palette (#362222, #171010, #423F3E, #2B2B2B) as the "ember" theme (`src/lib/themes.ts`, applied site-wide from `layout.tsx`). The four colours are all dark, so the light text (#F3EAE6), muted/hint greys, the rose accent family, the stone secondary family and the error colour are **derived** from the same warm family and need the owner's sign-off. New token `--color-on-accent` is the text colour on accent fills. The old violet theme was removed; "organic" remains only as the fallback token set in `globals.css`. Both are contrast-tested.
- **Offer tab.** As in the original page, "Offer" is always in the navigation. With an active campaign offer the section shows the special offer; otherwise it shows an honest "A clear way to start" panel. No offer, price or discount is implied without a real campaign.
- **Stats.** `stats` in `src/content/site.ts` is deliberately 0 / 0 / 0 (Projects shipped, Clients served, Systems live) until the owner decides what is true and worth showing.
- **Social flip.** Full port of VengeanceUI social-flip-button (letters flip to icons, staggered spring, tooltip, border streaks). Front letters spell VELOCE. Channels are env-driven; added X and Discord (`SOCIAL_X_URL`, `SOCIAL_DISCORD_URL`).
- **Quick dock** (`site/quick-dock.tsx`), after VengeanceUI awwwards-nav, rebuilt with framer-motion (no GSAP): appears after scrolling, scroll-spy, expands to a menu, replaces the old mobile sticky CTA.
- **Perspective grid** (`motion/perspective-grid.tsx`): VengeanceUI concept drawn with two CSS gradients instead of 1,600 tile elements; accent lines light up around the pointer; slow slide toward the viewer. Off under reduced motion.
- **Hero headline** rises word by word with CSS only (no JS), "Working System" has a slow shimmer; both stop under reduced motion.
