# Implementation plan: components, animation and scroll effects

Status: **implemented** (2026-10-02) per the owner's answers: subtle animated aura hero background; both subtle reveals and expressive heading stagger; VengeanceUI (MIT) accepted; Sheet for mobile nav; plus a notch header and search palette. See "As built" at the end.
Research date: 2026-10-02. Sources: vengeanceui.com (also spelled vengenceui.com), its GitHub repo (MIT), `https://vengeanceui.com/r/registry.json`, ui.shadcn.com/docs/components, and 2026 write-ups on CSS scroll-driven animations (browser-support figures not verified against caniuse).

## 0. Done in this pass

- Logo: the supplied PNG was traced to three straight-edged polygons (`src/components/brand/logo.tsx`) and is used in the header badge, footer, favicon (`src/app/icon.svg`) and share image. Standalone files: `public/brand/veloce-mark.svg`, `veloce-logo.svg` (badge) and `veloce-logo-original.png` (untouched source). Badge colours are the logo's own: `#ebebeb` disc, `#202020` glyph.

## 1. Findings that shape the plan

1. **Most VengeanceUI components do not honour `prefers-reduced-motion`.** Checked: stagger-text, faq-accordion, smooth-scroll. Every component we take must be adapted, as the three existing ones were.
2. **Install path:** `npx shadcn@latest add @vengeanceui/<name>`, or the raw JSON at `https://vengeanceui.com/r/<name>.json`. The items checked listed no `cn` dependency, so the `cn` install failure seen with the shadcn registry is probably specific to that registry. Fallback stays: fetch the JSON, copy the files, install dependencies by hand.
3. **Licence:** the repo is MIT (keep the copyright notice when copying substantial code). Demo content (logos, testimonials, avatars, images) is placeholder and must not ship. We have no real client logos or testimonials, so logo sliders and testimonial cards are out.
4. **Heavy items are out:** anything using three.js / React Three Fiber / WebGL / GSAP (wave-grid, twisting-ribbon, liquid-ocean, scroll-dissolve-reveal, model-viewer, interactive-particles, gooey-text-reveal, animated-footer). They hurt LCP and INP and add dependencies for little gain on a marketing page.
5. **Scroll tech:** CSS scroll-driven animations (`animation-timeline: view()/scroll()`) work in Chromium and Safari 26+, not yet in Firefox stable, so they are progressive enhancement only. Lenis / smooth-scroll hijacks native scrolling (breaks find-in-page and anchors, a11y risk) and is rejected.

## 2. Candidate components

| Component | Source | Where it goes | Verdict |
|---|---|---|---|
| Reveal (own, tiny) | framer-motion `whileInView` | section headings and card grids | **Yes** (core) |
| Accordion | shadcn | "What you can expect" list on mobile | **Yes** |
| Sheet | shadcn | Mobile navigation (replace the hand-rolled menu) | **Yes** |
| Sonner | shadcn | Toast after inquiry/introduction submit (in addition to the in-dialog message) | **Yes** |
| Spinner | shadcn | Submit buttons while sending | **Yes** |
| Field / Select / Checkbox | shadcn | Only if the forms grow (e.g. a consent checkbox once privacy text exists) | When needed |
| Tooltip | shadcn | Icon-only buttons, if any are added | Maybe |
| highlight-grid | VengeanceUI | Services grid (9 cards): highlight follows hover **and** focus | **Yes**, adapt |
| glow-border-card / border-beam | VengeanceUI | Offer panel and closing CTA, subtle | **Yes**, adapt (static under reduced motion) |
| stagger-text | VengeanceUI | Section headings below the fold; keep the hero h1 static for LCP | Maybe, adapt (sr-only full text) |
| expandable-bento-grid | VengeanceUI | Alternative for the philosophy block | Maybe (overlaps the existing bento) |
| aurora-hero / animated-rays / perspective-grid | VengeanceUI | One subtle hero background | Maybe (pick one; check contrast; static when reduced) |
| morphing-disclosure | VengeanceUI | Process steps | Maybe (not inspected) |
| Navbars (spotlight / notch / mega-menu) | VengeanceUI | Header | No: single-page site; sticky header + Sheet is enough |
| logo-slider, stacked-logos, testimonials-card | VengeanceUI | none | **No**: we have no real logos or testimonials |
| Carousel, HoverCard, ScrollArea, Progress, NavigationMenu | shadcn | none | No |

## 3. Animation and scroll strategy

Principles: opacity and transform only; content visible by default (no hidden-until-animated text); animate once; hero server-rendered with no entrance animation (protects LCP); every effect has a reduced-motion path; nothing pins or hijacks scroll.

| Effect | Where | Technique | Reduced-motion behaviour |
|---|---|---|---|
| Section reveal (fade + 16px rise, once) | headings, card grids, process steps (60ms stagger) | `Reveal` component, framer-motion `whileInView`, `viewport={{ once: true, margin: "-10%" }}` | `<MotionConfig reducedMotion="user">` at the app root: transforms dropped, opacity only |
| Reading progress bar | thin bar under the header | CSS `animation-timeline: scroll()` inside `@supports`; hidden otherwise | not rendered |
| Process progress line | the 6-step connector fills as the section scrolls | `animation-timeline: view()` with a static full line as fallback | static full line |
| Service card hover/focus highlight | services grid | adapted highlight-grid (`layoutId`) | instant, no glide |
| Capability tab indicator | capability tabs | shared `layoutId` pill | instant |
| Stats count-up | stats strip | already built (framer-motion) | already handled |
| Bento cursors / tile autoplay | bento | already built; stops on interaction | already handled |
| Offer panel glow border | offer panel, closing CTA | CSS-only border beam | static border |
| Button/card hover lift | cards, CTAs | CSS transitions (already present) | `motion-reduce:` variants (already present) |
| Dialog open | inquiry dialog | existing `animate-rise` | disabled by the global reduced-motion rule |

Not doing: Lenis / smooth scroll, scroll-jacking or pinned sections, parallax on text, cursor-trail or WebGL effects, infinite marquees, view transitions between pages (little navigation), animating height / width / top.

Global safety net (`globals.css`): a `@media (prefers-reduced-motion: reduce)` clamp on animation and transition durations and `scroll-behavior: auto` (partly present; extend it to cover new utilities).

## 4. Phases

**Phase A: foundations (small, low risk)**
1. Add `MotionConfig reducedMotion="user"` in a client `Providers` component used by `layout.tsx`.
2. Build `src/components/motion/reveal.tsx` (`Reveal`, plus a stagger group). Server components import it; it is the only client boundary.
3. Apply it to section headings and grids on the sales page, then the referral page.
4. Tests: all headings visible with `reducedMotion: "reduce"` and after scrolling; content present in the server HTML (not hidden); axe unchanged; mobile overflow check.

**Phase B: shadcn pieces**
1. Add `accordion`, `sheet`, `sonner`, `spinner` (fetch from the registry and re-point the `cn` import, as before).
2. Replace the hand-rolled mobile nav with Sheet (keep the existing keyboard test). Add a toast on submit success and error.
3. The expectations list becomes an accordion below `md` and stays an open list on desktop.
4. Tests: mobile menu keyboard test, toast announced to assistive tech, forms still pass.

**Phase C: VengeanceUI adaptations** (one change each; every adapted file gets a header comment: source, MIT licence, what changed)
1. highlight-grid on the services grid (hover and focus-visible).
2. Border-beam / glow on the offer panel and CTA.
3. Optional: stagger-text for below-the-fold headings (sr-only full text), and one hero background (aurora or rays) if it passes contrast.

**Phase D: scroll-linked CSS (progressive enhancement)**
1. Reading progress bar and process line using `animation-timeline`, wrapped in `@supports (animation-timeline: view())` and `@media (prefers-reduced-motion: no-preference)`.
2. Verify in Chromium (supported) and by forcing the unsupported path (the fallback must be visible and complete).

**Phase E: verification and docs**
1. typecheck, lint, unit, build, Playwright at 3 viewports with axe; add a `reducedMotion: "reduce"` run.
2. Lighthouse / INP check on the production build; confirm no layout shift from reveals and no LCP regression.
3. Update README, TECHNICAL_DECISIONS (new dependencies, licences) and FEATURE_MAPPING.

## 5. Dependencies and cost

- Adds `sonner`; the Radix pieces are already covered by `radix-ui`. No GSAP, three.js or Lenis.
- All components are free (VengeanceUI is MIT). No paid services.
- `Reveal` and highlight-grid use framer-motion, which is already shipped; keep client components small and server-render everything else.

## 6. Decisions needed from the owner

1. Hero background: stay plain, or add one subtle animated background (aurora or rays)?
2. Reveal intensity: subtle (fade + small rise, as planned), or more expressive text staggering on headings?
3. Confirm VengeanceUI (MIT) is acceptable for client work, and who keeps the licence notice.
4. Replace the mobile nav with a Sheet (recommended), or keep the current menu?

## 7. As built

| Item | Where | Notes |
|---|---|---|
| Reveal (fade + rise, once) | `src/components/motion/reveal.tsx` | Used on section headings, service cards, process steps, philosophy items. `<noscript>` rule in the layout shows content without JS. |
| Heading stagger | `motion/stagger-text.tsx`, used by `SectionHeading` | Adapted from VengeanceUI stagger-text: sr-only full text, aria-hidden animated copy, plain under reduced motion. Hero h1 stays static. |
| Aura background | `motion/aura.tsx` + keyframes in `globals.css` | Three blurred theme-coloured blobs, CSS transform only, static under reduced motion. Own implementation (not the heavy VengeanceUI aurora-hero). |
| Highlight grid | `motion/highlight-grid.tsx` | Services grid (sales) and "what we do" (referral). Follows hover and keyboard focus. |
| Border beam | `motion/border-beam.tsx` | Offer panel and closing CTA. Adapted from VengeanceUI border-beam. |
| Reading-progress bar | `motion/scroll-progress.tsx` | CSS `animation-timeline: scroll()` inside `@supports` + no-preference. |
| Notch header | `site/notch-header.tsx` | After VengeanceUI notch-navbar. Tweaks: brand tokens, scroll-spy, search button, shadcn Sheet on phones, no theme toggle / login / sign-up. |
| Search palette | `site/search-palette.tsx`, `lib/search.ts` | Styled after VengeanceUI search-modal, built on shadcn Command (cmdk). Searches this page's own sections, services, capabilities; Ctrl/Cmd+K; no server search. |
| Accordion | `site/expectations-accordion.tsx` | Open on desktop, collapsed on phones after hydration. |
| Sonner + Spinner | forms | Toast on success; spinner while sending. |

Not done from the plan: the optional VengeanceUI "morphing-disclosure" and the process-line scroll animation (the connector stays static).
