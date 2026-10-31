# Preloader and landing animation priority investigation

Status: A and B implemented on 2026-10-28; C, D, E and F are still open. As built:

- `src/app/page.tsx` renders `<BootLoader>` before a `<Suspense>` around `HomeContent`, so the overlay is in the first HTML flush. Clients that cannot run the inline swap script get one pass instead. Crawlers (`AUTOMATED_AGENT_PATTERN`, shared with the intro's skip rule) are detected by user agent. Browsers with JavaScript off are sent by a `<noscript>` refresh to `?nojs=1`.
- `src/components/site/boot-intro.ts` is the intro engine. It is serialised into the head script and started there, and `mount()` runs from an inline script right after the overlay markup. `boot-loader-client.tsx` and the 12 s hydration failsafe are removed. If the document finishes parsing and the overlay never mounted, the page is released.
- `BootLoader` is now server markup only. The elements the engine changes are marked `suppressHydrationWarning`, so hydration landing mid-sequence does not reset the overlay.
- E2E: `tests/e2e/boot-loader.spec.ts` now covers playing with every JavaScript chunk blocked, and continuing after a delayed hydration.

## Goal

The homepage intro (the "turn up your volume" gate, the laptop sequence and the zoom into the hero) and the hero animations must show for every real visitor, including those on slow connections and low-end devices. Today they do not. The intro is deliberately skipped in several of these cases, and in others it times out before it can run.

## Recommendation

Change the intro's behavior from **skip when conditions are poor** to **always show, at a quality tier that suits the device**. Make its first paint and its gate independent of the database, the React bundle and the images:

1. Stream the intro before the page data. Render the overlay in the first HTML flush, ahead of the database work.
2. Make the gate work before hydration. A small inline script owns the gate and the sequence, so React is no longer required.
3. Replace the skip rules with tiers: **full**, **lite** and **still**. Only bots and repeat visits in the same session skip.
4. Give the intro's assets top priority. Preload the first frame and the hero photo, and reduce the image count.
5. Test the intro under throttling. Add a forced-intro switch so Playwright can exercise it, since automated browsers are currently skipped.

Accessibility is a constraint. Visitors who ask for reduced motion still see the intro, but as a still version with crossfades and no movement or zoom. They are not shown the full animation.

## How it works today

| Piece | Where | Behavior |
| --- | --- | --- |
| Pre-paint decision | `src/components/site/boot-loader.tsx:11` (`bootInitScript`) | Sets `data-booted` (hidden) for: seen this session, reduced motion, **`data-perf="lite"`**, bots/webdriver, or any path other than `/`. |
| Low-end detection | `src/lib/themes.ts:156` (`themeInitScript`) | `data-perf="lite"` when memory ≤ 4 GB, ≤ 2 cores, or **Data Saver** is on. |
| Failsafe | `boot-constants.ts` `INTRO_FAILSAFE_MS = 12_000` | If React has not hydrated within 12 s, the overlay fades out and the intro is gone. |
| Gate and sequence | `boot-loader-client.tsx` | The gate is drawn by CSS before hydration, but the Click/Tap buttons work **only after hydration**. Progress follows DOM, fonts, image decoding and window load, and gives up waiting after 6 s (`GIVE_UP_MS`). |
| Mounting | `src/app/page.tsx:105` | `<BootLoader>` is inside `HomePage`. The page first awaits `getCompanyProfile()`, `getServices()` and possibly the campaign. |
| Hero headline | `hero-headline.tsx`, `globals.css:311` | CSS-only word rise, paused while `data-intro` is active. Already independent of hydration. |
| Hero slideshow | `hero-slideshow.tsx` | Framer Motion and client-only. With reduced motion or `lite` it stays on the first photo. |
| No JS | `layout.tsx` `<noscript>` | The overlay is hidden. |

## Why it fails to show

### 1. Low-end devices are skipped deliberately

`d.perf==="lite"` is part of the reduced-motion test in `bootInitScript`. Phones with 4 GB of RAM or less and any device with Data Saver on never see the intro. This includes most budget and mid-range Android phones in Chromium browsers, where `navigator.deviceMemory` is available. Safari does not provide that value, so iPhones avoid this rule unless they have 2 cores or fewer. For many visitors this is the most common case, not a rare one.

### 2. The first paint waits for the database

`proxy.ts` sets `Cache-Control: private, no-store` and a nonce on every request, so the homepage is rendered on demand each time. `src/app/` has no `loading.tsx` and no Suspense boundary. The intro is inside `HomePage`, after `await Promise.all([...db])`, so it reaches the browser no earlier than the page's data. On a cold database or a slow network, the visitor sees a blank screen first. The preloader cannot cover a wait that happens before it exists.

### 3. The gate needs the full React bundle, and the timer is 12 seconds

The gate appears through CSS, but the button is inert until React hydrates the whole homepage. The local `.next` build gives an indication of the JavaScript involved: about 166 KB gzip for the root main files, plus about 220 KB gzip of client chunks referenced by the homepage. These overlap and the build may be stale, so treat the numbers as rough. Framer Motion features are lazy, but PostHog, Radix, the Cal embed provider and the page's client components are all part of hydration. On Slow 3G with a 4× to 6× CPU slowdown, hydration within 12 s is not guaranteed. When it takes longer, `data-intro="timeout"` fades the overlay out, and the visitor sees the gate disappear without being able to use it.

### 4. The intro's images are low priority and pass through the optimizer

All intro `<Image>`s use `fetchPriority="low"`. Each frame is rendered twice, once as the screen and once as a 64 px ambient blur, giving up to 20 eager requests. They are served through `/_next/image`, which transforms images on demand when the cache is cold. The sample thumbnails are about 26 to 45 KB each, so 10 frames come to roughly 380 KB, competing with the bundle on a slow connection. Progress waits for them for up to 6 s.

### 5. The costliest effects run on the weakest GPUs

`.ambient` uses `filter: blur(70px) saturate(1.5)` across 110% of the viewport, the grain animates `steps(1) infinite`, and the zoom scales the whole device. The global `:root[data-perf="lite"] .grain { display:none }` rule does **not** apply to the intro, because `.grain` in `boot-loader.module.css` is a hashed module class. `PerfMonitor` starts its probes 2 s after hydration, so it can measure the intro itself and switch the rest of the visit to lite mode.

### 6. No JavaScript means no intro

The `<noscript>` style hides the overlay entirely.

## Proposed changes

### A. Stream the intro first (largest effect on slow connections)

- Move `<BootLoader>` out of the data-awaiting part of `HomePage`. There are two options:
  - Render it from a small synchronous wrapper and put the data-dependent body in `<Suspense>` (keeping the server-rendered page under the overlay, as the design intends), **or**
  - Add `src/app/loading.tsx` that renders the intro. This is less suitable, because the loading UI would be replaced when the page arrives and the overlay would remount.
- Its inputs are already available without the database. `frames` come from the filesystem (`showcaseSamples` with `existsSync`), and `name` can use `env().COMPANY_NAME`, which the layout already uses for metadata.
- Read `node_modules/next/dist/docs/01-app/.../loading.md` and the streaming guide in the installed Next 16 before choosing. `headers()` in the root layout is fine, since it does not block on data.

### B. Make the gate and sequence independent of hydration

- Move the state machine (gate → playing → exit → gone, the beat-driven film position `--p`, the zoom measurement and the `sessionStorage` flag) into an **inline vanilla script** with the nonce, next to `bootInitScript`. It is about 2 to 3 KB, it is already DOM-only in practice (refs and `dataset`, with no React state needed), and `intro-sound.ts` is about 4 KB and uses only the Web Audio API.
- React keeps the markup (server-rendered) and does not take ownership of the phase. `phase` currently comes from `useState`. Switch it to a `data-boot-phase` attribute, written only by the script.
- Remove the 12 s timeout once the script handles the gate itself. Keep a failsafe only for the **progress** stage. The visitor has already chosen to enter at that point, so an existing `GIVE_UP_MS` cap ends the sequence.

### C. Replace skip rules with tiers

| Tier | When | Intro |
| --- | --- | --- |
| full | Default | As today. |
| lite | `data-perf="lite"` (memory, cores, Data Saver) or slow-frame detection | Same gate and sequence. No ambient blur layer (removes 10 requests and the blur), no grain, 4 to 5 frames rather than 10, a simpler zoom (opacity plus scale on the screen only). Sound is still offered. |
| still | Reduced motion (OS or the visitor's "Reduce" setting) | Gate shown. Frames crossfade with no slide, no zoom, no pulse and no rise. A short dissolve into the hero. |
| skip | Bots/webdriver/Lighthouse, already seen this session, path other than `/` | Unchanged. |

Apply the tier as `data-intro-tier` on `<html>` in `bootInitScript`, and add the lite rules in `boot-loader.module.css` with `:global(:root[data-intro-tier="lite"])`. That also fixes the grain rule that does not apply now. Have `PerfMonitor` wait until `data-booted` is set before probing.

### D. Prioritize the intro's bytes

- Add `<link rel="preload" as="image" fetchpriority="high">` for frame 1 and for `heroPhotos[0]`, the image the zoom lands on. React 19 `preload()` from `react-dom` works in a Server Component.
- Change frame 1 to `fetchPriority="high"` and leave later frames `low`/lazy. The sequence already waits for decoding, so later frames can load during the gate.
- Use pre-sized static WebP for frames (`unoptimized`, as the hero does) to avoid cold optimizer transforms. Generate a 560 px and a 1120 px version in `scripts/sample-screens.ts`.
- Drop the separate ambient `<Image>`s. Reuse the screen frame with CSS, or use a single dominant-colour gradient per frame computed at build time.
- Mark the JetBrains Mono subset the intro uses as preloaded (`next/font` `preload: true` is the default for the first weight, so check that it is the weight the intro uses).

### E. No JavaScript (optional)

With B in place, a CSS-only fallback (an automatic crossfade of frames with no gate or sound) can replace `display:none` in the `<noscript>` style. This is optional, because very few visitors browse without JavaScript.

### F. Verification

- Add a `?intro=force` (or `data-intro="force"` cookie) switch, accepted only by `bootInitScript`, so Playwright can run the intro despite `navigator.webdriver`.
- E2E: Chrome DevTools Protocol `Network.emulateNetworkConditions` (Slow 3G and Fast 3G) plus `Emulation.setCPUThrottlingRate` 4× and 6×. Assert that the gate is visible before `DOMContentLoaded`, that the button responds before React hydrates (block `/_next/static/chunks` to prove this), and that the overlay always ends with `data-booted="1"` and scrolling unlocked.
- Run the same tests with `deviceMemory` overridden to 2 and with `prefers-reduced-motion`, to cover the lite and still tiers.

## Trade-offs to accept consciously

- **Core Web Vitals.** Bots and Lighthouse still skip the intro, so lab scores do not change. Real-user (CrUX) LCP and INP will include the overlay for first-session visitors, now including low-end ones. Streaming the overlay first (A) helps, because its frame image or label becomes an early LCP candidate.
- **Data Saver.** Showing the intro to visitors who asked to save data runs against their stated preference. The lite tier limits the cost to about 4 to 5 small frames. Data Saver could also be a third condition for the still tier with only one frame. Recommendation: lite.
- **The earlier loader guidance.** `PIXEL_LOADER_INVESTIGATION.md` says "Do not impose a minimum wait… just to display it." That guidance was for route loading indicators. The intro is a branded welcome that the visitor chooses to enter, which is different, but it should still never hold the page after the visitor has clicked.

## Suggested order

A and B together, since they fix the "never appears" and "disappears unused" cases. Then C, then D, then F alongside them. E is optional.

## Not verified

These findings come from reading the code. I did not measure on throttled devices or in a production build. The bundle sizes come from the existing local `.next` output, which may not match `main`.
