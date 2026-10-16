# Replacing the Tailored services samples: investigation

## Outcome (2026-10-16)

All six designs are imported as published repo templates, built with option A below (`template:import --bake`). The carousel now shows eight samples:

1. Advisory firm (`aurelia-advisory`)
2. Homeware online store (`oakwell-home` v2, replacing `aurelia-store`)
3. Client portal (`bellbird-portal`, 6 pages, replacing `aurelia-portal`)
4. Trades and home services (`trades-home-services`)
5. Executive dashboard (`ridgeline-dashboard`, replacing `aurelia-insights`)
6. Real estate agency (`wren-vale-property`)
7. Accountants and advisers (`harlow-advisory`)
8. Tattoo studio (`noir-needle`)

The replaced `aurelia-*` templates stay published in the picker, so sites made with them keep working.

Each was imported with `--bake --version 1` and its hints file from `scripts/template-hints/<slug>.json`. Harlow has no hints file:

```sh
npm run template:import -- "~/Downloads/trades-template (static lists).html" --slug trades-home-services --name "Trades & home services" --type BUSINESS --bake --hints scripts/template-hints/trades-home-services.json
npm run template:import -- ~/Downloads/advisory-template.html --slug harlow-advisory --name "Accountants & advisers" --type BUSINESS --bake --hints scripts/template-hints/harlow-advisory.json
npm run template:import -- "~/Downloads/homeware-template (3).html" --slug oakwell-home --name "Homeware boutique" --type ECOMMERCE_STORE --bake --hints scripts/template-hints/oakwell-home.json
npm run template:import -- ~/Downloads/client-portal.html --slug bellbird-portal --name "Construction client portal" --type WEB_APP --bake --hints scripts/template-hints/bellbird-portal.json
npm run template:import -- ~/Downloads/executive-dashboard.html --slug ridgeline-dashboard --name "Operations dashboard" --type WEB_APP --bake --hints scripts/template-hints/ridgeline-dashboard.json
npm run template:import -- "~/Downloads/real-estate (2).html" --slug wren-vale-property --name "Real estate agency" --type BUSINESS --bake --hints scripts/template-hints/wren-vale-property.json
```

Each also had a `--description`; the descriptions are in the manifest. `oakwell-home` was imported again as v2, with the hero carousel recipe now in its hints file. Versions are immutable: a change to a design means importing it as v2 and pinning v2 in `src/content/samples.ts`.

**What works, checked in the read-only preview against the original files at 1280 px:**

- **Layout and content.** Each page matches its original, including every list, chart, table and photo the scripts built.
- **Interactions** (recreated by the builder; templates' scripts never run):
  - reveals, split headings and count-ups
  - FAQ accordions
  - review card stacks with next and previous
  - the homeware hero carousel: cards fan out in 3D; next/prev, a card, a progress segment, a swipe or the arrow keys move it; the headline slides in word by word, and the text, price and "02 / 06" counter follow; it plays every 6 s and pauses on hover (`data-vt-carousel`, v2)
  - the dashboard's Chart/Table toggles
  - phone menus and the portal's popovers
  - form checks with a thank-you message
  - the portal's six pages linked from its sidebar
  - the trades template's job list, area check and other parts set up by its existing hints file (imported, not re-checked one by one)

**What shows its first state only** (it needs the original script's logic):

- the dashboard's period, region and compare filters, dark mode, CSV export and Present
- homeware's cart and quick view
- the real-estate walk-through tour (the street view shows; moving between rooms doesn't), search and suburb panel
- the portal's sign-in, approval dialog, command palette, signature pad and live replies
- the advisory cash-runway calculator (the sliders move, but the months figure doesn't update)

The importer and runtime changes this needed are listed in `docs/BUILDER_TEMPLATES.md`, under "Templates whose script builds the page".

---

**Goal:** swap three of the home page's sample websites (`src/content/samples.ts`) for new hand-written designs, and decide what to do with the other three new designs.

| Current sample | Slug | Replace with | New file |
| --- | --- | --- | --- |
| Homeware online store | `aurelia-store` | Oakwell Home (ceramics, linen, lighting) | `homeware-template (3).html` |
| Client portal | `aurelia-portal` | Bellbird Building Co. client portal | `client-portal.html` |
| Executive dashboard | `aurelia-insights` | Ridgeline Supply Co. executive dashboard | `executive-dashboard.html` |

Also delivered, not yet assigned to a slot:

| New file | What it is |
| --- | --- |
| `trades-template (static lists).html` | Kestrel Plumbing and Electrical (trades, home services). It already has a hints file: `scripts/template-hints/trades-home-services.json`. |
| `advisory-template.html` | Harlow & Pike (business advisers and accountants). This is a candidate to replace `aurelia-advisory`. |
| `real-estate (2).html` | Wren & Vale Property (Brisbane real estate) |

## How this was tested

Each file was run through `importTemplate()` (`src/lib/builder/import`) offline, into a scratch folder. Nothing in the repo was written. Each file was then run again after a headless Playwright "bake" that runs the page's script first, scrolls through the page, and captures the DOM.

| Template | Plain import (JSON / images / SVG shapes) | After bake | Verdict |
| --- | --- | --- | --- |
| Trades | 58 KB / 10 / 16 | 60 KB / 10 / 16 | Imports fine as is. Its lists are already static. |
| Advisory | 40 KB / 1 / 15 | 55 KB / 3 / 15 | Team, fees, stories, the software marquee and the runway chart are empty without the bake. |
| Homeware | 33 KB / 4 / 23 | 87 KB / 44 / 23 | The product grid, rooms, makers, the set list and the hero stage are empty without the bake. |
| Client portal | 16 KB, sign-in screen only | 341 KB, 6 pages | **The whole app is skipped without the bake.** |
| Executive dashboard | 15 KB / 0 / 15 | 65 KB / 0 / 101 | The KPI tiles and every chart are empty without the bake. |
| Real estate | 31 KB / 2 / 29 | 60 KB / 19 / 36 | Listing cards, agents, suburbs and sold homes are empty without the bake. |

Screenshots of the baked portal (Messages view) and dashboard looked identical to the originals.

## Blockers and gotchas

1. **Five of the six files build their content from JavaScript arrays.**
   - Each one renders `PRODUCTS`, `LISTINGS`, `REVENUE` and similar arrays into empty containers with `innerHTML`.
   - The importer removes scripts, so a plain `npm run template:import` gives empty grids and charts.
   - The developer panel's upload already handles this: `bakeHtml()` in `src/components/dev/bake.ts` runs the page once in a sandboxed iframe.
   - **The CLI importer has no bake step.** Carousel samples must be repo templates, because `showcaseSamples()` only reads `manifest.json` through `findImported`. So the CLI is the path that matters.
   - The trades file is the exception: its "static lists" version was flattened by hand.
2. **The client portal is gated behind sign-in.**
   - `<div class="app" id="app" hidden>` is shown only by a script, so the importer skips it ("Skipped “APP”").
   - Its six views (`#v-overview`, `#v-project`, `#v-approvals`, `#v-invoices`, `#v-files`, `#v-messages`) are switched with `hidden`.
   - The bake has to click `#si-skip` (the file ships with `DEMO = true`), then call `go(view)` once per view and capture each one as its own page. That turns it into a six-page template, which suits the carousel: the hover card shows page 2, "Project".
3. **The portal's navigation won't link pages on its own.**
   - The sidebar uses `href="#/overview"`-style hash links.
   - In-page buttons use `data-go="messages"`, with no `href`.
   - Each baked page needs its links rewritten to the page paths before import, or `--map` entries. The `data-go` buttons become dead buttons unless a hint turns them into links.
4. **The portal is large.**
   - The app shell (sidebar, top bar, contact card) repeats on all 6 pages, giving about 340 KB of `template.json` before assets.
   - That's within the limits (1 MB per HTML file), but it's 5–6× the other samples.
   - Its dialogs (approval, command palette, lightbox) stay hidden, which is correct.
5. **Some interactions can't survive.** These parts rely on the script and show their first state only. That's acceptable for a read-only sample:
   - the dashboard's period, region and compare filters, its chart and table toggle, and "Present"
   - homeware's quick-view dialog and cart
   - the real-estate 3D walk-through, which loads photos from `data-src` IDs (seven "relative address" warnings)
   - the portal's signature pad and live replies
6. **Theme fixes for the dashboard.**
   - "No accent colour found": pick `#b4472a` (the brand rust) in the theme step.
   - Muted text on the background is 3.59:1 and needs 4.5:1. Darken `--muted` in the source before importing.
7. **Don't delete the old templates.**
   - `aurelia-store`, `aurelia-portal` and `aurelia-insights` v1 are published. Visitors' saved sites may reference them by `templateRef`, and these packages must keep rendering.
   - `tests/unit/builder-labels.test.ts` reads `aurelia-store/v1/template.json`, and `builder-drops.test.ts` reads `aurelia-advisory/v1/`.
   - Remove them from `SAMPLE_SITES`, optionally unpublish them, and leave the package folders alone.
8. **Fonts and images download at import time** (the scratch runs were offline). All images are Pexels and all fonts are Google Fonts, which the importer bundles as WebP and woff2. The image-rights note in `BUILDER_TEMPLATES.md` still applies for client work.

## Options for the bake

**A. Add `--bake` to `template:import` (recommended).**
- Export the `CAPTURE` script from `src/components/dev/bake.ts` and run it in Playwright's Chromium, which `samples:screens` already uses.
- Add an optional bake recipe to the hints file for multi-view apps, for example `{ "bake": { "click": "#si-skip", "pages": { "overview": "go('overview')", … } } }`.
- One source of truth for the capture, and a repeatable process when the designs change.

**B. One-off bake script, then a normal import.** A throwaway script writes `<slug>/<page>/code.html` folders, as in this investigation, and you import those. It's quicker today, but it has to be redone by hand on every design revision, and the baked HTML is what ends up as the "source" for **Edit HTML**.

**C. Upload through the developer panel.** It already bakes, but uploads land in Postgres, and the carousel only reads repo templates. It also can't handle the portal's sign-in or its six views.

## Proposed implementation (option A)

1. **CLI bake.**
   - Accept a single `.html` file as input, as well as a zip or folder.
   - Add `--bake`, which uses Playwright with the shared `CAPTURE` script.
   - Add a `bake` recipe to `BehaviourHint` files: a click before capture, plus named page steps.
2. **Hints.**
   - `scripts/template-hints/bellbird-portal.json`: the bake recipe, `#/view` hrefs rewritten to page links, and `data-go` buttons turned into links.
   - Add hints for the other files as their reports need them.
3. **Fix the sources.** Darken the dashboard's `--muted` and confirm the accent.
4. **Import and publish:**
   ```sh
   npm run template:import -- ~/Downloads/homeware-template.html --slug oakwell-home --name "Homeware store" --type ECOMMERCE_STORE --bake
   npm run template:import -- ~/Downloads/client-portal.html --slug bellbird-portal --name "Client portal" --type WEB_APP --bake --hints scripts/template-hints/bellbird-portal.json
   npm run template:import -- ~/Downloads/executive-dashboard.html --slug ridgeline-dashboard --name "Executive dashboard" --type WEB_APP --bake
   ```
   Review each one at `/build?template=<slug>&review=1`, then run `npm run template:publish -- <slug>`. Use new slugs: these are different designs, not new versions of `aurelia-*`.
5. **`src/content/samples.ts`:**
   - Replace the three entries with new tokens, slugs, titles and descriptions.
   - Keep the order (advisory, store, portal, dashboard, tattoo) unless the extra samples go in too.
6. **Screens.**
   - With `npm run dev` running, run `npm run samples:screens -- oakwell-home bellbird-portal ridgeline-dashboard`. That's 8 captures: 1 + 6 + 1.
   - Delete the three old `public/images/samples/aurelia-{store,portal,insights}-v1-home.webp` files.
   - The `samples.test.ts` "every page has a captured screen" test enforces this.
7. **Optionally unpublish the old three:** `npm run template:publish -- aurelia-store --version 1 --unpublish`, and the same for the other two. That removes them from the picker without breaking saved sites.

## Open questions

- **Trades, advisory and real estate:** add them as extra samples (8 in all), or use Harlow & Pike to replace `aurelia-advisory` too? Trades can be imported today without a bake.
- **Portal:** six pages as above (richer, heavier), or only the Overview?
- **Should the sample portal keep the sign-in screen as its first page?** It shows the product's "secure" angle, but makes a dull carousel slide. The recommendation is Overview first, without the sign-in screen.
