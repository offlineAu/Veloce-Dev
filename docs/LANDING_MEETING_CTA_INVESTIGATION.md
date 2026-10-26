# Landing page meeting CTA investigation

## Implementation — 2026-10-25

Implemented the recommendation below. All primary landing CTAs now use **Book a Meeting** when scheduling is enabled and **Request a Meeting** when disabled, opening the existing shared panel. The contact card has one primary meeting action and a secondary consultation action. The floating action uses a calendar icon and meeting/search accessibility labels. Menu dismissal, heading focus, direct-entry return focus, workbench return behavior, and retained calendar/session state are covered by browser checks. Provider configuration and environment files were not changed.

Validation completed:

- Production build, TypeScript check, scoped ESLint, and diff whitespace checks passed.
- Seven booking configuration/endpoint unit tests passed.
- The meeting suite passed its applicable checks on mobile, tablet, and desktop against the existing local development configuration (12 passed; nine configuration-specific checks skipped).
- The disabled-booking production test server passed 15 checks across those three viewports, including request persistence and referral attribution; six enabled-scheduler fixture checks were skipped by design.
- Mocked production scheduler checks passed on mobile and desktop for confirmed and pending-approval bookings, one preserved calendar, verified referral attribution, and the `contact` session entry point. No real provider appointment or external email was created by these checks.
- Affected inquiry, consultation, accessibility, loader, floating action, and search checks passed across all three viewports. The search test was corrected to select the complete meeting label before keyboard activation.
- An additional 320px browser check confirmed heading focus, a visible floating booking button, and zero horizontal page overflow.

Temporary production servers used test-only configuration overrides and were stopped after testing. Hosted Cal.com account/calendar activation and deployed environment readiness remain separate from this application change. The following sections preserve the investigation record.

## Current review — 2026-10-25

Rechecked the current source and local environment configuration for the requested **Book a Meeting** landing-page action. This section supersedes the earlier review where wording or verification differs. Application code and environment settings were not changed.

**Recommendation:** use **Book a Meeting** for enabled landing-page primary actions and **Request a Meeting** when scheduling is disabled. Wire these actions to the existing `OpenMeetingButton` with `entryPoint="contact"`. A text-only replacement would still open the inquiry form. The existing provider, booking panel, Cal embed, session creation, server verification, webhook handling, and referral attribution can be reused without a new dependency, API, or database migration for this scope.

The proposed visitor path is:

1. Click **Book a Meeting** from the hero, header menu, referral offer, contact card, floating action, or site search.
2. Open and focus the existing meeting panel in the approach section; trying the example is optional.
3. Review meeting terms, optionally enter discussion context, and consent to loading Cal.com.
4. Choose a real time in the embedded calendar and enter contact details there.
5. Show the booking result after server verification. Keep the existing direct booking-page link and email-request fallback available.

The first click currently opens the Veloce booking panel, rather than immediately opening an external Cal.com tab or popup. Reusing this flow preserves its consent, attribution, and booking-record behavior. If a popup is preferred later, use the same panel/session flow inside a suitable dialog and validate its mobile layout and keyboard behavior; that is a larger UI change than promoting the existing panel.

### Connection status observed in this checkout

Read the installed Next.js environment-variable guide and resolved development and production configuration independently with `@next/env`. Reported only flags, URL classification, and required-value presence; credential values are omitted.

| Environment | Observed configuration | What this establishes |
| --- | --- | --- |
| Development | Booking enabled; local mode enabled; event points to the local Cal instance on port 3002; required booking values are populated. | The checkout is configured for local scheduling. Availability and provider connectivity were not exercised in this review. |
| Production file resolution in this checkout | Booking disabled; local mode disabled; booking URL is invalid or a placeholder. Other required booking variables are populated, which does not establish their validity. | These files do not establish a usable hosted Cal.com connection. Actual deployed environment settings and account/calendar readiness remain unverified. |

No server answered at `http://localhost:3000` during this review, so no new browser interaction, consent submission, external booking, or calendar delivery was tested. Browser results below belong to the earlier 2026-10-16 review and should not be treated as newly reproduced.

### Concrete implementation scope

- In `src/app/page.tsx`, resolve `publicMeetingConfig()` once, derive the short enabled/disabled CTA label, and use it for the header menu, hero, active offer, floating button, its accessible name, and search entry. Replace their `OpenInquiryButton` actions with `OpenMeetingButton` and retain existing styling and CTA data markers.
- In the contact card, promote its existing meeting action to the primary dark button and remove the old conversation button to avoid two equivalent booking actions. Retain the consultation action and `InquiryProvider`, which other landing-page features still require.
- In `meeting-provider.tsx` and `meeting-panel.tsx`, make return behavior appropriate for direct entry. The current return button always says **Back to example** and always focuses the workbench invitation. Remember a usable opener, provide a visible fallback for dismissed menu/search controls, and preserve an existing calendar session.
- In `conversation-fab.tsx`, allow landing-specific meeting/search accessible wording while retaining existing behavior on other pages. Use a calendar icon for the landing booking action.
- Update the affected site/navigation/meeting browser tests for the new labels and destinations. Cover all entry points, one panel/one calendar, no demo prerequisite, no Cal request before consent, menu/search focus, repeat opens, referral attribution, disabled scheduling, and mobile layout.

The longer workbench invitation and panel title can remain **Book a meeting with Veloce**. About and service-page inquiry actions remain outside this landing-page scope.

**Verification in this review:** `npm test -- tests/unit/meeting-config.test.ts tests/unit/cal-endpoints.test.ts` passed: two files, seven tests. No full suite, build, or new browser tests were run for this documentation-only investigation.

Reviewed the official [Cal embed event documentation](https://cal.com/help/embedding/embed-events) and [booking form prefilling documentation](https://cal.com/help/embedding/prefill-booking-form-embed). They document the existing `bookingSuccessfulV2` event and metadata-prefilling approach. The event alone does not guarantee confirmation, so retain server verification. Hosted launch checks remain in [Meeting booking setup and operation](MEETING_BOOKING.md).

## Earlier review — 2026-10-16

Investigated 2026-10-16 against the current working tree and the running site at `http://localhost:3000`. Scope: replacing the landing page's **Start a conversation** action with **Book a meeting with Veloce**. Application code was not changed; existing uncommitted work was preserved.

## Recommendation

Promote the existing meeting flow to the landing page's primary action. Replace the inquiry buttons with `OpenMeetingButton`, using **Book a meeting with Veloce** when scheduling is enabled and **Request a meeting with Veloce** when it is disabled. Reuse the single meeting panel already hosted in the approach workbench. No new scheduler, booking endpoint, or database migration is needed for this scoped replacement.

Changing text alone would leave visitors opening the project inquiry dialog rather than arranging a meeting. The label and destination must change together.

## Current behavior and affected surfaces

`src/app/page.tsx` already wraps the page in both `InquiryProvider` and `MeetingProvider`. The meeting provider receives public booking configuration, the verified campaign token, and the company contact email.

| Surface | Current behavior | Proposed behavior |
| --- | --- | --- |
| Header menu CTA | `OpenInquiryButton`, Start a conversation | Open the shared meeting panel after the menu closes. |
| Hero CTA | `OpenInquiryButton` with `data-hero-cta` and arrow | Meeting button; retain the hero marker, styling, and arrow. |
| Active referral offer | `OpenInquiryButton` inside `OfferSplit` | Meeting button; preserve campaign attribution through the provider. |
| Closing contact card | Conversation, consultation, and meeting buttons | Promote the existing meeting action to the primary dark button and remove the redundant conversation action. Retain consultation as a separate secondary action. |
| Floating action | Inquiry button with `data-primary-cta`, chat icon, and explicit accessible label | Meeting button with a calendar icon; preserve the primary marker and update both visible and accessible labels. |
| Search contact entry | Label supplied as Start a conversation; selection programmatically clicks `[data-primary-cta]` | Use the same configuration-aware meeting label; selection must open the meeting panel. |
| Workbench invitation | Already opens the meeting panel with example context | Preserve its contextual behavior. |

The closing contact section already has an `OpenMeetingButton` with `entryPoint="contact"`. Replacing its conversation button without consolidating the existing meeting button would create two equivalent meeting actions.

About, service pages, service-specific inquiries, builder submissions, and referral introductions are outside this landing-page change. Keep `InquiryProvider`: the landing page's service book and builder guide still use inquiry actions.

## Implementation details to resolve

1. **Keep labels consistent.** Resolve `publicMeetingConfig()` once in the server page and derive the search label from the same `enabled` flag. `OpenMeetingButton` already supplies the correct default text, but explicit children and `aria-label` override it. Buttons containing icons need a shared label passed explicitly, or a small configuration-aware client wrapper. The floating label's `aria-hidden` makes updating its `aria-label` essential.
2. **Use the existing entry-point contract deliberately.** Meeting context, request validation, and provider state currently support only `workbench` and `contact`. Use `contact` for the new general landing CTAs; retain `workbench` for the example invitation. Separate hero/menu/search/offer attribution would require an explicit extension of the schema and related tests. It is not needed to make the replacement function.
3. **Preserve the shared session.** The workbench dynamically mounts the meeting panel once a meeting has been requested and keeps it mounted afterward. Repeated opens preserve existing discussion context and scheduling state. General CTAs should not invent example context or clear an active session. Confirm the consent-screen helper text makes sense when the visitor has not used the example.
4. **Coordinate menu dismissal and focus.** The header menu closes from its CTA container's click handler. The meeting provider independently scrolls and focuses in an animation frame. Verify that sheet close focus restoration does not take focus back from the meeting heading. Search already waits until its dialog closes before activating the primary CTA; preserve that sequencing.
5. **Make return behavior fit direct entry.** `MeetingProvider.back()` currently always focuses `[data-workbench-meeting]`, and the panel always says Back to example. Recommended follow-up: remember the actual opener for general CTAs and use a return label such as Return to page, while retaining Back to example for workbench entry. Account for menu/search openers disappearing on close and the FAB becoming inert near the hero/contact card; use a visible fallback. Preserve the active calendar when hiding the panel.
6. **Update the floating launcher's wording.** `ConversationFab` currently announces Open/Close chat and search. Make this configurable for the landing page, e.g. Open/Close meeting and search, so shared referral-page usage keeps its existing meaning. Its decorative ripple currently describes an inquiry opening; assess whether it remains appropriate for scrolling to the meeting panel.
7. **Check the longer text.** The floating label uses `whitespace-nowrap`; its container is capped at 18rem. Check the exact new button at 320px and 390px, and the hero, menu, offer, and contact variants. Existing booking-button checks do not prove the proposed floating layout fits.

## Configuration and launch boundary

The local running page currently displays **Book a meeting with Veloce**, and its response CSP includes a localhost scheduler origin. This establishes local scheduling UI configuration, not production readiness or successful external booking.

`src/server/booking/config.ts` switches to the request flow when booking is disabled and rejects enabled configuration without the required event/host, credentials, duration, format, cost terms, and maintenance secret. Preserve that behavior. The existing meeting panel requests consent before loading the calendar, supports email requests, and verifies booking results on the server.

Production account/calendar activation and external delivery acceptance remain separate checks described in [Meeting booking setup and operation](MEETING_BOOKING.md). No provider account, environment configuration, appointment, email, or production deployment was changed during this investigation.

## Verification performed

Read the landing composition, inquiry and meeting providers, meeting panel, workbench, floating launcher/styles, header menu, search builder/palette, meeting schema/configuration, analytics event schema, booking documentation, and existing navigation/booking tests. Reviewed the installed Next.js server/client component and lazy-loading guides for the existing component boundaries.

Ad hoc read-only Playwright Chromium checks exercised the existing closing contact meeting action with reduced motion:

| Viewport width | Meeting panel opened | Heading focused | Panel instances | Horizontal page overflow |
| --- | --- | --- | --- | --- |
| 390px | Yes | Yes | 1 | No |
| 820px | Yes | Yes | 1 | No |
| 1440px | Yes | Yes | 1 | No |

The phone check observed zero iframes before consent. An initial tablet attempt timed out waiting for the panel; a fresh check that waited for network idle and scrolled before clicking passed. Treat this as a timing concern to cover in implementation testing, not evidence that rapid entry is reliable. No form was submitted and no calendar was loaded. These checks validate the existing direct meeting path, not the proposed replacement. No full suite, production build, Firefox, or WebKit check was run.

## Acceptance checks for implementation

- Hero, menu, active offer, contact, floating action, and search all open the same meeting panel without completing the example or opening the inquiry dialog.
- Enabled and disabled configurations show matching visible labels, accessible labels, search text, and panel headings. Keep the consultation and service inquiry paths working.
- The contact card contains one primary meeting action. Preserve `data-hero-cta`, `data-contact-cta`, and `data-primary-cta` behavior.
- Menu/search close before heading focus settles; keyboard activation, return focus, repeated opening, reduced motion, and preserved session state work.
- Check 320px/390px phones, tablet, and desktop for label overflow, focus visibility, and landing below the fixed header, with normal and reduced motion.
- Preserve referral attribution and existing server verification/consent. Opening a CTA alone creates no appointment or booking session.
- Update `tests/e2e/site.spec.ts`, which explicitly expects the old search label, inquiry dialog, FAB accessible name, and inquiry result. Extend `meeting-booking.spec.ts` and navigation tests for the promoted entry points, duplicate removal, and direct-entry return behavior. Use mocked scheduler responses for automated booking checks.
- Run typecheck, scoped lint, and the affected browser tests. Separately perform the existing production booking acceptance before claiming real scheduling readiness.
