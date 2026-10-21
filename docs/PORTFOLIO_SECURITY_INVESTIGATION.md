# Portfolio security investigation and implementation plan

Investigated: 2026-10-21. Status: implementation follow-up added; original findings below describe the pre-hardening tree.

Scope: the current local working tree, including the in-progress analytics owner dashboard. This is a source review and browser-capability investigation, not a penetration test or verification of production configuration. Existing uncommitted work was preserved.

## Implementation follow-up

Application hardening is implemented. See [security controls and operations](SECURITY.md) for release order, route boundaries, MFA enrollment, private publishing, session revocation, quotas, CI and infrastructure tasks. The original investigation remains below as the source review record.

- Bounded streamed bodies, pinned HTTPS downloads, redirect/DNS/range checks, aggregate download/ZIP budgets, image limits and processing capacity caps.
- Revocable database-backed owner/developer sessions, credential/version invalidation, owner MFA with single-use time steps, global login/endpoint/notification budgets and explicit proxy-header trust.
- Pixel watermarks on 33 public portfolio images, private local originals, cache-versioned preview URLs and a private case-study/invitation/media workflow.
- Baseline header hardening, dynamic per-request script nonces, stricter CSP in Report-Only by default, redacted event/report handling and security CI/file/bundle/dependency checks.
- Hosting rules, real production enrollment/deployment, provider account protections, alert wiring, cache purge and backup restoration require operator rollout. Public builder uploads/templates remain intentionally shareable. Browser inspection, saving rendered images and screenshots remain possible.

Validation: the production build, TypeScript, ESLint, file/browser-bundle checks and 667 unit/integration tests (54 files) passed with an isolated PostgreSQL database. The additive migration applied successfully. Production-mode security browser tests passed eight cases across phone/tablet/desktop, with four explicit desktop-only skips; the final browser server used enforced CSP. Tests cover nonce propagation, private image optimizer exclusion, invitation revocation, owner MFA/copied-cookie revocation and sanitized editing of a published template with no script-policy violations. The production dependency audit reported zero known vulnerabilities. See [the operations guide](SECURITY.md) for the remaining unpatched development-only `braces` advisory.

An earlier concurrent test run had a worker-start timeout and passed on a single-worker thread rerun. An existing builder scenario targeting unpublished `noir-needle` was unsuitable for anonymous production access; the final security test uses a published template instead. Real booking-provider callbacks, external storage delivery, deployed hosting headers, production enrollment, alert delivery and backup restoration remain operator verification tasks. Source review findings are not a production security certification.

## Recommendation

Protect private content before it reaches the browser, publish watermarked derivatives of valuable photos, and strengthen the server endpoints that handle uploads, leads, bookings, and administration. Keep the public portfolio easy to browse, accessible, and indexable.

An ordinary public website cannot guarantee that visitors cannot inspect it, save displayed images, or take screenshots. Treat anything delivered to a visitor as recoverable. Browser restrictions can discourage casual copying; they cannot establish confidentiality.

## Requested protections: feasibility

| Request | What is realistic | Recommendation |
| --- | --- | --- |
| Make the website uninspectable | Visitors control their browser. They can inspect delivered HTML, CSS, scripts and network responses, disable JavaScript, or request URLs directly. Minification and withholding source maps reduce source readability, not access. | Keep credentials, originals, private records and privileged decisions on the server. Verify production bundles and responses contain no secrets. Do not add DevTools detection, debugger loops or shortcut interception. |
| Make photos not downloadable | A displayed photo has already been delivered. Removing download buttons, disabling dragging or intercepting right-click only removes convenient interactions. CSS backgrounds, canvas, blob URLs and transparent overlays do not prevent recovery. | Publish appropriately sized, server-watermarked previews. Store originals privately and authorize every request that can retrieve them. Optional `draggable={false}` on selected portfolio images can discourage accidental dragging. |
| Prevent screenshots | A normal page cannot control OS screenshot tools, browser capture tools, screen recording, extensions or an external camera. Focus/visibility events and Print Screen handlers are unreliable signals. | Burn attribution into the image pixels. For confidential work, require access and show redacted previews; use a pseudonymous per-viewer watermark if tracing disclosure matters. Never promise screenshot prevention. |
| Prevent bulk copying and hotlinking | Edge limits and traffic analysis can reduce automated abuse and bandwidth costs; distributed scrapers can still retrieve public content. Referrer checks are bypassable and sometimes absent for legitimate visitors. | Add measured edge limits and alerts, with exceptions for verified crawlers and normal browsing. Use access controls for private media. Treat hotlink restrictions as optional cost control. |

These conclusions follow from browser capabilities: Chrome documents [disabling page JavaScript](https://developer.chrome.com/docs/devtools/javascript/disable) and [inspecting network responses](https://developer.chrome.com/docs/devtools/network/reference/). MDN documents that [`display-capture`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/display-capture) controls a document's use of `getDisplayMedia()`. Inference: disabling that API does not prevent an OS screenshot or another application from recording the display.

Avoid global right-click, text-selection, keyboard, printing, or focus-loss blocking. These interfere with normal navigation, accessibility, sharing and prospective clients evaluating the portfolio, while leaving the delivered content recoverable. `robots.txt`, `noindex`, CORS, opaque filenames and copyright notices also do not authorize access or prevent downloading.

## Current controls and findings

Priorities describe proposed work order, not confirmed exploit severity. Potential weaknesses below need targeted testing before being called exploitable vulnerabilities.

| Area | Source evidence | Finding and implication |
| --- | --- | --- |
| Baseline headers | `next.config.ts` | CSP, `nosniff`, referrer policy, permissions restrictions, production HSTS and disabled `X-Powered-By` already exist. CSP blocks framing by default. Verify effective headers at the deployed CDN and on error responses. |
| CSP hardening | `next.config.ts` | Production still permits inline scripts and styles. `object-src` is absent, so objects fall back to `default-src 'self'`. Builder routes allow broad HTTPS image/embed sources; `/build/bake` intentionally has a separate sandbox policy. Add `object-src 'none'`; investigate stricter scripts without breaking hydration, booking, analytics or builder previews. |
| Uploaded media exposure | `src/app/api/builder/media/[file]/route.ts`, `src/server/builder/media.ts` | Storage is private, but the GET route serves both temporary and retained images to anyone with the URL, without a session check, with one-year public immutable caching. Random IDs limit guessing; they do not stop sharing. This is appropriate only for deliberately public media. Confidential uploads need a separate authorized delivery path and cache policy. |
| Image processing | `src/server/builder/media.ts` | Uploaded images have a 5 MB limit, accepted decoded formats, pixel limit, resize to 2400px, WebP re-encoding and metadata removal. Good existing controls. Add explicit animation/frame, processing-time and concurrency budgets; confirm upload limits apply before multipart buffering. |
| Public upload abuse | `src/app/api/builder/media/route.ts` | Origin checks and per-address hourly/daily limits exist. Origin checks protect browser cross-site writes; non-browser clients can forge that header. Add global storage/compute budgets and edge limits; consider challenges only after observed abuse. |
| Remote asset downloads | `src/server/builder/safe-fetch.ts`, `src/lib/builder/import/assets.ts` | HTTPS, public-address checks, redirect checks, timeout and count limits exist. DNS is validated before a separate `fetch`, so connection-time DNS rebinding protection is not established. `Content-Length` is checked, but asset bytes are checked after `arrayBuffer()` buffers the response; missing or misleading lengths can exceed the intended memory budget. Prioritize bounded streaming and connection-time address enforcement. |
| Privileged sessions | `src/server/security/dev-session.ts`, `src/server/admin/session.ts`, `src/app/admin/analytics/actions.ts`, `src/server/actions/dev-templates.ts` | Signed, expiring HttpOnly/Secure-in-production/SameSite cookies and password verification exist. Developer login has per-IP and global limits; owner login currently has a per-IP limit. Shared passwords and stateless sessions need a revocation strategy and stronger owner authentication. Changing the developer password hash alone does not invalidate its existing signed cookies. |
| Client identity for limits | `src/server/security/request.ts`, `rate-limit.ts` | PostgreSQL-backed counters work across instances. Client identity trusts forwarded headers; the source explicitly notes proxy trust is required. Validate the real deployment's overwrite behavior and prevent bypassing its trusted ingress. App limits alone do not protect the database from request floods. |
| Lead and introduction forms | `src/server/actions/forms.ts`, `src/server/services/lead.ts`, `introduction.ts` | Service-level limits and honeypot/timing checks already exist. Preserve these and test direct action calls, payload bounds and notification quotas. Client-side timing is a heuristic, not authentication. |
| Booking webhook | `src/app/api/booking/webhook/route.ts` | Signature verification, body-size checks and event journaling exist. Verify duplicate delivery/replay behavior and actual streamed request limits. Post-read size checks do not bound memory allocation. |
| Public assets | `public/brand/`, `public/builder-templates/` | Brand files, template images, thumbnails and template JSON are publicly addressable. Inventory these before asserting that any particular asset or template is private. Public template data can be intentional; confidential client work must never be placed here. |

Private storage does not by itself imply private delivery. Likewise, `Cache-Control: no-store` reduces caching but cannot recall a file already saved by an authorized viewer.

## Proposed content and photo policy

| Content class | Delivery | Cache and attribution |
| --- | --- | --- |
| Public portfolio | Optimized preview at the required display size, with responsive variants; never a full-resolution original | Public CDN caching is fine. Burn a tasteful brand/domain watermark into valuable photos during processing. Keep useful alt text. |
| Confidential case study | Server-authorized, redacted preview behind an expiring invitation/session | `private, no-store` on protected HTML and media; ensure CDN and image-optimization paths cannot bypass access checks or cache protected derivatives publicly. Optional server-rendered viewer watermark uses an opaque ID, not an email address. |
| Original photo or source file | Private storage; explicit owner access or a separately granted download permission | No public static path. Short-lived signed URLs, if used, remain shareable bearer credentials until expiry; define expiry and revocation behavior. |
| Visitor builder upload | Decide whether it is deliberately shareable or private to the draft/session before changing behavior | Preserve existing public design behavior where intended. Private drafts need ownership records and authorization for reads, promotion and deletion. |

Watermarks should be baked into every published derivative, including thumbnails and responsive sizes; a removable HTML overlay offers little protection. Keep the unwatermarked original out of public storage paths and responses. Strip EXIF/GPS metadata. Avoid an alternate unwatermarked URL or optimizer route undermining the policy. A watermark deters reuse and supports attribution but can be cropped or edited.

## Prioritized implementation plan

Effort is a rough engineering estimate, excluding provider procurement and a full external penetration test. Complete each phase with its acceptance checks; this document does not authorize publishing private assets or changing production access rules.

### Phase 1 — server boundaries and resource limits (P1, approximately 3–5 days)

1. Inventory all routes/actions and classify public versus protected data, especially builder drafts, previews, uploaded images, template source, owner reports and maintenance routes. Record which checks run on every request; hiding a UI is insufficient.
2. Enforce bounded streamed bodies for remote downloads and public uploads/webhooks, plus aggregate import size, decompressed archive limits, image frame/pixel limits, concurrency and processing deadlines. Do not rely on `Content-Length` or a size check after buffering.
3. Strengthen remote fetching with connection-time public-address enforcement or a constrained egress proxy, checking every redirect and IPv4/IPv6 representation. Restrict destinations where the product permits it; retain timeout/count limits.
4. Verify trusted proxy IP handling. Add edge rate limits before database work and global quotas for uploads, imports and expensive CSS/image processing. Define safe failure responses and retry behavior.
5. Add `object-src 'none'`, verify deployed baseline headers, and review cache behavior for every protected response. Keep the bake sandbox's intentional exceptions scoped to that route.

Acceptance: direct requests without valid sessions cannot read protected data; forged Origin/forwarded headers do not bypass the intended limits; oversized/chunked uploads and downloads abort within configured budgets; private/local/redirected/rebound remote destinations are rejected. Existing public builder, forms, booking and analytics flows continue to work.

### Phase 2 — content protection (P1/P2, approximately 2–4 days)

1. Build an inventory of portfolio photos and template assets, marking originals, public derivatives and confidential material. Set display-size and quality budgets from the actual layouts.
2. Generate watermarked public variants during asset processing, with no unwatermarked original in public paths, `srcset`, metadata or API responses. Keep original backups private.
3. Add server-enforced invitations/sessions for confidential case studies, with expiry, revocation and authorization on both pages and media. Choose whether visitor draft uploads remain shareable before migrating their route/cache semantics.
4. Optionally disable dragging for selected decorative portfolio images. Avoid global event blocking and preserve normal links, keyboard access and builder drag interactions.

Acceptance: anonymous requests to originals/private media fail; expired/revoked access fails; cross-user access fails; CDN/optimizer URLs cannot bypass authorization. Every public preview has the intended watermark and no GPS metadata. An OS screenshot will still work and should show only approved preview content.

### Phase 3 — privileged access and injection defenses (P2, approximately 3–5 days)

1. Add managed owner identity with MFA/passkeys where practical; protect hosting, source control, database and storage accounts as well. Maintain separate developer and owner permissions. Add a balanced global owner-login budget and alerting without creating an easy account lockout attack.
2. Introduce session revocation/versioning or a server-side session registry, with documented logout-all and emergency secret-rotation procedures. Include existing developer sessions when rotating credentials.
3. Trial a stricter script CSP in Report-Only, then enforce after reviewing hydration, booking, analytics, animations, embedded previews and accessibility. Select nonces versus a supported hash approach based on the installed Next.js guide and rendering strategy. Nonces require dynamic rendering and affect caching; do not simply remove `unsafe-inline` from the current configuration.
4. Review HTML/CSS/template sanitization and iframe sandbox boundaries using malicious fixtures. Restrict allowed remote embed destinations where practical. Ensure imported content cannot read parent DOM, cookies or private server data.

Acceptance: revoked sessions fail immediately under the chosen design; direct privileged actions require the correct identity; malicious markup does not execute in the parent origin; production has no unexpected CSP violations across core journeys. Sanitize and rate-limit CSP reports so reporting itself does not leak private URLs or become an abuse endpoint.

### Phase 4 — operations and ongoing assurance (P2/P3, approximately 1–3 days initially)

1. Add dependency/advisory review in CI, secret scanning and checks for public source maps, private files, credentials in client bundles and accidental sensitive response fields. Verify locked versions and advisory applicability before proposing upgrades; no dependency vulnerability scan was performed here.
2. Log security events with redaction: privileged login failures, quota trips, rejected imports and authorization failures. Exclude passwords, raw session/invitation tokens, contact payloads and sensitive query strings. Alert on sustained failures, bandwidth/storage spikes and unusual privileged actions.
3. Apply least-privilege database/storage credentials, review environment separation, verify backup encryption and run a restore drill. Document credential rotation, asset unpublishing/cache purge, incident handling and retention cleanup.
4. Add adaptive bot challenges only if measured abuse warrants them. Measure impact on accessibility, genuine leads, crawler indexing and performance before enforcing broadly.

Acceptance: CI detects an intentional dummy secret fixture without publishing it; alerts and quota responses are exercised in staging; a backup restores successfully; the owner can revoke access and remove an exposed asset using the runbook. Previously downloaded copies cannot be recalled.

## Validation and release approach

Implement changes in small phases with targeted unit/integration tests for authorization, byte limits, SSRF redirects/rebinding, session revocation, webhook duplication and private-cache behavior. Use browser tests for public navigation, forms, builder uploads/previews, confidential access, booking and owner login. Test keyboard and screen-reader flows; use production-mode builds because development CSP and caching differ.

Before enforcing a new policy, inspect real response headers and caches through the deployment provider, including denied requests, static files and optimized images. Measure CSP reports and bot-limit false positives. Roll out CSP in Report-Only and quotas in observation mode where supported; define a rollback switch without removing server authorization.

The original investigation changed documentation only. The implementation follow-up above supersedes that status; no production penetration test or absolute security guarantee is claimed.

## References

Reviewed the installed framework guidance rather than assuming earlier Next.js behavior:

- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` — nonce propagation through Proxy, dynamic-rendering requirement and development versus production policy.
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md` — server-only access layers, authorization and minimal data returned to the client.
- [Chrome: disable JavaScript](https://developer.chrome.com/docs/devtools/javascript/disable) and [network inspection](https://developer.chrome.com/docs/devtools/network/reference/) — why browser event blocking cannot protect delivered assets.
- [MDN: display-capture permissions policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/display-capture) — scope of browser screen-sharing restrictions.
- [OWASP: CSP](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) — injection defenses and staged policy rollout.
- [OWASP: file uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — layered validation, resource limits and storage separation.
- [OWASP: SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) — destination, DNS and redirect controls.
