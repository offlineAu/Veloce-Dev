# Veloce pixel logo loader investigation

## Recommendation

Build an SVG loader using the existing three logo polygons. Reveal the mark in square tiles from bottom left to top right, following its diagonal direction. Once assembled, overlay the original solid mark so the completed logo has no tile seams. Hold briefly, fade, and repeat only while the operation is pending.

The standalone [motion preview](./pixel-loader-preview.html) compares a true pixel silhouette with a tile reveal of the exact logo. Open it directly in a browser; it needs no server or dependencies. It includes both project palettes, pause and static controls, and 20px, 32px, and 48px samples. It is an exploration, not an integrated app loader.

## Findings in this repository

| Existing code | Implication |
| --- | --- |
| `src/components/brand/logo.tsx` exports `LOGO_POLYGONS`; viewBox is `0 0 96.8 100`. | Reuse the actual mark rather than tracing or generating another asset. |
| `public/brand/veloce-mark.svg` contains the same polygons. | The artwork is already suitable for vector animation. |
| `src/components/ui/spinner.tsx` wraps Lucide's rotating icon. | There is already a shared inline loading component. |
| Inquiry and introduction forms render `Spinner` during `useTransition` pending states, next to “Sending…”. | These are the existing integration points; keep the text, disabled button, duplicate-submit guard, and form `aria-busy`. |
| No `loading.tsx` files exist under `src/app`. | Route-level loading feedback would be new behavior. |
| Home awaits search params, company, services, and optionally a referral campaign. Referral awaits params and database-backed data and is explicitly dynamic. | These pages are candidates for route fallbacks; whether users see them depends on actual latency and streaming. |
| Headers and footers are rendered inside the page components. | A root fallback replaces the page including its header/footer. Shared root layout providers remain mounted, but current site chrome would not remain visible. |
| Main navigation mostly uses `#section` anchors. | Section jumps have no asynchronous route transition to indicate. |
| `src/lib/themes.ts` defaults to Periwinkle and supports Ember. | Use `currentColor` and theme tokens; base cream/terracotta tokens in globals.css are overridden. |
| Global CSS respects OS reduced motion unless `data-motion="full"`; a matching React hook already exists. | A static completed logo must be the reduced-motion state. Honor the existing visitor override. |

## Visual specification to start with

- Use the mark alone, without animating the surrounding circular badge or brand lettering.
- Start with a 16 × 16 grid at 64–96px for a page fallback. The preview uses 104px to make the treatments easy to compare.
- Reveal square cells with a deterministic diagonal stagger, with a little variation within each diagonal. Use opacity, rather than rotating the logo or making particles travel across the screen.
- Proposed two-second loop: brief empty phase, assembly until about 1.2s, resolve to the exact mark by 1.32s, hold until 1.68s, fade by 1.92s, then repeat.
- In light mode use the ink color; in dark mode inherit the light ink color. Inside filled buttons inherit the button foreground.
- For 20–24px inline loaders, investigate a coarser 8 × 8 grid or reveal the three bars. The 16 × 16 preview looks more intricate at this size; judge it at actual display scale before replacing the form spinner.
- Show “Loading…” for routes and retain “Sending…” for forms. Stop immediately when the real operation completes, even halfway through assembly.

These timings and sizes are design proposals, not measured performance results. The loop indicates waiting; it does not report task completion percentage. Do not impose a minimum wait to finish the animation or gate the first page on fonts, images, or hydration just to display it.

## Implementation options

| Approach | Result | Fit |
| --- | --- | --- |
| Square SVG rectangles selected by point-in-polygon sampling | Fully square pixels, stepped diagonal outline; 109 occupied cells in the preview's 16 × 16 sample. | Strong retro treatment. Can resolve into the original logo after building. |
| SVG rectangles clipped to the existing polygons, then solid logo overlay | Block assembly with the exact logo outline and a clean final mark. Preview uses 256 cells, including cells outside the clip. | Recommended starting point. Prune nonintersecting cells for production. |
| CSS wipe or three-bar animation | Fewer animated elements, less pixel detail. | Useful fallback at small button sizes. |
| Canvas, GIF, video, or Lottie | Additional rendering or asset workflow. | No demonstrated need for these in this project. |

SVG plus CSS needs no new animation dependency and can render from a Server Component. Framer Motion is already installed, but per-cell runtime animation is unnecessary for this effect. Use CSS opacity keyframes and precomputed cell coordinates and reveal ranks. Avoid generating random values during render, which can create hydration mismatches.

## Proposed app changes

1. Add `src/components/brand/pixel-logo-loader.tsx` and a scoped CSS module. Import `LOGO_POLYGONS` as the source of truth, use a deterministic cell table, and expose size, className, and accessible labeling. Generate unique clip IDs with React `useId` if using SVG clipping; multiple instances must not collide. The component should have a readable static state before hydration and with motion disabled.
2. Add `src/app/loading.tsx` if route feedback is desired. Include a `main` element with `id="main"` to preserve the root skip link destination. Position the loader in the page flow, rather than adding a blocking overlay. Add a separate referral fallback only if it needs different copy or layout.
3. Consider a compact variant for the two existing form submit buttons after reviewing the small-size preview. Preserve the existing shared Spinner API or switch those imports explicitly; avoid an unnoticed prop or accessibility change.
4. Use one accessible status announcement per operation. Route status text can provide the accessible name and the animated SVG can be `aria-hidden`. Form loaders can remain decorative beside the existing sending text; confirm announcements with a screen reader. A reduced-motion logo remains visible throughout waiting.
5. For exceptionally fast submissions, an optional roughly 150ms CSS reveal delay can suppress flicker while keeping the disabled state and sending text immediate. Never delay completion to match the animation.

## Next.js behavior verified locally

Read the installed package's guides before recommending route integration:

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`: `loading.tsx` is a Suspense fallback nested inside its segment layout. It swaps out when the content is ready, supports interruptible navigation, and does not cover async work in the same segment's layout.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md`: pending link feedback must be inside a descendant of `Link`; prefetched destinations may skip pending entirely. Route fallbacks and prefetching are preferred. There is no reason to wire this into the current section anchors.

Adding `loading.tsx` is not a universal page-download progress indicator. In particular, it cannot run before the browser receives the fallback HTML. Existing referral `notFound()` behavior should also be checked when adding a streaming boundary: a streamed fallback can send HTTP 200 before a later not-found result, as the installed loading guide explains.

## Validation and remaining work

The isolated preview was inspected in Chromium and exercised for palette switching, pause, explicit static mode, OS reduced motion, and a 390px viewport. No page script errors or horizontal overflow were observed. App source and loading behavior have not changed.

Before shipping an integrated loader, check slow and fast form submissions, route streaming with a throttled connection, multiple SVG instances, reduced motion and the existing Always animate override, accessible loading announcements, and rendering in Safari/Firefox. Measure the production-sized loader on a mobile device; SVG clipping and many opacity animations can incur painting costs. No app performance benchmark or cross-browser validation has been performed in this investigation.

## Implementation outcome — 2026-10-06

The [implementation plan](./PIXEL_LOADER_IMPLEMENTATION_PLAN.md) has been executed. The final exact-outline treatment uses 151 square tiles at 80px for the home fallback and 45 tiles at 20px for both form submission states. The two-second build/resolve/hold/fade loop is synchronized across tiles, and reduced motion displays the completed mark. The original standalone preview remains a design reference; its sample grids differ from the optimized application grids.

Home uses a local Suspense boundary with the shared `PageLoading` component. Referral pages keep their existing validation and fetching without a global loading boundary, preserving HTTP 404 for unknown tokens. No artificial delay or new dependency was added.

Production build, typecheck, all 118 unit/integration tests, and focused lint pass. Loader tests pass in Chromium at mobile/tablet/desktop sizes and in mobile WebKit, including actual partial assembly, clean final mark, preference changes, theme inheritance, pending cleanup, and fallback replacement. All 18 selected existing desktop form, referral, and accessibility regression tests pass. Production mobile screenshots were visually reviewed, with no page script errors observed. Existing full-repository lint has a header effect error outside this work. Firefox validation is unavailable because its browser download timed out. No physical mobile performance benchmark or manual screen-reader listening was performed.
