# Sample websites in "Tailored services": investigation

**Goal:** show sample websites in the home page's "Tailored services" section as examples of the work. Each preview stays visible, and hovering one opens a VengeanceUI **Cursor Card**. If it works, the samples are shown in a VengeanceUI **Diagonal Carousel**.

## What exists today

| Piece | Where | Notes |
| --- | --- | --- |
| Tailored services section | `src/app/page.tsx:163` | `<section id="services">` with `SectionHeading` and `ServicesCarousel` |
| Services carousel | `src/components/marketing/services-carousel.tsx` | Horizontal scroll-snap row: featured card, one card per service (9 from `getServices()`), closing card. Has its own arrow buttons. |
| Sample websites | `src/content/builder-templates/manifest.json`, `public/builder-templates/<slug>/v<N>/` | Designer templates. **Only one is in the repo: `noir-needle` (Tattoo studio).** |
| Uploaded templates | Postgres (`BuilderTemplate*`) | Added from the developer panel; may contain more samples |
| Listing API | `listTemplates()` in `src/server/builder/template-registry.ts:116` | Returns `{ slug, name, description, websiteType, scheme, pages, thumbnail }` for repo and uploaded templates, already filtered by publish status |
| Thumbnails | `thumb-<page>.webp`, one per page | 480×640 (3:4 portrait), about 30 KB each |
| "Open this sample" | `/build?template=<slug>` | Already supported (`src/app/build/page.tsx:21`) |

## Blockers and gotchas

1. **There are no published samples.** `noir-needle` has `"published": []`, so `listTemplates()` returns nothing in production. A diagonal carousel works best with about 4 or more items. Fix: publish `noir-needle` (`npm run template:publish`) and add or publish more templates. Until then, a single template could fill the carousel with one slide per page (it has 4 page thumbnails).
2. **The app uses `LazyMotion strict`** (`src/components/providers.tsx:20`). Both pasted components use `motion.div` and `motion.p`, which **throw at runtime** under strict mode. After `shadcn add`, change them to `m.*`, as every other component in `src/components` does. `useMotionValue`, `useSpring` and `AnimatePresence` are fine. The loaded `domAnimation` feature set covers everything both components need.
3. **Cursor Card is built for inline text links.** It renders an `<a>` with `inline-block font-bold hover:bg-orange-100 px-1 -mx-1`. Inside the carousel it needs to:
   - Act as a block wrapper, with the orange text-link styling removed (it is also off-brand).
   - Not sit inside the carousel's slide `<button>`, because `<a>` inside `<button>` is invalid HTML. The slide markup has to change, or the hover card has to be driven by the slide itself.
   - Have a fallback on touch devices, which have no hover. Show the description under the active slide on `(hover: none)`.
   - Have a keyboard path. Cursor Card only reacts to the mouse, so the same description should be visible or announced for the focused or active slide.
4. **Diagonal Carousel assumes square images.** Its slide button is `aspect-square` and its images use `object-cover`, so 3:4 thumbnails get cropped. Switch to `aspect-[3/4]`. Its viewport is `absolute inset-0`, so it needs an explicit height (about `h-[520px] sm:h-[600px]`). Its control styles use neutral and `dark:` classes. Retheme them to the site tokens (`border-line`, `bg-surface`, `text-ink`).
5. **The two carousels clash.** The diagonal carousel shows one large item at a time with rotated neighbours. It fits images, not the current service cards, which carry a category, a title, an icon and an "Ask about this" button. Replacing the services row with it would lose the per-service inquiry buttons.
6. **Reduced motion is handled for free.** `MotionConfig reducedMotion` applies to the spring, the rotation and the hover card. The cursor-following card still moves with the mouse, which is fine.
7. **Performance.** Use `next/image` (or keep `<img>` with `loading="lazy"`) for thumbnails, and fetch the listing on the server in `page.tsx` alongside `getServices()`. Do not use live `<iframe>` previews. Each one boots a full template page with fonts and images, which is far too heavy for a carousel.

## Options

**A. A samples carousel inside the section (recommended).** Keep the services card row. Below it, add a "Sample work" row with:
- Left: a short intro and "Start from this sample" (`/build?template=<slug>`) for the active slide.
- Right: a Diagonal Carousel of sample home-page thumbnails.
- On hover, the active slide shows a Cursor Card with the sample's second page thumbnail and its description ("Tattoo studio: portfolio, artists, booking…").

This keeps the inquiry flow and adds proof of work.

**B. Samples inside the service cards.** Replace the small phone mock in each service card (the icon box) with a sample thumbnail mapped to that service, with a Cursor Card on hover. This needs a `serviceSlug` per template. Most services (automation, integrations, internal systems) have no website sample to show, so the cards would be inconsistent.

**C. Replace the services row with the Diagonal Carousel.** One slide per service, showing a sample image. This loses the "Ask about this" buttons and category labels, and needs an image for every service. Not recommended.

## Proposed implementation (option A)

1. `npx shadcn@latest add <cursor-card.json> <diagonal-carousel.json>`. Both files go into `src/components/ui/`. `framer-motion` and `lucide-react` are already installed.
2. Patch both components: `motion` becomes `m`; retheme them to site tokens; add a `slideAspect` or `imageClassName` override for 3:4; and in Cursor Card, change the wrapper to a `div`/block with an `asChild`-style API (no bold/orange link styles).
3. Add `src/components/marketing/sample-sites.tsx` (client component):
   - Takes `TemplateListing[]`.
   - Holds the active index.
   - Wraps only the active slide's image in Cursor Card.
   - Renders the caption and "Start from this sample" link for the active slide.
   - Shows the description inline on `(hover: none)`.
4. `page.tsx`: add `listTemplates()` to the existing `Promise.all`. Render `<SampleSites>` under `ServicesCarousel` only when there are 2 or more samples, so production never shows an empty or single-slide carousel.
5. `site.ts`: add the copy (`landing.samples = { eyebrow, title, body, cta }`), keeping the "no names, quotes or numbers" rule.
6. Tests:
   - A vitest case for the "hide below 2 samples" rule.
   - Extend the Playwright axe check on `/` to cover the new region (focusable carousel, `aria-roledescription`, button labels).

## Open questions

- Which sample websites? This document assumes the builder designer templates. If the samples are other sites (for example, past client work or external URLs), each one needs a screenshot plus a link, and option A still applies.
- Who publishes more samples, and when? This decides whether to ship behind the "2 or more samples" rule or to seed with `noir-needle`'s pages.
