# Feature Inventory and Migration Mapping

Status key: **Keep** (preserve behaviour), **Improve** (preserve intent, change implementation), **Replace**, **Drop** (with reason), **New** (not in source).
Phase refers to the section of the brief.

## A. Page mapping

| Source | New route | Notes |
|---|---|---|
| `Custom Website Offer.dc.html` | `/` | Public sales page. Offer block is hidden unless an active offer applies. |
| `Custom Website Offer.dc.html` (referred visitor) | `/r/[token]` *or* `/?ref=[token]` — see D3 | Prospect landing with the personalised offer and attribution. |
| `Client Referral.dc.html` | `/refer/[token]` | The referrer's page (share + introduce). Personalised, `noindex`. |
| Introduction dialog | `InquiryDialog` + `ReferralIntroForm` | Server action. |
| Inquiry dialog | `InquiryDialog` + `InquiryForm` | Server action. |
| — | `/privacy`, `/terms` | **New**; required by consent and footer. Text supplied by owner/legal. |
| — | `/admin/*` | **New, deferred** (Phase 7), see scope below. |

## B. Section mapping — Sales page (P2)

| Source section | Decision | New implementation |
|---|---|---|
| Nav | Improve | `SiteHeader` + `ResponsiveNavigation`: accessible disclosure menu on mobile (the source hides links below 900px with no replacement). Add "Special offer" item only when an offer is active. |
| Hero (2 headline variants) | Improve | One headline from content config; drop the `headline` toggle prop. Offer pill shown only for a valid offer. Remove the decorative React code card unless approved. |
| What we build (6) | Improve | Data-driven `ServiceCard`s from the `Service` table or seed config. Add the brief's extra categories (redesign, automation, integrations) as **proposed** copy for owner approval. |
| Why custom | Improve | Honest 3-part content: when a template is enough, when custom pays off, scalability/integrations. Remove the all-negative template card. |
| Approach (4 steps) | Improve | Expand to the brief's 6 stages with plain-language "what you can expect". `ProcessStep`. |
| Why us (6 benefits) | Keep (merge) | Merge with P1's list into one `FeatureCard` data set. Remove claims we cannot support. |
| Capabilities (3 tabs, 12 items) | Improve | Config-driven groups; keep tab UX as an accessible tablist. Decorative mocks are reduced to a labelled illustration ("example interface") and never imply a live feature. Add the brief's items (payments, CMS, automation, maintenance) as proposed copy. |
| Offer | Improve | `ReferralOfferCard`. Rendered only when a verified, active, non-expired offer exists. Expired → hidden, or a neutral "this offer has ended" note on the personal landing. |
| What to expect (3) | Improve | Cover: initial discussion, requirements, scope, timeline estimate, pricing discussion, next steps. No fixed timelines/prices. |
| Final CTA (2 buttons) | Keep | "Start a conversation" and "Request a consultation" open the same dialog with a different `intent` value. |
| Footer | Improve | Company data from config. Add privacy/terms links. |
| Mobile sticky CTA | Keep | Keep, with correct safe-area padding and no overlap with the toast/footer. |
| Toast | Improve | `aria-live="polite"` region, supports error variant. |

## C. Section mapping — Referral page (P1)

| Source section | Decision | New implementation |
|---|---|---|
| Nav | Improve | Same `SiteHeader`; "Make an introduction" CTA. |
| Hero + "Recommended by" chip | Keep | Personalised with referrer name; initials avatar. Defaults when name absent ("A friend of {company}"). |
| Recommendation quote | Improve | Uses the campaign's `personalMessage` when set, otherwise neutral copy that **does not claim** the referrer "worked with us" unless campaign flag confirms a client relationship. |
| What we do (4) / Why us (6) | Replace | Reuse the sales page's `ServiceCard`/`FeatureCard` data (brief §4.3). |
| Offer | Improve | `ReferralOfferCard` from campaign; hidden when none configured; expiry evaluated server-side. |
| How it works | Keep | 3 steps, `ProcessStep`. |
| Share message | Improve | Templated from campaign data, includes the prospect link with the campaign token. Preview text is editable. Buttons: copy, email, WhatsApp, copy link. |
| Final CTA, closing, footer | Keep | |
| Sticky mobile bar | Keep | |

## D. Interaction mapping

| Source behaviour | Decision | Detail |
|---|---|---|
| Copy message | **Fix** | Await the Clipboard API, fall back to `execCommand`, and report **success or failure** in an `aria-live` region. Do not show "Copied!" until the copy resolves. |
| Copy link | **Fix** | Copies the *prospect landing link with the campaign token*, not the company site. |
| Email share (`mailto:`) | Keep | Built with `URLSearchParams`/`encodeURIComponent`. Unit-tested. |
| WhatsApp share (`wa.me`) | Keep | Same. Message length is capped; link is `https` only. |
| Dialog open/close/Esc/backdrop | Improve | Radix Dialog (via shadcn): focus trap, focus return, scroll lock, labelled title/description. |
| Client validation | Improve | Zod schema **shared by client and server**; React Hook Form. Errors on blur/submit and cleared on input. |
| Submit (simulated) | **Replace** | Server action → Zod parse → rate limit → honeypot → persist → notification outbox → typed result. |
| Success message | **Rewrite** | Only states what actually happens (see below). |
| Capability tabs | Keep | Accessible tablist. |
| Scroll reveal | Improve | CSS-only, `prefers-reduced-motion` respected. Content is never hidden if JS fails. |
| `markPlaceholders` | **Drop** | Authoring aid. Missing values use defaults or hide the block. |
| `headline` toggle | **Drop** | Content is configuration, not a runtime toggle. |
| `introduced` checkbox (checked by default) | **Replace** | Attribution comes from the verified token on the URL, not from a self-declared box. A visitor without a token can still tick "I was referred by someone" → recorded as *unverified* referral claim, **no offer applied automatically**. |
| `showExpiry` toggle | **Replace** | Expiry is evaluated against `expiresAt`. |

### Success copy (replacement)
- Inquiry: "Thanks, {firstName}. We've received your inquiry. We'll reply to {email} to arrange a first conversation." **No promised response time** until the owner confirms one.
- Introduction: "Thanks, your introduction has been recorded." Add "We'll contact {referralName}" only when the owner confirms that outreach is policy. Add "we've emailed you a copy" **only when** the referrer notification is implemented and a send has succeeded (see Phase 5.3 and the flag `NOTIFY_REFERRER`).

## E. Form field mapping

### Referral introduction (P1 → Phase 4.6)
| Source field | New field | Rule |
|---|---|---|
| yourName* | `referrerName` | 1–100 chars |
| yourEmail* | `referrerEmail` | RFC-valid, normalised lowercase |
| referralName* | `referredName` | 1–100 |
| referralEmail* | `referredEmail` | valid; must differ from referrer |
| company | `referredCompany` | optional ≤120 |
| lookingFor* (`new/redesign/feature/unsure`) | `projectInterest` enum `NEW_WEBSITE / REDESIGN / FEATURE_OR_INTEGRATION / UNSURE` | required |
| message | `message` | optional ≤1000 |
| — | `referrerConsent` | **New**: referrer confirms they have the referred person's permission to share their details. Required. |
| — | `website` honeypot | **New**: hidden anti-bot field. |

### Project inquiry (P2 → Phase 5.1)
| Source field | New field | Rule |
|---|---|---|
| name*, email*, company* | `name`, `email`, `companyName` | `companyName` stays required in source; brief lists Company with no flag → **open decision Q2** |
| website | `currentWebsite` | optional, `http(s)` only, normalised |
| Project type (7 options) | `projectType` | enum per decision Q1 |
| Website type (select) | `websiteType` | enum; **conditionally shown** only for New project / Redesign / E-commerce |
| goal* | `projectGoals` | 1–500 |
| details | `additionalDetails` | optional ≤2000 |
| introduced | derived server-side | see above |
| — | `privacyConsent` | **New**, required |
| — | `intent` (`conversation` / `consultation`) | **New**, hidden; replaces the "prefilled details" hack |
| — | `refToken` | **New**, hidden; verified server-side |

## F. Content decisions

| Item | Decision |
|---|---|
| "Know a business that could use a better website?" etc. | Keep tone; edit for honesty. |
| "We read every inquiry personally." | **Drop** unless true. |
| "Professional development", "Modern technology" | Reword to specifics we can support; avoid unmeasurable superlatives. |
| "within a couple of business days" | **Drop** pending owner SLA. |
| "This is our thank-you to both of you" | **Drop** unless the referrer benefit is defined. |
| "Mention your introduction when contacting us to receive the special offer" | Replace with link-based verified flow. |
| Testimonials, logos, case studies | **None exist.** `TestimonialCard` is built but **not rendered** until real content is supplied. |

## G. New functionality (not in source)

| Feature | Brief phase | Scope in v1 |
|---|---|---|
| Postgres persistence (Company, Service, ReferralCampaign, Lead, ReferralIntroduction, NotificationLog) | 6 | **In** |
| Server-side campaign verification and attribution | 5.4 | **In** |
| Offer validity (active, start, expiry) | 3.7, 4.4 | **In** |
| Rate limiting, honeypot, duplicate-submit protection (idempotency key) | 9 | **In** |
| Transactional email via provider abstraction + outbox log | 5.3 | **In** (code), *delivery unverified* until credentials exist |
| SEO metadata, OG, sitemap, robots, `noindex` on referral pages | 8 | **In** |
| Analytics hooks (provider-neutral events) | 1 | **Stub** only; no vendor chosen |
| Consultation scheduling | 1 | **Out** (planned); "Request a consultation" = inquiry with `intent=consultation` |
| Payments / checkout | 1 | **Out** (planned); not needed for lead-gen |
| CAPTCHA | 9 | **Evaluate after launch**; Cloudflare Turnstile adapter is a flag-guarded option |
| Admin: auth, lead list, status change, campaign CRUD | 7 | **Minimal** (see below) |
| Seed script and demo campaign | 6 | **In** (dev only, labelled as demo data) |
| Test suite (unit, integration, e2e, a11y) | 10 | **In** |

### Admin scope (Phase 7)
| Capability | v1 |
|---|---|
| Authentication (single admin allow-list via credentials/magic link) | Implemented if time allows, otherwise **planned** |
| Lead list + status update | Implemented, read-mostly |
| Campaign create / activate / expire | Via **seed script / CLI first**; UI planned |
| Company & service editing | Planned (config/seed) |
| Analytics dashboard | Planned |

The data model and service layer support all of these now. No public form needs to change when admin ships. The final report will list each of these as implemented / planned.

## H. Open decisions (blocking or shaping)

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | Project type options: brief's list or P2's list? | **Brief's list** (superset, includes Maintenance and Integration). |
| Q2 | Is Company required on the inquiry form? | **Optional** (lower friction). |
| Q3 | Palette: Organic terracotta/sage, violet/teal, or new brand? | **Organic terracotta/sage** (consistent with the system and P1). |
| Q4 | Real company name/contact/logo/URL | Placeholder config via env + seed, flagged as such. |
| Q5 | Real offer definition | None displayed. |
| Q6 | Referral link design (see D3 in TECHNICAL_DECISIONS) | `/refer/[token]` for referrers, `/?ref=[token]` for prospects. |

## Update: restored original components

| Original element | Status |
|---|---|
| Logo mark | Implemented (header, footer, favicon, OG image) |
| Hero browser/code/phone composition | Implemented, decorative |
| Capabilities tabs + booking calendar mock + 12 capability cards | Implemented (3 groups) |
| Numbered services, process connector, custom-vs-template look | Implemented |
| Offer split panel (sales) / three-block offer card (referral) | Implemented; shown only for an active offer |
| Stats counter | Implemented with content-derived counts (not business results) |
| Social flip buttons | Implemented in footer; channels depend on env |
| Bento grid | Implemented as "Why work with us" |
