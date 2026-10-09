# Working version → real meeting booking: implementation plan

Status: application implementation completed locally, 2026-10-07; live Cal.com account/calendar activation and external delivery acceptance remain pending. Based on the [working version investigation](./WORKING_VERSION_BOOKING_INVESTIGATION.md). This document plans the work; it does not enable scheduling or create appointments.

## Outcome

A visitor can try the working example, choose **Book a meeting with Veloce**, select real availability, and receive a confirmed appointment with the Veloce team. The invitation explains the value of a discussion and identifies the meeting before the visitor enters scheduling. Booking is also available without completing the example.

Use a managed scheduler embedded in a Veloce booking panel for the first release. Cal.com is the provisional candidate; use an existing company scheduler if its capabilities meet Phase 0. Implement one provider, not both. Keep its integration behind a small adapter so the rest of the site does not depend on provider payloads.

## Scope and decisions

- Preserve the three delivery stages and both illustrative workflows.
- Add a contextual invitation in the green workbench card, available at every stage.
- After an explicit booking click, show real scheduling in the same card. Never reinterpret a sample time as an actual appointment.
- Add one direct booking action in the closing contact section. Keep existing project inquiry and advice consultation paths, which have different promises.
- Let the scheduler collect contact details once. Company and discussion context are optional; a detailed project brief is not required to see availability.
- Store appointments independently of sales lead status, including cancellation and rescheduling history.
- Let the provider own meeting invitations and reminders. The application verifies and records the outcome.
- Reuse existing brand tokens, motion preferences, loader and form patterns.

A fully custom calendar, payment collection, round-robin hosting, an admin dashboard, and an analytics vendor rollout are outside the first release. If the meeting has a fee, resolve payment and cancellation terms before releasing this flow; this plan assumes no payment implementation.

## Intended interface

| State | Visible behavior | Next action |
| --- | --- | --- |
| Exploring | Current example with an invitation below it. Badge: Example. | Book a meeting with Veloce; continue exploring. |
| Starting booking | Same card shows the meeting heading and real duration, format and cost terms. Badge: Meeting with Veloce. | Load scheduling; Back to example. |
| Scheduling | Actual dates, available times and editable timezone. Suggested discussion context can be edited or removed. | Provider booking form; Request a meeting by email. |
| Submitting | Provider pending state; duplicate submission is prevented by the provider. | Wait for provider result. |
| Checking outcome | Provider reports completion; application verifies the booking before asserting its own confirmed result. | Show Checking your meeting… briefly, then result or a recovery state. |
| Confirmed | Meeting date, time, timezone, duration and location; provider management actions. | Add to calendar, reschedule, cancel, return to site. |
| Awaiting approval | Clearly says Meeting requested—awaiting confirmation. | View request details. |
| Scheduling unavailable | Clear error/no suitable time; no confirmed message. | Retry, open the provider booking page, or request a meeting by email. |

Use a single booking instance for the page. Changing delivery tabs updates the left explanation without remounting the active scheduler. Keep booking state outside animated stage content. A return to the example restores example choices; it does not cancel a confirmed appointment. Preserve provider form progress within the page where supported; do not promise draft recovery across reloads.

## Copy specification

Default invitation:

> **Have a workflow like this?**
>
> Meet with Veloce to talk through your business and what a useful first version could look like.
>
> **Book a meeting with Veloce**

After choosing a sample booking time:

> That was a sample booking. Want to talk about a system for your business? Choose a real meeting time with Veloce.

After choosing an improvement:

> Let’s talk about what would help your business first.

Booking heading and introduction:

> **Book a meeting with Veloce**
>
> Talk through your idea, current workflow, or an existing system with our team.

Use equivalent contextual copy for reminders, approvals and escalation choices. Keep the booking button label consistent. Change the demo disclaimer to **These example choices do not create a booking.** Show it only with the example.

Do not describe the meeting as free, promise a proposal, or promise an email response time until those terms are established. The provider's final submission step must clearly name the Veloce meeting; configure its button wording where supported rather than assuming embed labels are customizable.

## Phase 0 — Confirm the provider and meeting contract

Before adding a package or choosing provider-specific API fields, verify the selected account supports:

1. Inline embedding at the available card width, including mobile.
2. Connected host calendars, busy-time checks, meeting location and the required acceptance policy.
3. Booking-created, cancelled and rescheduled events with verifiable authenticity.
4. Server-side booking lookup and a workable reconciliation path.
5. An opaque session reference that survives booking through supported metadata/tracking, including the direct-link fallback.
6. Optional editable discussion context and collection of consent with verifiable submission evidence.
7. Booking, cancellation and rescheduling links suitable for the completion state.

Record the provider, account capability/plan constraints, event type, required embed origins, API version and webhook version. Check current official provider documentation during implementation; the investigation's sources are starting references, not a fixed API contract.

Establish host, duration, working hours, busy calendars, timezone, buffers, minimum notice, booking horizon, video/in-person format, cost and whether this is distinct from the existing advice consultation. A single-host introductory video meeting with automatic acceptance is the recommended initial configuration; these values are not yet approved business facts.

**Exit condition:** a concrete provider/event contract and a fixture matching its current booking lifecycle. If metadata or consent is unsupported, resolve that constraint before selecting the integration. The UI can proceed with an explicitly labelled local fixture while account setup is pending; fixtures must never be exposed as real availability in a release.

## Phase 1 — Define booking storage and validated configuration

Modify `prisma/schema.prisma`, add an additive migration, and regenerate Prisma types.

| Record | Proposed fields and constraints |
| --- | --- |
| BookingSession | Hash of a high-entropy opaque reference, creation/expiry times, validated company/event configuration, entry point, verified referral campaign, bounded UTM attribution, optional example snapshot, consent evidence when collected, eventual appointment link. Create no lead merely because scheduling opens. |
| Appointment | Lead relation, provider, unique `(provider, providerBookingId)`, event type/host, UTC start/end, visitor timezone, normalized status, provider update/version information, previous/replacement appointment relation when applicable, timestamps. |
| BookingEvent | Provider event identity or deterministic delivery dedupe key, appointment identity, processing state, attempts and processed/error timestamps. Retain only bounded fields necessary for verification and recovery. |

Appointment statuses: `REQUESTED`, `CONFIRMED`, `CANCELLED`, `RESCHEDULED`. For providers that mutate one booking on reschedule, keep the appointment confirmed at the new time and retain change history. For providers that replace bookings, link the old rescheduled record to the new confirmed record. Do not force both models into identical webhook ordering assumptions.

Add `MEETING` to `LeadIntent` to distinguish this introductory meeting from project inquiry and advice consultation. Create meeting leads only after an authenticated provider outcome, using a dedicated service. Map the general topic to `ProjectType.OTHER`; use visitor-supplied context or the explicit description “Introductory meeting with Veloce” for required goals. Do not fabricate project requirements or consent to satisfy the current inquiry schema. Review all intent switches and templates after adding the enum; meeting processing must not call inquiry acknowledgments by accident.

Keep `Lead.status` as a sales-stage field. Set `CONSULTATION_SCHEDULED` for an eligible new/contacted meeting lead after confirmation; do not overwrite later sales stages or erase appointment history on cancellation.

Configuration additions in `src/config/env.ts` and `.env.example` should cover enabled state, selected provider, public event URL, allowed event/host, API credentials, webhook secret and reconciliation credentials. Final key names follow the chosen provider. Only the public presentation DTO may cross into client components; never pass the full environment object.

**Exit condition:** existing leads remain intact, disabled scheduling requires no provider credentials, and enabled-but-incomplete configuration produces a readable startup/deployment error. Test migration on a fresh database and an existing seeded database.

## Phase 2 — Implement the server booking boundary

Create a booking-specific schema and services rather than extending `submitInquiry` to reserve meetings.

- A session-start server action validates example context, entry point and public referral token; checks rate limits; stores an expiring opaque reference; and returns public meeting configuration. Bound context lengths and allowed workflow/priority values. Resolve attribution using the existing server campaign service.
- The provider adapter builds an allowlisted embed/direct-link configuration and normalizes booking lookup and lifecycle events. No arbitrary browser-supplied event URL or host is accepted.
- A verification action accepts the session reference and provider booking reference, retrieves the provider record server-side, and checks its event type, host and session correlation. Return a minimal appointment DTO. Treat a browser completion callback as a prompt to verify, not proof of booking.
- A provider webhook route reads the raw request body, verifies the signature using current provider rules, validates the payload, and records the event before processing. Use a transaction to deduplicate appointment/lead updates. Return success for an already processed duplicate; return a retryable error if durable acceptance fails.
- Serialize processing per booking and compare authoritative versions/timestamps where supported. Re-fetch provider state when event order is ambiguous. A late cancellation of an old booking must not cancel its replacement.
- Consent must be captured in the actual provider submission and correlated to the session, or by an explicit Veloce consent interaction before submission if the provider cannot supply evidence. Opening the scheduler is not consent. Adapt the collection point after Phase 0 without duplicating name/email entry.
- Sessions expire for new booking initiation; retain their correlation records long enough to process delayed lifecycle events. Long-lived cancellation/rescheduling sync must not depend on an unexpired visitor session.

Use same-origin browser actions and an opaque cookie/token to authorize session status. Do not expose meeting details through enumerable IDs or infer ownership from an email address. API keys and webhook secrets stay server-only. Protect any provider-link fallback with the same supported opaque tracking mechanism; if it cannot preserve attribution, record that limitation rather than inventing correlation.

Read the installed Next.js client component, Server Action, Route Handler and Script guides before implementation. The current installed Route Handler guide uses `src/app/**/route.ts`, standard request/response APIs and request-time handling. Set private booking status responses to `Cache-Control: no-store` where an HTTP status endpoint is used. Do not add a global cache or loading-boundary refactor.

**Exit condition:** provider-verified outcomes create exactly one correlated lead/appointment, duplicate and out-of-order events are safe, and forged browser callbacks cannot mark a meeting confirmed.

## Phase 3 — Build the meeting panel and contextual invitation

Create a page-level `MeetingProvider`, an `OpenMeetingButton`, a booking panel and a thin provider embed wrapper. Keep the instance mounted outside delivery-stage `AnimatePresence` content; retain a hidden, inert instance when returning to the example only if the provider requires that for preserving drafts. Remove listeners on final unmount and prevent hidden embeds from taking focus.

Integrate with `ApproachWorkbench`:

1. Derive a small context snapshot from workflow, priority and optional improvement. Exclude sample time from actual scheduling parameters.
2. Render the invitation at every stage and strengthen its copy after meaningful input. Never trigger navigation or scheduling automatically.
3. On the explicit booking action, switch the right-hand card to meeting mode, create/reuse its session, and focus the meeting heading.
4. Load the provider only when scheduling opens. Reuse the branded loader with a single status announcement; show the scheduler immediately when ready.
5. Show actual duration, format and cost terms above the embed. Let the provider handle date/time/timezone selection and collect name/email once.
6. Prefill discussion context only through supported fields, labelled as suggested from the example and editable/removable before submission.
7. Verify completion server-side and render confirmed, requested or unavailable outcomes accurately. If synchronization is delayed, show a neutral verification state and the provider's completion information; do not invite duplicate booking.
8. Provide Back to example and a fallback link. Closing/returning must not cancel anything.

Use an inline layout rather than nesting a scheduler popup inside the existing inquiry dialog. Test the existing right-hand card width; if the provider cannot fit it, expand the booking area across the workbench within the same section. Keep the left-side explanation accessible without forcing a cramped embed or horizontal scroll.

Apply provider-specific CSP allowlists to `script-src`, `frame-src`, `connect-src` and other directives only as actually required. Keep `frame-ancestors 'none'`. Inspect the production embed's requests and use current provider guidance to establish the origins; do not solve failures by allowing all domains.

**Exit condition:** booking works from both workflows, either priority and any stage, keyboard focus follows the transition, stage changes do not interrupt scheduling, and the initial page makes no scheduler network request before booking opens.

## Phase 4 — Connect direct booking and a reliable fallback

- Wire the closing contact section's new **Book a meeting with Veloce** action to the same workbench panel. Scroll it into view with motion preferences respected, then focus its heading. There should be one scheduling instance and no demo prerequisite.
- Add a booking entry to site search only if it can route to the same explicit action without changing existing inquiry search behavior.
- Add a dedicated meeting-request mode to the existing form/provider infrastructure, with optional discussion context and clear **Send meeting request** / **Meeting request received** copy. Retain name, email, consent, idempotency and error handling. An email request does not create an appointment.
- When scheduling is disabled, show **Request a meeting** as the available action. Never expose fixture slots or advertise an enabled booking flow.
- Configure a real notification provider for fallback requests. Track send outcomes separately from saved requests and do not claim email delivery on save success.
- Add bounded notification retry/recovery for fallback notifications. The current dedupe row must be retried with an atomic processing claim; calling `dispatch` again unchanged would return `DUPLICATE`. Do not include cancelled or failed booking notices in inquiry acknowledgments.

Provider meeting confirmations, calendar invitations and reminders remain provider-owned. Application emails handle fallback requests and distinct internal messages only.

**Exit condition:** a visitor can book directly or submit a clearly identified meeting request, and both outcomes have correct wording and operational visibility.

## Phase 5 — Recovery, verification and release

Add a bounded reconciliation script/job that processes durably accepted pending events and compares recent provider bookings with appointment records. Include overlap in the lookback window, cursor pagination, retries and deduplication. Define its schedule in deployment documentation and verify it runs; a script that is never scheduled is not recovery. Respect provider rate limits and retain failures for operator review without exposing addresses, notes or credentials in logs.

Provide a database query or small protected operator script to inspect failed booking sync and fallback notifications. A public admin route is unnecessary for this release.

| Verification | Required evidence |
| --- | --- |
| Invitation and transition | Real booking named before scheduling; sample choice does not start booking; direct action works; example choices survive return. |
| Calendar result | Provider-controlled availability, correct host/timezone/location, and real calendar event for an accepted appointment. |
| Conflict and failure | Slot taken during booking, no availability, network failure, provider rejection and approval-required request produce accurate recoverable states. |
| Trust and attribution | Invalid signatures, forged completion, mismatched event/host/session and forged referral token cannot create confirmed appointments or verified attribution. |
| Lifecycle and retries | Duplicate submission/events, webhook-before-callback, delayed/out-of-order events, cancellation and rescheduling yield one consistent appointment history. |
| Recovery | A missed/failed webhook is repaired by the scheduled reconciliation path; fallback notification retry does not send duplicate successful messages. |
| Consent and contact details | Consent evidence comes from explicit submission; one contact form; suggested context can be edited/removed. |
| Accessibility and layout | Keyboard, announcements, focus restoration, reduced motion, both themes, narrow mobile and tablet; inspect iframe accessibility separately. |
| Regression | Existing inquiry, advice consultation, referral attribution, referral 404/noindex, loaders and service exploration remain functional. |
| Loading cost | Provider script lazy-loads once; returning and switching tabs do not create extra embeds or listeners. |

Extend Playwright with provider fixtures for repeatable local tests; use a separate test event/account for the real provider acceptance check. Do not submit synthetic appointments to the live sales calendar during automated testing. Validate the actual provider embed manually because mocked iframe tests cannot prove calendar integration or third-party accessibility.

Update the existing service inquiry test to expect **Ask about Internal business systems**; the investigation found its stale generic title assertion failing on mobile and desktop. First record the current repository baseline so unrelated failures are distinguished from new failures.

Run typecheck, lint, unit/integration tests, a production build, and the relevant existing and new Playwright flows at mobile/tablet/desktop. Inspect production CSP behavior and check Chromium plus WebKit; document any untested browser or external capability.

Measure booking-open entry points and confirmed appointments separately. A small persisted funnel record or existing analytics integration is enough initially; do not add a vendor solely for this release. Count confirmation from server/provider evidence, record cancellation separately, and exclude names, emails and discussion context from analytics. With no existing baseline, report observations rather than an uplift claim.

Release only after real host/calendar configuration, production secrets, authenticated webhook delivery, reconciliation scheduling, calendar invitations and fallback delivery have been verified. Before launch, document disable/rollback behavior: disable new booking initiation, keep lifecycle ingestion active for existing appointments, and expose the meeting-request fallback. Use additive migrations; do not roll back by deleting booked records.

**Exit condition:** all applicable checks pass, an authorized test appointment completes the full calendar lifecycle, existing records remain safe, and recovery/fallback paths are operational.

## Planned file map

Names below are proposed; adjust to the selected provider without expanding scope.

| Area | Files |
| --- | --- |
| Workbench and copy | Modify `src/components/marketing/approach-workbench.tsx`, `veloce-bento.module.css`, `src/content/site.ts`. |
| Shared meeting interface | Create `src/components/booking/meeting-provider.tsx`, `meeting-panel.tsx`, `scheduler-embed.tsx`, `meeting-result.tsx`. |
| Page/direct entry | Modify `src/app/page.tsx`; optionally `src/lib/search.ts` and `src/components/site/search-palette.tsx`. |
| Schemas/actions | Create `src/schemas/meeting.ts`, `src/server/actions/meetings.ts`. |
| Provider/domain services | Create `src/server/booking/provider.ts`, one provider implementation, `sessions.ts`, `appointments.ts`, `events.ts`, `reconcile.ts`. |
| Provider events | Create `src/app/api/booking/webhook/route.ts`; session status can remain a Server Action unless polling requires a private HTTP route. |
| Persistence/config | Modify `prisma/schema.prisma`, `src/config/env.ts`, `.env.example`, `next.config.ts`; add migration. |
| Request fallback | Modify `src/components/forms/inquiry.tsx`, inquiry schema/service as needed, notification templates/dispatch; add an atomic retry service. |
| Operations | Add `scripts/reconcile-bookings.ts` and notification recovery entry point; document scheduled execution in `docs/DEPLOYMENT.md`. |
| Verification/docs | Add focused booking unit/integration tests and `tests/e2e/meeting-booking.spec.ts`; update relevant existing assertions and investigation/release documentation. |

## Delivery order and external dependencies

1. Confirm the integration contract and meeting policy (Phase 0).
2. Add configuration, storage and the server boundary (Phases 1–2).
3. Build the invitation and shared panel against provider fixtures, then integrate the selected embed (Phase 3).
4. Connect direct entry and the meeting-request fallback (Phase 4).
5. Complete recovery, production checks and the real calendar acceptance test (Phase 5).

Provider/account access and approved host, duration, availability, location and cost terms are needed for live integration. Local schema, services, UI and fixture-based verification can proceed once the provisional contract is explicit. Do not substitute fabricated availability or a saved inquiry for a functioning appointment.

Completion means the visitor can intentionally reserve a real Veloce meeting, the host receives a calendar event, the application stores the verified lifecycle and attribution, and unavailable scheduling still offers a working meeting-request path.

## As built

- Added the workbench invitation, shared inline meeting panel, direct closing-section action, preserved example choices and separate meeting-request fallback.
- Integrated the hosted Cal.com React embed lazily, with explicit consent/context, actual configured meeting terms, server-verified results and a direct-link recovery path.
- Added meeting sessions, appointment lifecycle, durable webhook event records and reconciliation cursors through additive local migrations. Confirmed and approval-required results remain distinct.
- Added authenticated webhooks, private session status verification, referral validation, transaction deduplication, stale-event handling and linked rescheduling.
- Added a protected maintenance endpoint and script, bounded event/calendar reconciliation and atomic notification retry leases. Hosted scheduling of the job remains a deployment requirement.
- Used dedicated booking components rather than adding a third intent to the existing inquiry dialog. Both paths reuse existing fields, validation/security infrastructure and notification templates. Optional site-search expansion was deferred.
- Setup, provider API versions, operational limits and activation requirements are documented in [MEETING_BOOKING.md](./MEETING_BOOKING.md). No real provider account, live calendar booking, hosted cron or email delivery has been verified.

Verification: production build and typecheck pass; all 140 unit/integration tests pass; 24 production workbench/meeting checks, 15 enabled calendar fixture checks and 16 existing desktop inquiry/consultation/security/accessibility checks pass. State-specific skips are expected across disabled/enabled configurations. Mobile WebKit enabled booking and the final local request panel were also checked. Fresh-database migration and existing local migration both pass. Changed booking files pass ESLint; repository lint retains the pre-existing `react-hooks/set-state-in-effect` error at `src/components/site/notch-header.tsx:144`. The development server was restarted on port 3000, and meeting-request persistence passes there.
