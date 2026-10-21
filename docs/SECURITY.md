# Portfolio security implementation and operations

Implemented locally on 2026-10-21 from [the investigation](PORTFOLIO_SECURITY_INVESTIGATION.md). This is application hardening, not a promise that public content cannot be copied. Browser inspection, downloading delivered pixels, OS screenshots and external cameras remain possible.

## Implemented controls

| Area | Behavior |
| --- | --- |
| Public photos | 33 WebP portfolio images under `public/images/` have attribution composited into their pixels, EXIF removed and widths capped at 1920px. New preview query versions avoid reusing old optimizer/CDN cache keys. Stock-photo credits remain intact. Logos and the public builder template library remain shareable. |
| Originals | Local originals are retained in ignored `.private-assets/originals/`, outside `public/`. Never upload that folder or private manifests to source control or public hosting. Prior Git revisions and previously published copies may still contain old images; watermarks cannot recall those copies. |
| Confidential work | `/private/[slug]` requires a high-entropy invitation submitted through a form, never a token in the URL. Only a token hash is stored. Every page and image request checks case scope, expiry and revocation. Protected media streams from private Blob storage with `private, no-store`, no public redirects, and no Next image optimizer path. |
| Privileged sessions | Owner and developer cookies are signed, bounded, expiring, HttpOnly, SameSite=Strict and Secure in production. Database records allow per-session and all-session revocation. Password/secret/version changes invalidate signatures; old pre-migration cookies are rejected. |
| Owner MFA | Production owner access requires password plus a six-digit RFC 6238 authenticator code. Valid time steps are consumed once across instances. An authenticator is optional in local development; production fails closed when enrollment is missing. |
| Server boundaries | Request streams are byte-limited before JSON/multipart parsing, with deadlines. Webhooks still verify the signature against the raw decoded body and retain existing duplicate-event journaling. Same-origin mutation checks supplement server authorization. |
| Remote downloads | HTTPS/default-port-only requests validate all DNS answers and pin the checked address for the TLS connection while preserving hostname/certificate validation. Every redirect is checked; credentials are never forwarded. Non-global/transition/mapped addresses are denied. Downloads are streamed with size, count, aggregate and time budgets. |
| Expensive work | Distributed PostgreSQL quotas cover uploads, imports, CSS compilation, HTML parsing, forms, notifications and log ingestion. Per-process capacity caps protect image, CSS and template-import processing. Image pixels/animation frames and processing time are bounded. CLI ZIP imports validate expanded size, count and paths before extraction, and reject symlinked folder exports. |
| Headers and CSP | Baseline CSP includes `object-src 'none'`; production HSTS, anti-framing and nosniff remain. Proxy generates per-request script nonces. Shared Zod schemas disable optional JIT/probing so validation does not require `unsafe-eval`. A stricter policy starts in Report-Only; `SECURITY_CSP_MODE=enforce` enables enforcement after compatibility review. Nonce-bearing HTML is dynamic and not publicly cached. The sandboxed bake route retains its explicit policy. |
| Privacy and CI | Fixed security event names/counts avoid contact data, tokens, URLs and script samples. CI runs migrations, build, bundle/file checks, typecheck, lint, tests and production dependency auditing. Security maintenance removes old expired session/grant rows. |

No global right-click, keyboard, selection, printing or DevTools blocking is installed. `display-capture=()` only restricts a page's screen-sharing API; it does not prevent OS screenshots.

## Release order

1. Back up the production database using the provider's encrypted backup facility. Verify a recent backup and a tested restore procedure before changing production schema.
2. Apply `npm run db:deploy` using the migration identity. The additive migration is `20261021000000_security_access`; it creates `SecuritySession`, `PrivateCaseStudy` and `PrivateAccessGrant`. Then deploy the application. Existing privileged sessions will need to log in again. Do not run the application against an unmigrated database.
3. Enroll the owner authenticator locally with `npm run security:totp`. Store the displayed secret in the owner's authenticator and the hosting secret manager as `ANALYTICS_OWNER_TOTP_SECRET`. Keep a recovery copy in an access-controlled password manager. The command deliberately displays enrollment material; do not put it in a ticket, CI output or chat. No production credentials were generated or changed by this implementation.
4. Retain the existing dedicated owner password hash and signing secret. Set `OWNER_SESSION_VERSION=1`, `DEV_SESSION_VERSION=1`, and initially `SECURITY_CSP_MODE=report-only`. Missing production MFA disables owner login until enrollment is complete. The existing `analytics:password` command generates a password hash.
5. On Vercel, the application trusts the platform's overwritten `x-forwarded-for`. On self-hosted deployments set `SECURITY_TRUSTED_IP_HEADER=x-real-ip` or `x-forwarded-for` only after ingress overwrites it and direct access to Next is blocked. Without a trusted configuration, all clients share the `unknown` limit bucket rather than accepting spoofed headers.
6. Review privacy disclosures for the new owner/invitation security cookies and access-record retention before issuing invitations; keep legal notice versions/snapshots aligned with the existing release process. Configure edge rules below, inspect real response/cache headers through the deployed hostname, and exercise public browsing, builder edits/uploads, inquiry submission, booking, analytics consent and owner MFA/logout. Check mobile and keyboard access.
7. Deploy updated photos and purge previous image/optimizer caches through the host. New preview URLs bypass old keys on this site, but old saved URLs/downloads cannot be recalled. Move future confidential content straight to the private publishing workflow.
8. Schedule `POST /api/security/maintenance?dryRun=false` daily, using `Authorization: Bearer <PRIVACY_CRON_SECRET>`. Preview with `dryRun=true`. Retain the existing privacy, media and booking maintenance schedules. Private media blobs remain until deliberately deleted; deleting an invitation does not delete its case assets.
9. Run `npm run check:production` with the real release environment. Record successful deployed-header checks, alert tests and backup restoration in the release record. These operator actions have not been performed against production here.

## Route and action access inventory

| Surface | Access boundary |
| --- | --- |
| Main portfolio, about, services, terms/privacy, sitemap and social images | Public; secrets and private case records excluded from rendered output. |
| `/refer/[token]`, referral query, `/build/preview/[token]` | Existing opaque bearer links, not identity-based confidentiality. Submitted designs remain intentionally shareable by link; no ownership migration is claimed. Preview HTML gets no-store and no-referrer. |
| `/build`, `/build/t/...` | Public published template data and assets. Draft template reads require an active developer session; original source is excluded from the public asset allowlist. |
| `/build/bake` | Deliberate template execution in an opaque-origin sandbox; keeps its separate restrictive policy and cannot read parent cookies/DOM. Use only trusted developer uploads for capture. |
| `/api/dev/templates` POST/PATCH/GET; developer actions | Server checks active developer session. Mutation routes additionally check Origin. Source and failures use private/no-store headers. |
| `/admin/analytics`, reports and logout-all | Active owner session required for private reporting/actions. Developer sessions do not confer owner access. Login is rate-limited and production MFA protected. |
| `/private/[slug]`, `/api/private/[slug]/[file]` | Unexpired, unrevoked invitation for the exact case on every request. Images must be listed in that case's manifest. Originals have no application delivery route. |
| `/api/builder/media` POST and `[file]` GET | Uploads require same-origin browser context and quotas. Uploaded visitor images remain deliberately shareable by opaque URL; they are not confidential case assets. |
| `/api/builder/css`, fonts/font-file; HTML-to-pieces action | Public bounded builder functionality. CSS and HTML work is quota limited; font proxy destinations are constrained. |
| Inquiry, introduction and meeting actions | Public server validation, bot heuristics and per-client/global service quotas. Notification delivery has global hour/day budgets. |
| `/api/booking/webhook` | Bounded raw body plus provider signature; existing journal/idempotency handles duplicates. |
| Analytics consent/ingestion routes | Same-origin, bounded payloads, existing consent validation and event filtering, per-client quotas. |
| Booking/privacy/media/security maintenance | Separate existing maintenance secret checks, private responses; security cleanup requires explicit dry-run selection. |
| `/api/security/report` | Bounded, rate-limited report ingestion; raw reports are discarded, only fixed event counts logged. Reports may legitimately omit Origin; explicitly foreign origins are rejected. |
| `/api/health` | Existing health check; keep it free of credentials and private records. |

## Managing private case studies

Create a manifest **outside `public/` and outside tracked source**, for example `.private-assets/case.json`:

```json
{
  "slug": "client-review",
  "title": "Client review",
  "summary": "Approved, redacted description for this audience.",
  "images": [
    { "source": "redacted-preview.png", "name": "overview", "alt": "Approved overview of the client project" }
  ]
}
```

Review/redact content before publishing. The source filename is relative to the manifest; the command never automatically redacts a confidential image. With the target database and **private** Blob credentials configured locally:

```sh
npm run security:access -- publish-private .private-assets/case.json
npm run security:access -- invite client-review 7
npm run security:access -- revoke <grant-id>
```

The invitation command displays the page path, grant ID and one raw code once. Share the code separately from the URL through your chosen channel. Invitations are bearer credentials valid for 1–30 days; a viewer cookie lasts at most eight hours. Opening another case replaces that browser's case cookie. Revocation is checked on the next request, including image requests. Already displayed/saved pixels cannot be recalled. Closing the private view removes that browser's cookie; revoke the grant to invalidate all copies of its code.

The publisher writes domain-watermarked previews to private Blob paths and stores only descriptions and approved filenames in PostgreSQL. Originals remain in the local source location; no original is uploaded by this command. There is no original-download permission or endpoint to accidentally expose. Generic attribution is implemented; per-viewer forensic watermarking and managed SSO/passkeys are not part of this release.

## Maintaining public photos

```sh
npm run security:photos                 # list candidate photos without changing them
npm run security:photos -- --apply       # back up originals privately, write pixel watermarks
npm run samples:screens                 # future sample captures are watermarked too
```

The photo tool records hashes locally to avoid repeatedly encoding the same output. Keep `.private-assets/` securely backed up and out of artifacts. When replacing a photo, remove its old local original/ledger entry deliberately after backing it up, then reprocess; do not confuse a previously watermarked preview with a new original. Public-template assets, logos and SVG grain are intentionally excluded. About-page photo attribution is retained in `public/images/about/CREDITS.md` and the page captions.

The release scanner rejects tracked private folders, public original/source folders, selected credential patterns and browser source maps. It does not prove that arbitrary sensitive text or all historical commits are secret-free. Enable the source-control provider's secret scanning and push protection; rotate any credential that was ever exposed.

## Session and credential incident response

```sh
npm run security:access -- logout-all owner
npm run security:access -- logout-all developer
```

These commands revoke active database sessions immediately. The owner dashboard also offers “Sign out all devices”. Normal owner/developer logout revokes the current database session before deleting the cookie. Incrementing the corresponding session version, rotating its signing secret, or changing its password hash invalidates signed cookies after the new environment is deployed. MFA-secret changes invalidate owner cookies too.

For a suspected leak: revoke affected sessions/invitations, remove exposed previews from Blob and their private manifest, purge public CDN caches if relevant, rotate exposed credentials through the provider, investigate redacted security events, and restore access only after validation. Do not delete production records or rewrite Git history as a routine deployment step. Lost MFA recovery requires an authorized infrastructure operator to revoke owner sessions and replace/enroll the MFA secret; no password-only production bypass is provided.

## Edge limits and infrastructure work

Application quotas use the database and do not substitute for pre-function filtering. Process concurrency caps apply to each server instance; they are not a distributed semaphore. Defaults currently include media 30/hour and 100/day per client plus 1000/day globally; template imports 100/day globally; CSS 240/hour per client and 3000/hour globally; HTML conversion 60/hour per client and 1000/hour globally; forms 500/day globally per type; notifications 100/hour and 500/day globally. Per-client login and form limits remain tighter. Tune against measured traffic.

On Vercel, configure [WAF rate-limiting rules](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) in the project's Firewall settings. Suggested starting conditions:

| Match | Initial edge budget | Action |
| --- | --- | --- |
| POST `/api/builder/media` | 10/minute per source IP | Observe, then 429 excess requests |
| POST/PATCH `/api/dev/templates` | 5/minute per source IP | Observe, then 429 |
| POST `/api/builder/css` | 120/minute per source IP | Observe, then 429 |
| POST `/admin/...` and `/private/...` | 20/minute per source IP | Observe, then 429; app limits remain authoritative |
| Other public POST requests | 120/minute per source IP | Observe, then 429; preserve legitimate provider webhook retries |

Available rule counts/actions depend on the hosting plan. Do not blanket-challenge SEO pages or bypass security merely because a User-Agent claims to be a crawler. Use provider-verified crawler signals where applicable. Keep adaptive challenges off until measured abuse warrants them. Configure spend/storage alerts in the provider as well.

For self-hosting, merge [the nginx example](../deploy/nginx-security.conf.example) into an existing TLS deployment, verify with `nginx -t`, test in dry-run, then enable limits. Its syntax follows the [nginx limit-request module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html). Never expose the Next listening port directly. No hosting firewall was modified by local code changes.

Use separate production/staging databases and Blob stores. Runtime database credentials should have only the application's required DML permissions; use a separate migration identity for DDL. Restrict network access and require TLS using provider settings. Keep originals/backups encrypted and access controlled. Configure provider MFA/passkeys for source control, hosting, database and storage accounts; application MFA does not secure those accounts.

## Monitoring and recovery checks

Security logs contain JSON `type=security`, a fixed `event`, a bounded `count`, and timestamp. Forward these through the host's existing log drain. Suggested alerts: sustained login failures or limit trips for five minutes; any unexpected privileged access changes; repeated import rejections/processing-busy events; a rise in CSP violations after release; sudden Blob bandwidth/storage/compute spend increases. Set numeric thresholds from a staging exercise and measured normal traffic. No alert service was connected or test notification sent here.

CSP report bodies are intentionally discarded because they can contain private URLs and script samples. The current log records aggregate violation counts, so browser console/staging inspection is needed to identify specific blocked resources without collecting confidential report fields. Run core journeys in report-only mode, review console violations, then set `SECURITY_CSP_MODE=enforce` and repeat. Reverting to report-only is the CSP rollback; never remove server authorization as a workaround. Nonce-based CSP forces dynamic rendering/no-store HTML and increases server rendering costs.

Quarterly restore drill: create an isolated database/store, restore a provider backup, apply pending additive migrations, verify record counts and representative authorized reads, verify revoked access stays denied, and destroy the isolated copy under retention policy. Record backup date, restore duration, expected recovery window and result. This repository cannot perform a genuine production restore drill without the backup/provider environment.

## Development-tooling advisory

The full dependency audit also identifies [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): recursive brace-pattern handling in `braces <=3.0.3`. Upstream lists no patched version. In this tree it is reached through `eslint-config-next` → Next's ESLint plugin → `fast-glob` → `micromatch`; it is excluded from the production dependency audit. Next's plugin uses it to resolve configured repository root patterns, not public HTTP input. The audit reports the same advisory through five dependent package entries, not five distinct vulnerabilities.

Keep lint restricted to repository-controlled patterns; do not expose lint/glob APIs to visitors. CI has read-only repository permissions, no production credentials and a job timeout. Do not run untrusted repository scripts on a privileged machine. The production audit remains blocking in CI; the full tooling audit is reported as a non-blocking CI step while this upstream issue is unresolved. Keep the full audit under review and update when an upstream fix is available; no audit suppression, vulnerable-version fork or incompatible Next/ESLint downgrade was introduced. Vite's separate development-tooling advisories were patched through its compatible dependency update.

## Verification record

See the implementation follow-up in [the investigation](PORTFOLIO_SECURITY_INVESTIGATION.md) for the final local checks. `npm run check:production` must also pass with the actual release settings. This workspace's existing production booking configuration contained placeholders and could not be used as a release configuration; isolated valid fixture settings were used for build/browser verification. No production deployment, real provider callback exercise, managed SSO connection, alert delivery, or production backup restore is claimed.
