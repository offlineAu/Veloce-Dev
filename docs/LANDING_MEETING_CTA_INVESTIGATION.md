# Landing page meeting CTA investigation

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
