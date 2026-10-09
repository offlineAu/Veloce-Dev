# Pixel logo loader implementation plan

Status: implemented, 2026-10-06. The phases below record the intended implementation; see As built for the final route-boundary choice and verification.

Based on the [investigation](./PIXEL_LOADER_INVESTIGATION.md) and [motion preview](./pixel-loader-preview.html), implement the square-tile reveal of the exact Veloce mark: build diagonally upward, resolve into the solid logo, hold, fade, and repeat while loading.

## Scope and decisions

- Reuse `LOGO_POLYGONS` from `src/components/brand/logo.tsx` as the artwork source.
- Use SVG clipping and CSS opacity animation. No new packages, raster assets, or animation runtime.
- Deliver a page-size variant and a compact variant for the existing inquiry and introduction submission states.
- Add route loading feedback through Next.js Suspense fallbacks, subject to checking referral not-found behavior described below.
- Show real content or submission results immediately when ready. Do not wait for the animation to finish.
- Preserve current form behavior, theme selection, and the visitor's motion preference.

This is a loading indicator, not a percentage display or a timed welcome screen. Section-anchor navigation does not trigger it.

## Intended experience

| Context | Size and detail | Visible copy | Lifecycle |
| --- | --- | --- | --- |
| Route fallback | 80px mark; 16 × 16 grid | Loading… | Shown while the page suspends; removed when content arrives. |
| Inquiry submission | 20px mark; 8 × 8 grid | Existing Sending… text | Uses the existing `pending` state. |
| Introduction submission | 20px mark; 8 × 8 grid | Existing Sending… text | Uses the existing `pending` state. |
| Reduced motion | Same dimensions; solid completed logo | Same loading/sending copy | No assembly, fading, or looping. |

Start with a two-second loop:

1. 0–160ms: brief reset.
2. 160–1200ms: tiles reveal from bottom left to top right.
3. 1200–1320ms: overlay the exact solid mark to remove tile seams.
4. 1320–1680ms: hold the completed logo.
5. 1680–1920ms: fade out together.
6. 1920–2000ms: reset, then repeat if still mounted.

Use the same silhouette and direction in both variants. Review the compact grid at actual display scale; if it loses recognizability, use a three-bar reveal for the compact variant while retaining the tiled page version. Inherit `currentColor` so page loaders use the active ink token and form loaders use the button foreground.

## Phase 1 — Build the reusable mark

Create:

- `src/components/brand/pixel-logo-loader.tsx`
- `src/components/brand/pixel-logo-loader.module.css`
- `src/components/brand/pixel-logo-loader-geometry.ts`

The SVG component should be synchronous and usable from both server-rendered routes and client-rendered forms. Give it a `variant` prop (`page` or `compact`), `className`, and compatible SVG attributes. Keep accessibility semantics in the caller: the animated SVG is decorative beside status text.

Generate the two grid definitions deterministically from `LOGO_POLYGONS`. Retain cells whose rectangles intersect any polygon, including edge intersections; center-only sampling would lose portions of the exact outline. Compute coordinates and reveal order once at module initialization, not on each render. Store this pure geometry logic separately from the component. Do not use DOM measurement, canvas, timers, or random values to construct the mark.

Clip the rectangles to the original polygons. Give each mounted component its own clip ID using React `useId`, and use a consistent ID in the SVG URL reference. Add the solid logo layer above the tiles for the hold phase. Use cell-specific keyframe thresholds on one shared loop duration; independent staggered looping delays can cause tiles to reset at different times.

Define the completed mark as the visible base state. Enable animation through CSS when motion is allowed. Under `prefers-reduced-motion: reduce`, explicitly disable animations and show the solid layer unless the root has `data-motion="full"`. Do not rely only on the global duration clamp: finishing a loop on its empty frame can make the logo disappear. The loader should animate without waiting for hydration and remain useful with JavaScript disabled.

Acceptance: both sizes reproduce the mark, repeated instances do not share clip IDs, the loop resets together, and reduced motion always leaves a visible completed logo.

## Phase 2 — Integrate the two forms

Modify:

- `src/components/forms/inquiry.tsx`
- `src/components/forms/introduction.tsx`

Replace the existing `Spinner` imports and pending-only render branches with the compact `PixelLogoLoader`. Keep the general-purpose `src/components/ui/spinner.tsx` available with its current API; explicit form imports make the branded change clear.

Preserve `useTransition`, duplicate-submit guards, disabled submit buttons, `aria-busy`, and all success/error handling. Set the new SVG to `aria-hidden` and keep Sending… as visible text. Check whether the current form exposes a pending announcement; if needed, add a stable polite status node for that text without giving the SVG a second live-region announcement.

Reserve a fixed 20px square for the pending mark and verify the sending label fits on mobile. Start without a reveal delay; add an approximately 150ms CSS delay only if fast submissions visibly flash the mark. Sending text and the disabled state remain immediate, and completion is never delayed.

Acceptance: both forms show the branded mark during real pending work, ignore duplicate submission, stop loading on success or error, and remain understandable to a screen reader.

## Phase 3 — Add route fallbacks

Create `src/app/loading.tsx` as a small Server Component rendering:

- A `main` element with `id="main"`, preserving the root skip-link target.
- A page-flow loading region with enough height to comfortably center the 80px mark.
- A single `role="status"` region containing Loading… and a decorative SVG.
- Existing background and ink tokens rather than hard-coded palette values.

The installed Next.js loading guide places this boundary inside the root layout and around descendant page content. Existing providers stay mounted; the header and footer currently live in page components and will not appear until those pages resolve. Accept that temporary layout for this change rather than moving database-backed site chrome into the shared layout.

Before committing the root fallback, verify HTTP and rendered behavior for valid, expired, and invalid `/refer/[token]` requests. The referral page calls `notFound()` after asynchronous work; streaming a fallback first can change an invalid request from HTTP 404 to HTTP 200 with not-found content. Preserve the existing not-found contract if this check shows a regression. In that case, scope home loading to a local Suspense boundary around its async page content and put any referral boundary after campaign validation. Keep validation outside the streaming boundary and do not introduce a larger routing or caching refactor just to display the loader.

Use the installed `node_modules/next/dist/docs/` guides for the final route implementation, including loading, Suspense, and not-found behavior. Prefetching may make fallbacks unobservable during fast navigation; validate with controlled delays rather than changing production prefetching.

Acceptance: slow page data shows the fallback, ready content replaces it immediately, section anchors behave as before, the skip link has a target during loading, and invalid referral behavior retains its existing contract.

## Phase 4 — Verify and finish

Use focused checks for the behavior this change adds:

| Check | Evidence required |
| --- | --- |
| Geometry and multiple instances | Both grids cover polygon edges; multiple mounted loaders have distinct, working clip references. |
| Motion preferences | OS reduce shows a solid mark; Always animate restores the loop and toggling it while mounted works. |
| Themes | Periwinkle and Ember remain readable; filled-button loaders inherit the correct foreground. |
| Forms | Slow, fast, successful, and failed submissions clear pending correctly; existing duplicate-submit and accessibility behavior remains intact. |
| Routing | A controlled slow render exposes the fallback; completed pages replace it; invalid referral response and indexing behavior do not regress. |
| Accessibility | One pending announcement per operation, decorative SVGs, working skip link, no unexpected focus movement. |
| Responsive/browser rendering | Check narrow mobile layout and SVG clipping in Chromium, Firefox, and WebKit; inspect tile seams and the final logo at actual size. |
| Cost | Compare a production build and inspect an active loader on a mobile device; no new dependency or per-frame React rendering. |

Extend existing Playwright coverage where useful for reduced motion, multiple clip IDs, pending behavior, and route fallback replacement. Use existing valid form fixtures and controlled local delays; never add a production sleep. Add a small geometry unit test only if intersection filtering introduces a meaningful edge-case risk.

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`, then the relevant Playwright checks using the project's existing test setup. Record environmental blockers separately from loader failures. Existing form flow tests should continue to pass.

Update the investigation with the final grid, timings, route-boundary choice, and verification results. Keep the standalone preview as a design reference. The implementation is complete when both form states and the chosen route fallback use the loader, reduced motion remains visible, and all applicable checks pass.

## Delivery order

1. Reusable SVG, geometry, CSS, and motion behavior.
2. Compact form integrations and focused validation.
3. Route fallback with referral status verification.
4. Production checks, browser review, and documentation update.

The only planned application behavior change is branded loading feedback during existing asynchronous work. Changes to fetching, caching, form processing, or site navigation are outside this implementation.

## As built

- Added `PixelLogoLoader`, scoped CSS, and deterministic polygon/cell intersection geometry. Page: 80px, 16 × 16 grid, 151 intersecting square cells. Compact: 20px, 8 × 8 grid, 45 cells. Occupied diagonals are normalized to the same 160–1200ms reveal window; the solid mark resolves by 1320ms, holds to 1680ms, and fades by 1920ms in a two-second loop.
- Both forms now render the compact mark during their existing transitions. A stable, visually hidden status node announces Sending… outside the busy form, where `aria-busy` cannot defer the announcement. Disabled buttons, submission guards, existing errors, success panels, and toasts remain intact.
- Added `PageLoading` and a local home-page Suspense boundary around the existing async page content. No root `src/app/loading.tsx` was added: invalid referral links were confirmed to return HTTP 404 before this change, and a global streaming boundary would risk changing that behavior. Referral fetching and validation remain unchanged, with no new fallback during campaign lookup. Legal pages and section anchors are unaffected.
- Tests cover real per-tile CSS animation effects and partial/full assembly frames, rather than relying on computed animation names alone. CSS-module keyframes are referenced through `animation-name` rules so the production build correctly renames them.
- Repeated server-rendered instances have distinct clipping IDs. No dependency, client timer, artificial loading delay, or per-frame React update was introduced.

Verification: production build and typecheck pass; all 118 unit/integration tests pass; changed files pass ESLint; all nine Chromium loader checks pass across the project's three viewports, and all three loader checks pass in mobile WebKit. All 18 selected existing desktop form, referral, and accessibility regression tests pass, including duplicate submission, success/error handling, referral 404/noindex, and axe scans. Production mobile screenshots were inspected at partial assembly and completed-mark frames; no page script errors were observed. Full repository lint is blocked by the existing `react-hooks/set-state-in-effect` violation at `src/components/site/notch-header.tsx:144`, outside this change. Firefox installation failed after download timeouts, so Firefox rendering is not verified. Physical-device performance and manual screen-reader listening have not been measured.
