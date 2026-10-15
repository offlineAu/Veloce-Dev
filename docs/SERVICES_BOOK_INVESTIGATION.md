# “Explore every service” as an interactive book

Investigation date: 2026-10-15. Scope: source review and implementation proposal; no component installation or application changes.

Implementation follow-up: the approved book is now implemented in `src/components/marketing/services-book.tsx` with a dedicated CSS module and integrated into `#all-services`. It uses a custom animation shell inspired by the supplied interaction, the existing service data and inquiry flow, a mobile contents selector, reduced-motion presentation, a no-JavaScript list, and the original explorer as list mode. The sections below preserve the original investigation and proposal.

Interaction follow-up: at the user's request, the entire cover now opens the book. Full-page buttons turn the left page backward and the right page forward, with disabled boundary states. The cover uses a full-size native button, and explicit page stacking keeps decorative layers out of click handling. Surface hit-target checks and consecutive clicks during the slower flips are covered by browser tests. Inquiry buttons and service links remain independent targets above the page buttons; keyboard navigation and the external controls remain available.

Implementation validation: typecheck and scoped ESLint pass. All twelve Playwright cases pass across Chromium mobile, tablet, and desktop, covering navigation, direct selection, inquiry isolation, focus restoration, list mode, reduced motion, container bounds, closed/open accessibility scans, and the no-JavaScript fallback. Desktop and phone screenshots were reviewed; a WebKit open/select smoke check passed. Firefox is not installed. The normal production build fails loading the existing Cal URL environment configuration. With command-local approved Cal endpoints, compilation and TypeScript pass, but prerendering is blocked by invalid existing values for `NEXT_PUBLIC_SITE_URL`, `HASH_SECRET`, `COMPANY_CONTACT_EMAIL`, `NOTIFY_REFERRER`, and `BOOKING_ENABLED`. Environment files were not changed.

## Recommendation

Use the supplied VengeanceUI book as a visual starting point for a Veloce services catalogue. Keep the opening cover and page-turn effect, with a contents list for direct access. Show one service per spread on wide screens and a single service page on narrow screens. Offer a plain “View all services” mode using the existing explorer.

This is feasible with the installed dependencies. It needs adaptation before use: the supplied demo conflicts with the app’s strict animation provider, assumes fixed dimensions, and lacks the navigation and focus handling required for service links and inquiry buttons.

## Current integration points

| Piece | Current location | Implication |
| --- | --- | --- |
| Target section | `src/app/page.tsx`, section `#all-services` | Replace the `ServicesExplorer` presentation here; preserve the anchor, heading ID, and campaign token. |
| Existing explorer | `src/components/marketing/services-explorer.tsx` | Already supports categories, unknown service slugs, detail expansion, service links, and inquiry actions. Retain as the list mode. |
| Service source | `src/server/services/services.ts` | Active database services ordered by `displayOrder`; nine content defaults when the database returns no active services or is unavailable. Do not hardcode nine pages. |
| Content and categories | `src/content/site.ts` | Reuse `ServiceItem` and `servicePaths`: “Reach your customers,” “Run the day-to-day,” and “Improve what exists.” |
| Service links | `src/content/seo.ts` | Use `servicePageHref(slug, refToken)`. Only three current services have dedicated destinations; render the link conditionally. |
| Inquiry flow | `OpenInquiryButton` inside the existing `InquiryProvider` | Pass the selected service’s slug and title; preserve referral context. |
| Animation provider | `src/components/providers.tsx` | Uses strict `LazyMotion` with `domAnimation` loaded asynchronously. |
| Motion settings | `src/lib/use-reduced-motion.ts` | Resolves device preference, visitor override, and automatic low-power mode. |
| Installation aliases | `components.json` | UI components resolve to `src/components/ui`; `cn` already exists. |

The upper “Tailored services” area currently chooses between samples and the services carousel. The book belongs in the separate `#all-services` section; replacing that upper area would be a different change.

## Proposed experience

1. A branded cover reads “Explore every service,” with the Veloce mark and a clearly visible “Open service book” button. Use existing theme tokens and typography, with a custom cover treatment rather than the demo’s tiny title and author line.
2. Opening reveals the first service. On wide screens, the left leaf holds its category, benefit, and a restrained illustration; the right leaf holds its title, existing description, optional detail-page link, and “Ask about this” button. No new marketing claims are necessary.
3. A contents list outside the turning pages exposes every service title, grouped by the existing directions. Selecting a title jumps directly to its spread. Unknown slugs appear under “Other services”; empty groups disappear.
4. Persistent Previous/Next controls, a service-position indicator, and Close sit outside the animated stack. The last spread offers a conversation action and restart. Do not require visitors to turn through every preceding service.
5. On narrow screens, keep the cover but use one readable page with the same controls and a compact contents selector. Choose the two-page breakpoint from available container width, not the device name.
6. A visible “View all services” control switches to the existing explorer. Without JavaScript, render a readable service list with links. Reduced-motion mode should start with the readable static layout and retain all navigation.

## Required changes to the supplied component

| Issue found in the supplied code | Adaptation |
| --- | --- |
| `motion.*` under strict `LazyMotion` | Use the project’s `m.*` pattern. The existing animation feature bundle covers rotate/translate animation and hover; drag would require a separate decision. |
| Default outer width is `350 * 3.5 = 1,225px`; open spread itself is 700px | Size from the container, allow room for controls, and explicitly select single-page mode when two readable leaves do not fit. |
| String width still uses a 350px fallback for the opening translation | Use shared measured geometry or consistent CSS sizing for both leaf width and centering. |
| Pages are fixed-height, absolutely stacked; back content clips overflow | Design content-aware page sizing. Check long database titles/descriptions and zoom; provide scrolling within a page only if needed. |
| Clicking an entire page turns it | Use explicit navigation controls. Service links and inquiry buttons must operate without changing pages. |
| Opening and the hint use clickable `div`s; Close has no accessible name | Use native buttons with labels, focus styles, and appropriate expanded state. Use an `h3` for the cover title beneath the section heading. |
| Hidden/rotated faces stay mounted | Make inactive content inert and exclude it from the accessibility tree. Backface visibility alone does not prevent keyboard focus or screen-reader access. |
| Global arrow handlers run whenever the book is open | Scope keyboard handling to the book, ignore editable controls, and allow the inquiry dialog to own its keyboard interactions while open. |
| Motion settings can suppress transforms | Explicitly render the selected page in static mode. Do not rely on rotations to hide inactive pages when reduced motion is enabled. |
| Hardcoded paper/neutral colors, serif type, `dark:` overrides, and `prose` classes | Use Veloce tokens and explicit text styles. This app does not declare the Tailwind Typography plugin. Use supported 3D utilities or explicit CSS; do not assume `preserve-3d` is a generated class. |
| Index keys and state assume a stable page collection | Key services by slug, define cover/service/end states, and clamp selection when the service collection changes. Verify zero/one/many-service cases. |
| Unused icons and slider handler remain after controls were removed | Remove dead code and restore deliberate, labelled controls. |

Focus should remain on the navigation control after a page turn, with a polite announcement of the current service. Before hiding content that contains focus, move focus to a persistent control. Closing or switching modes must restore focus to a visible control. This can remain an inline section; a modal and focus trap are unnecessary.

## Suggested implementation structure

- `src/components/ui/interactive-book.tsx`: adapted animation shell, cover, controlled selection, responsive geometry, and persistent controls.
- `src/components/marketing/services-book.tsx`: maps `ServiceItem[]` to service spreads, contents, inquiry buttons, and list mode. Reuses `useReducedMotion`.
- A CSS module for book geometry, paper/spine effects, theme tokens, and single-page presentation.
- `src/app/page.tsx`: passes the existing server-fetched `services` and validated campaign token to the wrapper. No service API or database migration is needed.
- Keep `services-explorer.tsx` for the full-list experience and non-JavaScript fallback. Avoid rendering two simultaneously focusable copies of the same services.

Construct service React content inside the client wrapper and pass serializable service data from the server page. The installed Next.js `use-client` guide was reviewed for this boundary.

The requested shadcn command can scaffold the upstream file, but running it is unnecessary for the investigation. Both `framer-motion` and `lucide-react` are already in `package.json`. If vendoring the upstream implementation, preserve its MIT notice.

## Verification before shipping

- Run typecheck and lint on the implementation; verify no strict `LazyMotion` error in the browser.
- Exercise open, next, previous, direct selection, close, restart, and rapid navigation, including the first and final pages. Verify page stacking in Chromium, Firefox, and WebKit; 3D layering is a browser-validation item, not established by this source review.
- Test keyboard-only operation and an accessibility scan with the book closed, open, and the inquiry dialog open. Hidden pages must contain no reachable tab stops. Clicking an inquiry or service link must not turn a page.
- Check a narrow phone viewport, tablet, desktop, 200% zoom, long service content, odd service counts, and custom database slugs. Inspect actual book bounds because the page globally clips horizontal overflow and can conceal an oversized book.
- Verify device reduced motion, visitor “Reduce animations,” “Always play,” and low-power behavior. Confirm content remains readable when motion is disabled or JavaScript is unavailable.
- Preserve referral query parameters on detail links and inquiry attribution. Confirm every active service remains reachable.
- Update existing homepage Playwright assertions that currently expect “Business websites” to be visible immediately inside `[data-services-explorer]`. Keep the server-HTML content assertion and reduced-motion readability coverage; add meaningful tests for the new navigation and inquiry behavior.

No runtime, visual, or performance measurements were made in this investigation. A prototype should establish page-turn quality and the final responsive breakpoint before polishing all service spreads.

## Sources

- [Requested VengeanceUI registry component](https://raw.githubusercontent.com/Ashutoshx7/VengeanceUI/main/public/r/interactive-book.json), checked against the supplied code.
- [Motion LazyMotion documentation](https://motion.dev/docs/react-lazy-motion), confirming strict mode rejects full `motion` components.
- [Upstream MIT notice](https://raw.githubusercontent.com/Ashutoshx7/VengeanceUI/main/LICENSE).
- Installed Next.js guide: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`.

Visual follow-up: the cover now has a local SVG grain texture and an inset border. Page turns use a two-sided sheet with the outgoing service on the front, incoming artwork on the reverse, perspective, and a moving shadow. Both faces remain opaque through the 1.3-second turn so 3D back-face rendering stays correct. A curled corner and a short turn hint emphasize the interaction. All decorative layers ignore pointer events, and reduced-motion mode remains static.

Depth follow-up: added layered paper edges and a visible binding, a stronger shaded gutter, directional lighting on the textured cover, an embossed logo treatment, and deeper contact shadows. Separate non-interactive shading layers animate on each turning face and cast a moving shadow onto the spread; the 3D sheet itself stays opaque to preserve correct back-face rendering.
