# Navigation and content alignment investigation

Investigated 2026-10-15 against the current working tree and the running site at `http://localhost:3000`. Scope: main-site section navigation, browser Back, search, approach tabs, and service-book navigation. Application code was not changed. Existing uncommitted work was preserved.

## Implementation follow-up

The fixes below are now implemented; the original findings remain as the investigation record.

- Added the Next.js 16 smooth-scroll attribute and shared CSS header/scroll-offset variables.
- Header and dock use client transitions for internal routes while retaining native hash links. Their section highlighting uses the actual scroll-padding offset, updates after content resizing, and clears outside linked sections.
- Search uses Radix's close lifecycle and an animation frame instead of a 50ms timer. Section navigation pushes history, retains query parameters, and avoids duplicate entries for the current destination. Dismissing search restores focus without scrolling.
- Approach delivery and example panels share grid cells to reserve the tallest stage at the current width. Inactive panels are invisible, inert, and excluded from the accessibility tree. One shared meeting invitation remains outside the stacked delivery panels. Programmatic focus changes no longer initiate incidental scrolling.
- Book focus changes preserve scroll position. Book/list mode switching preserves a visible toolbar and brings it below the header only if it falls outside the usable viewport.

`tests/e2e/navigation-alignment.spec.ts` covers section offsets, query/history preservation, Back/Forward, highlighting over unlinked content, panel geometry and resizing, active-panel accessibility, book/list toolbar position, desktop client navigation with off-anchor viewport restoration, and meeting-return focus. Both full and reduced motion are covered across Chromium phone, tablet, and desktop viewports; the desktop-only route check is explicitly skipped on smaller viewports.

Validation: the final navigation suite passed 22 cases with the two intentional viewport skips. Typecheck and scoped ESLint passed. Existing navigation/search, approach interaction, service-book navigation/centering, and accessibility checks passed across their applicable Chromium viewports. An artifact-directory collision and a development reload interrupted two earlier checks; both affected checks passed when rerun in isolation. A WebKit phone smoke check confirmed equal approach-panel heights across all three stages. No production build or Firefox validation was performed.

## Findings

| Priority | Finding | Evidence and implication |
| --- | --- | --- |
| High | Search discards the current navigation stop. | `src/components/site/search-palette.tsx:45` calls `history.replaceState`. Reproduced: approach → services → search for Booking systems → capabilities → Back returns to approach, skipping services. Search should create a history entry when it changes the destination. |
| High | Approach switches change content height on smaller screens. | Chromium measurements below show a roughly 99px range on phone and 73px on tablet. Content below the workbench moves even though the viewport scroll position stays fixed. `ApproachWorkbench` replaces active tab content; `.prototypeBody` reserves only a minimum height and the complete workbench has no shared height across stages. |
| Medium | Global smooth scrolling lacks the Next.js 16 opt-in for route scroll management. | `src/app/globals.css:105` sets smooth scrolling; the root `html` in `src/app/layout.tsx` lacks `data-scroll-behavior="smooth"`. The installed version-16 upgrade guide and `disable-smooth-scroll.js` explicitly require this attribute for Next to temporarily disable smooth scrolling on route transitions. This is a confirmed configuration gap, although the tested ordinary route/Back flow settled correctly. |
| Medium | Internal navigation follows different paths. | `NotchHeader` and `QuickDock` use native anchors, including internal routes. Search uses `location.assign` for non-hash destinations, while service detail links use Next `Link`. Internal route anchors bypass Next client transitions and prefetching. Standardizing route links would reduce unnecessary document loads. |
| Follow-up | Scroll highlighting uses a different reference point from anchor alignment. | `useActiveSection` observes a band 30–45% down the viewport and chooses by intersection ratio; anchors land 80px below the top. Different section lengths and gaps can therefore affect the highlight independently of the landing offset. No incorrect settled highlight was reproduced in the desktop anchor sequence. |
| Follow-up | Focus and scrolling have several owners. | Search waits a fixed 50ms for dialog teardown; the meeting provider and lazily mounted meeting panel both initiate scrolling; approach stage navigation calls `focus()` without `preventScroll`. These are potential timing conflicts requiring focused reproduction before changes. |

## Browser measurements

Ad hoc Playwright checks used Chromium at viewport widths 390, 820, and 1440, each 900px high, against the existing running server. The first-visit loader was marked seen in browser session storage. These are settled-position checks, not a frame-rate or performance benchmark.

- Desktop header destinations Services, Our approach, Capabilities, and Offer landed between 79.86px and 80.36px from the viewport top, matching the existing `5rem` scroll padding. Back from Offer restored Capabilities at 80.36px.
- A native header navigation to About landed at scroll position zero. Back restored the homepage Capabilities position and highlight in that sequence.
- The tested phone mobile-sheet link to Our approach landed at 80.38px after closing. The tablet header link landed at 79.84px.
- Search changed Services to Capabilities without increasing history length (4 before and after). Back then returned to Approach.
- Service-book Next preserved the stage's vertical position exactly in the tested phone and tablet turn. The current book already reserves the tallest service using inert sizing copies. Preserve that behavior.

Approach section heights after each stage settled:

| Viewport width | Think | Build | Make it work | Range |
| --- | ---: | ---: | ---: | ---: |
| 390px | 3587.73px | 3598.89px | 3687.14px | 99.41px |
| 820px | 2708.45px | 2670.98px | 2744.42px | 73.44px |
| 1440px | 1969.50px | 1969.50px | 1969.50px | 0px |

The page scroll position stayed unchanged during these stage switches. The height differences moved the following Capabilities section by the corresponding amount. Service book/list switching also replaces different layouts without an explicit content-alignment policy; it needs its own acceptance criteria rather than assuming every switch should scroll.

## Recommended implementation sequence

1. Add the Next.js 16 root scroll attribute. Keep smooth section jumps and reduced-motion overrides; let route navigation and history restoration use framework behavior.
2. Define one navigation contract: section jumps land below the fixed header; new route navigation uses Next `Link`/router behavior; Back/Forward restores the user's previous viewport rather than always scrolling to the section top. Use a shared header-offset CSS variable so these rules cannot drift.
3. Make search jumps add a history entry when the destination changes, preserve the current URL query parameters, and use Next navigation for internal routes. Coordinate focus/scroll with dialog teardown rather than a fixed delay. Do not force a global scroll-to-top effect on every URL change.
4. Stabilize switchable content geometry at each available width. Use shared sizing or measured content heights for approach panels and their animated examples, similar to the existing book sizing pattern. Account for font loading, responsive text wrapping, and long content. Keep the selected control in place; use `focus({ preventScroll: true })` where focus restoration should not move the viewport.
5. Define book/list mode switching explicitly: preserve the persistent toolbar and align the new content start when necessary, especially on phone. Keep ordinary service page turns stationary. Avoid permanently reserving the tallest full list merely to suppress movement.
6. Share the active-section calculation between header and dock and derive it from the same header offset. Cover section boundaries and end-of-page behavior. Keep native href fallback, modifier-click behavior, and keyboard accessibility.

## Verification required for an implementation

Add browser assertions for section landing offsets (within 2px after settling), search → Back/Forward history, home → detail → Back viewport restoration, rapid repeated navigation, mobile-sheet dismissal, book/list switches, and approach switches with stable reference points. Test normal and reduced motion, delayed fonts/content, long service text, and responsive resizing. Then check Firefox and WebKit as well as Chromium.

Existing navigation tests cover a highlighted section, logo centering, and a search URL change. They do not establish this history or geometry contract. No full test suite, production build, cross-browser validation, or implementation was performed as part of this investigation.

## Local references reviewed

- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` (Scroll Behavior Override)
- `node_modules/next/dist/shared/lib/router/utils/disable-smooth-scroll.js`
- `src/components/site/notch-header.tsx`, `quick-dock.tsx`, and `search-palette.tsx`
- `src/components/marketing/approach-workbench.tsx`, `veloce-bento.module.css`, `services-book.tsx`, and `services-book.module.css`
- `src/components/booking/meeting-provider.tsx` and `meeting-panel.tsx`
- `tests/e2e/site.spec.ts`
