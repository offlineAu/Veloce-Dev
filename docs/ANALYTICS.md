# Visitor and conversion analytics

The integration loads `posthog-js/dist/module.no-external` only after analytics consent. SDK capture uses a first-party ingestion endpoint, which revalidates signed consent and strips unapproved properties before calling the PostHog Capture API. There is no generic click/form autocapture, replay, heatmap, raw-IP geolocation, or external SDK bundle loading. CSP stays `connect-src 'self'` in the browser: only the server contacts the fixed PostHog EU/US endpoint. Analytics is disabled by default.

## Enable production

1. Create an owner-controlled PostHog Cloud **EU** project. Start on the free plan without a card; do not enable other products. Free usage currently stops at one million analytics events/month. Recheck https://posthog.com/pricing before launch.
2. Apply `npm run db:deploy` to the intended database before deploying the app. The migration only adds nullable context to existing records, with no visitor/history backfill.
3. Configure `ANALYTICS_ENABLED=true`, `POSTHOG_PROJECT_KEY=<project token>` and `POSTHOG_REGION=eu`. Keep staging disabled. Development/test and Vercel previews are always excluded. A public production build is required for browser collection.
4. Confirm actual provider region/retention and update provider disclosures. The notice version is `2026-10-19.1`; the preceding draft is archived under `docs/legal/2026-10-16.1`. Optional collection and request linking have independent choices.
5. Complete the acceptance checks below using a production preview whose traffic is separated from the live dashboard. Do not enable analytics on a public preview hostname.
6. Invite authorized viewers directly in PostHog; do not create public dashboard links. Keep collection disabled until the project, dashboards, and disclosures are ready.

The project ingestion token is passed to the browser only when collection is enabled; it is not a read credential. Reporting uses a separate server-only personal API key, described below. Rolling back collection requires `ANALYTICS_ENABLED=false` and redeployment; withdrawal remains available. Do not drop the new tables while they contain deletion references.

## What is collected

Browser events: `$pageview`, `$pageleave`, `cta_clicked`, `form_opened`, `form_started`. Old deployments sent `page_viewed`; reports include both event names, and the new client sends only `$pageview`. Native web properties (`$current_url`, `$pathname`, `$host`, `$session_id`, `$pageview_id`, broad device category and sanitized UTM labels) are constructed on the server. URLs never include queries, fragments or actual referral tokens. Pageleave carries elapsed time since the pageview; it is best-effort and includes time in background tabs. Bounce/engagement metrics requiring full autocapture and IP geolocation are outside this privacy-limited setup.
Server events: `inquiry_submitted`, `introduction_submitted`, `booking_started`, `booking_confirmed`.

Only known marketing routes and `/build` are included. Referral paths become `/refer/[token]`. Query strings, raw referrer URLs, preview/template/API paths, and authenticated developer activity are excluded. CTA attributes are explicitly placed on sales controls; there is no generic click/text capture. Form-start handlers inspect the form type, never its values.

Campaign labels must be non-personal ASCII slugs (letters, digits, `_`, `-`, at most 80 characters). Do not place emails, names or secret tokens in campaign labels. First-touch and latest campaign fields persist only after analytics consent. Latest changes when a valid UTM campaign appears, so internal navigation does not replace attribution. Without tracking consent, submission-time campaign fields can still accompany the requested inquiry under the existing business workflow, without persistent analytics storage.

A signed HTTP-only consent cookie identifies a browser. The SDK uses memory-only persistence. Our session storage rotates a UUIDv7 session identifier after 30 minutes without tracked activity (old UUIDv4 sessions rotate on upgrade); local storage holds the consent choice and attribution. Browser cookies/consent expire after one year. No fingerprinting, cross-device matching or email-based merging is performed. Clearing storage or using a shared browser affects identity accuracy.

**Request linking:** with the form checkbox checked, `$identify` connects prior consenting activity to a random `lead_reference`. The mapping to inquiries, introductions or bookings stays in PostgreSQL. The reference describes a browser's submitted requests, not an authenticated person. An introduction never identifies the referred person. With the checkbox unchecked, conversion events use isolated request identities and omit browser session identifiers; these count in conversion totals but cannot complete an individual browsing funnel. Local request records retain the consent reference for withdrawal and erasure, regardless of the linking choice.

Capture API payloads disable geolocation and contain only typed properties. Data is best effort: server work runs after the response with a 2.5-second provider timeout. Failures log a fixed message, without payloads, and never change a submission result. Repeated successful server delivery uses a stable event UUID; confirmed bookings use one UUID per lead across provider syncs and reschedules. SDK transport may retry failed delivery using the same event UUID. The server always checks consent again before delivery. PostgreSQL is authoritative for actual inquiry and booking totals; analytics is a consenting, delivered subset. Confirmation time is recorded on first observed confirmed state, not inferred from a calendar selection or unverified embed callback.

## Configure external dashboards

Create the following private dashboards in PostHog. Use **Asia/Manila**, the last **30 days**, and date/source/campaign/service/device filters where the corresponding properties exist. For sources, group by `latest_source`, `latest_medium`, `latest_campaign`; retain `first_*` properties for first-touch comparisons. Filters for device apply to browser events; service applies to instrumented service actions and inquiries.

| Dashboard | Charts |
| --- | --- |
| Traffic | PostHog unique users (identity-resolved browsers) and total `$pageview`, trends by day, top `page`, device breakdown, returning browsers with pageviews on more than one day |
| Acquisition | First and latest source/campaign breakdowns, coarse `first_referrer` / `latest_referrer` categories for untagged traffic, `campaign_reference` conversions, inquiry and introduction totals separately |
| Inquiry / referral | Person-based funnels: `$pageview` → `form_opened` → `form_started` → corresponding submission; filter `form` to `inquiry`, `meeting_request`, or `introduction`; linked conversions only |
| Booking | `booking_started` totals; distinct-lead `booking_confirmed` totals; person funnel from a `meeting` CTA to `booking_started` to `booking_confirmed` with `journey_linked=true` |

Use PostHog identity-resolved unique users filtered to browser events for visitor counts; isolated request profiles must not inflate traffic. Funnels use a seven-day conversion window. Label all funnels **“analytics consent + request linking required”** and all totals **“analytics consent required; best-effort delivery”**. Unlinked conversions belong in separate totals. Referral pageviews are token-redacted; campaign-specific conversion counts use server-verified campaign references. Do not sum inquiries and bookings as distinct customers: a person can submit more than once, and there is no authentication/deduplication by email.

Definitions: a form open is a displayed form component, a form start is its first input event, an inquiry is a persisted non-bot request, and a confirmed meeting is a verified Cal.com appointment. Requests arranged by email count as inquiries, not confirmed appointments. Closed sales/revenue, builder editor interactions, performance monitoring and recordings are outside v1.

## Withdrawal and provider erasure

Decline immediately stops local capture and clears attribution/session storage, then revokes the server consent record. If offline, the UI reports the pending withdrawal and retries when online or on the next page load. An in-flight request cannot be unsent. Withdrawal is distinct from deletion.

`npm run privacy:cleanup -- --apply` now stages deletion for expired visitor consent and eligible closed requests with analytics references. It revokes these visitors and **keeps the affected request records** until provider erasure is confirmed. `hasMore=true` can therefore mean pending provider deletion, not just a database backlog. Deleting all data associated with a browser can also erase analytics for other requests made in that browser; business records and retention holds remain governed by their own rules.

Use trusted owner tooling to read a record's `analyticsVisitorId`, or list pending work:

```sh
npm run privacy:analytics -- pending
npm run privacy:analytics -- request <visitor-id>
npm run privacy:analytics -- inspect <visitor-id>
```

The inspection output lists PostHog distinct IDs only; it does not print names, emails, or secrets. In PostHog, erase all listed identities **and their events**, including isolated request identities. Use PostHog's data-deletion tooling for personless browsing IDs as necessary. Verify completion with the provider: deletion is asynchronous. Wait for any in-flight ingestion to settle and recheck before confirming. Only after confirmed erasure run:

```sh
npm run privacy:analytics -- confirm <visitor-id> --provider-erasure-verified
npm run privacy:cleanup -- --apply
```

The confirmation flag is the owner's attestation of completed provider erasure, not an automated verification. Never confirm on merely submitting a provider deletion request. Existing records remain available for retry if erasure fails. Confirmed consent tombstones are retained to prevent old signed cookies from restarting tracking; remove them only under a reviewed retention process after related records and cookie lifetime have expired. Monitor pending deletions at least daily and perform erasure promptly; this implementation does not automate PostHog deletion or provision a hosted scheduler.

References: https://posthog.com/docs/api/capture, https://posthog.com/docs/getting-started/identify-users, https://posthog.com/docs/data/persons.

## Acceptance checks

- Fresh/declined browser: no capture requests, tracking cookie, attribution or session storage. Forms and scheduler remain usable.
- Accept: one initial page event; client navigation produces one event per route; reload creates another pageview without changing browser identity.
- Both linking choices: only checked requests join earlier history; no names, emails, form values or private tokens appear in payloads.
- Retry submission / booking verification / webhooks / reschedules: no additional conversion UUID per record or lead. Honeypot and failed saves produce none.
- Block collector or fail PostHog: submissions still succeed; consent controls explain failures; withdrawal retries and stops subsequent booking capture after reaching the server.
- Expired consent, old notice versions, development, previews and developer sessions: no capture. Provider erasure gates local mapping cleanup.

Focused automated checks:

```sh
# DATABASE_URL should point at a disposable PostgreSQL database with migrations applied.
npx vitest run tests/unit/analytics.test.ts tests/unit/analytics-client.test.ts tests/integration/analytics.test.ts tests/integration/privacy-retention.test.ts
# Start an isolated production server on :3001 with ANALYTICS_ENABLED=true and a test project key.
E2E_ANALYTICS=true E2E_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/analytics.spec.ts
```

The focused browser suite intercepts capture requests and does not send them to PostHog. It also exercises real consent-cookie creation and revocation against the isolated server, without capturing events. It skips by default in the normal browser suite, where analytics is disabled.

## Private dashboard inside Veloce

Open `/admin/analytics`. This page uses a dedicated owner login, separate from template publishing. It is excluded from tracking and search indexing, and every report loader requires a valid owner session before reading data or a cached result. Do not expose personal API keys in a `NEXT_PUBLIC_` variable or in browser code.

Set these **server environment variables** in production:

```env
POSTHOG_PROJECT_ID=<numeric-project-id>
POSTHOG_PERSONAL_API_KEY=<personal-key-with-project-query-read-permission>
ANALYTICS_OWNER_PASSWORD_HASH=<generated-hash>
ANALYTICS_OWNER_SESSION_SECRET=<generated-secret>
ANALYTICS_OWNER_TOTP_SECRET=<enrolled-authenticator-secret>
OWNER_SESSION_VERSION=1
```

Generate the password hash and signing secret with `npm run analytics:password`. Enter a unique password of at least 12 characters; it is not echoed. Save the password securely and copy the generated hash and secret to production. Never reuse the template developer password or session secret. Redeploy after setting the variables. The personal key's project access should be limited to this project, with query-read permission only.

Production also requires authenticator enrollment with `npm run security:totp`; keep the secret in the authenticator and hosting secret manager. Apply the security migration before enabling login. See [security rollout](SECURITY.md).

The owner cookie is HTTP-only, Secure in production, SameSite=Strict, and expires after eight hours. Login is rate-limited to five attempts per 15 minutes per client hash. Rotating the password hash or signing secret invalidates outstanding sessions. Sign out revokes the database session and clears the cookie. Sign out all devices revokes every owner session. This is a single-owner login, not a multi-user admin system; there are no public shares or iframe embeds.

The dashboard provides 7/30/90-day views, ending now and beginning at midnight in Asia/Manila on the first included day. It displays visitors, pageviews, sessions, a daily trend with an accessible numbers table, popular pages, sources and devices. Historic `page_viewed` data remains included. Reporting uses three fixed bounded queries; no browser-supplied SQL is accepted. Aggregate traffic results are cached in server memory for one minute per date window to reduce API calls. Failures clear the cached promise and show an unavailable state, not fabricated zero traffic. The query credentials and raw upstream errors never enter rendered responses.

Business cards independently query PostgreSQL. Inquiries exclude leads created from Cal.com; introductions count saved referral requests. Confirmed bookings count unique leads with a currently confirmed, unreplaced appointment created within the reporting window. These counts can change after cancellations, rescheduling or privacy deletion and are not a permanent historical revenue ledger. They are independent of analytics consent and must not be divided by consenting visitor counts to claim an all-visitor conversion rate.

Without PostHog reporting credentials, owner login still works and database totals load, while the traffic section explains that reporting is not configured. With unavailable database/provider services, the sections fail independently. The security follow-up adds `20261021000000_security_access` for revocable sessions and private case access; apply it and outstanding analytics migrations before rollout.

The live PostHog query shapes follow https://posthog.com/docs/sql and https://posthog.com/tutorials/embedded-analytics. The SDK installation follows https://posthog.com/docs/libraries/js. Only native pageviews collected after this release appear in PostHog's built-in Web Analytics; older custom events remain available through Product Analytics and our owner dashboard.
