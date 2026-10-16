# Designer templates for the site builder

The builder at `/build` offers two kinds of templates:

- **Starter templates.** These are built from native blocks and live in `src/components/builder/templates.ts`.
- **Designer templates.** These are imported from a design export, such as a Google Stitch zip, by the importer below.

When you import a design:

- Each page becomes a builder page.
- Each section becomes a block that visitors can move, duplicate or delete.
- Every text, image and link inside a section is editable from the side panel.
- Repeated cards, steps and links become lists that visitors can add to.
- The layout inside each section stays exactly as designed.

## Uploading on the live site (no code or deploy needed)

Developers can upload HTML designs straight on the site:

1. On any page, press **⌘/Ctrl + Shift + Alt + T** to open the developer panel.
2. Enter your name and the shared developer password. A session lasts 8 hours. After 5 wrong attempts from the same address, wait 15 minutes.
3. Go to **Upload**:
   - Give the template a name; the slug stays the same across versions.
   - Pick the website type.
   - Add one or more `.html` files. The first is the home page; use the arrows to reorder.
   - Optionally add a `DESIGN.md` and a screenshot per page (screenshots become the picker thumbnails).
4. The upload becomes a **draft**:
   - Fonts and images are downloaded into the template (public `https` addresses only).
   - Check the "things to check" list.
   - In **Theme colours**, pick from the design's own colours which ones native blocks should use (accent, background, text, muted).
5. **Open review** shows the draft in the builder with a review banner. Only developers can see drafts. Check each section, then press **Publish**. It appears in every visitor's template picker straight away.
6. **Templates** lists everything uploaded:
   - **Publish** and **Unpublish** versions. Unpublished versions disappear from the picker, but designs made with them keep working.
   - **Delete** drafts.

Uploading the same slug again creates a new version; earlier versions never change.

**Limits:**

| What | Limit |
| --- | --- |
| Upload size | 4 MB |
| Pages per template | 12 |
| Size per HTML file | 1 MB |
| Downloaded images and fonts per version | 10 MB |

**Setup.** Run `npm run template:password` and set the two values it prints in Vercel (Production and Preview):

- `TEMPLATE_UPLOAD_PASSWORD_HASH`
- `DEV_SESSION_SECRET`

Without them, the panel says uploads are off. To change the password, set a new hash; to sign everyone out immediately, also set a new secret.

**Where uploads live.** Uploaded templates are stored in Postgres: tables `BuilderTemplate`, `BuilderTemplateVersion` and `BuilderTemplateAsset`. They're served from `/build/t/<slug>/v<N>/…`, and templates committed to the repo (below) are served from the same route. Repo templates can't be changed from the panel.

## Importing templates into the repo (CLI)

## 1. Import

```sh
npm run template:import -- ~/Downloads/stitch_export.zip --slug noir-needle --name "Tattoo studio" --type BUSINESS \
  --description "Dark, editorial four-page site for a studio or atelier."
```

**Input:** a `.zip` or folder containing:

- one folder per page with a `code.html`
- optionally a `screen.png` per page, used for the picker thumbnail
- optionally a `DESIGN.md`; the tokens in its frontmatter override the page's Tailwind config

Or a single hand-written `.html` page, imported as a one-page template.

**Templates whose script builds the page (`--bake`).** Many hand-written designs keep their content in the script, such as product cards, listings, charts, KPI tiles or a client portal's views. They render it into empty containers, and the importer never runs scripts. `--bake` first runs each page once in a headless browser, using the same capture as the developer panel's upload (`src/lib/builder/bake-capture.ts`):

- The capture scrolls through the page, so content that appears on scroll is built too.
- It waits for count-ups and bars to finish, then imports what the script left behind.
- It takes a screenshot as the page's thumbnail when the export has none.

Motion the script set inline (a card mid-transform, a measured offset) goes back to the design's own value. Sizes and variables it set from data, such as a bar's width, are kept.

A page that holds several views (an app whose script switches them), or that needs a few steps before capture, gets a **bake recipe** in its hints file:

```json
{
  "bake": { "pages": [{ "dir": "overview", "before": "enterApp(); await wait(500); go(\"overview\");" }] },
  "behaviours": [{ "selector": "#stack", "set": { "data-vt-stack": "swipe status:st-count" } }]
}
```

- **Pages:** each recipe page is the export's first page, run with its `before` steps. The steps are an async function body that can call the page's own functions and `await wait(ms)`. Pages come in the recipe's order, and the first is the home page.
- **Changing the page before capture:** steps can also add a `data-path` to a link so it points at another page, wrap a chart and its table into tab panels, or add a `<style>` for a state the builder sets.
- **Behaviours:** `behaviours` holds the usual hints.

Examples: `scripts/template-hints/bellbird-portal.json` (six views as six pages), `oakwell-home.json` (a 3D product carousel whose headline and price follow the front card, through `data-vt-carousel`), `ridgeline-dashboard.json` (chart and table tabs) and `wren-vale-property.json` (lazy photos and the thank-you messages a script would write).

**What else the importer does for hand-written pages:**

- **Theme.** It reads the background, text colour and fonts the page actually uses (`body` and `h1` rules, through `var(--…)`). Headings follow the design's own stylesheet, not the builder's heading font (`handWritten` in the package).
- **Layout.** A block the stylesheet lays out as a grid of cards stays one section, so the cards still line up.
- **Lists.** Siblings only become an editable list when they look alike: same classes, styles, icons and chosen state. Otherwise the first item's look would be copied onto every row.
- **Captured states.** A state class a captured page left on an element no interaction runs, such as the current room in a walk-through, stays. The stylesheet matches either that class or the builder's runtime state.
- **Design data.** `data-*` attributes the stylesheet styles by (`content: attr(data-mark)`) are kept as `data-vt-x-*`.
- **Count-ups.** A count-up shows the number it counts to (`data-n`, `data-to`…), not the one the capture caught.
- **Menus.** A menu the design shows with `.on` opens with that state (`data-vt-toggle="menu on"`).
- **Same in the editor.** A section taken apart into design pieces renders the same markup, inline styles and text effects as the locked section a sample shows (unit-tested on every repo template, `tests/unit/builder-elements.test.ts`).
- **Stand-ins.** A button that navigates to a page becomes a link that keeps the design's `button` rules (`vt-as-button`). An `<output>` becomes a span that keeps its `output` rules.

**What the importer does:**

- **Downloads everything into the package.** That includes Google Fonts (only the icon font's used icons) and every image, re-encoded as WebP. A template never loads anything from another site.
- **Keeps background photos.** A photo set as an inline `style="background-image: url(…)"` becomes an editable "Background image" field. This also works on a design piece's group once a section is taken apart.
- **Compiles the design's Tailwind classes** with Tailwind v4 into `theme.css`. Classes are prefixed (`vt:`) and scoped to the template, so they can't affect the site or other templates.
- **Removes scripts, `on…` handlers, `javascript:` links and non-https embeds.** Interactive parts show their first state: tabs, filters, sliders, multi-step forms. Sections that are hidden until a script shows them, such as modals, are left out.

**Output:**

| Path | What |
| --- | --- |
| `public/builder-templates/<slug>/v<N>/` | `template.json`, `theme.css`, fonts, images and thumbnails (served as static files) |
| `src/content/builder-templates/reports/<slug>-v<N>.md` | The import report (not served) |
| `src/content/builder-templates/manifest.json` | The template list. Edit it only through these commands |

**Options:**

| Option | Use it when |
| --- | --- |
| `--map <folder>=<link>` | The report pairs a page folder with the wrong `data-path` link |
| `--version N --force` | Re-importing a version that hasn't been published yet |
| `--offline` | Trying an import without the network; fonts and images become placeholders |
| `--bake` | The page's script builds part of it (see above) |
| `--hints <file>` | The template has scripted parts the importer can't recognise on its own, or a bake recipe |

## 2. Review

Read the report, then open `/build?template=<slug>&review=1` while running the app in development. The review banner shows the report and a checklist of every section. Compare each page against the export's `screen.png` at desktop and phone widths.

**Unpublished versions only appear while developing.** They never show up in production.

## 3. Publish

```sh
npm run template:publish -- noir-needle            # latest version
npm run template:publish -- noir-needle --version 2
npm run template:publish -- noir-needle --version 1 --unpublish
```

Commit the manifest and the package folder.

**Versions are immutable.** To change a published template, import it again as a new version:

- New sites start from the newest published version.
- Designs already submitted keep rendering with the version they were made with, even after it's unpublished.

## 4. Showcase it as a sample website (optional)

The home page's "Tailored services" section shows sample websites in a diagonal carousel. To add a template to it, add an entry to `SAMPLE_SITES` in `src/content/samples.ts`:

- a new token, from `node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))"`
- the slug and version
- a title and a one-line description

**What the entry does:**

- `/build/preview/<token>` renders the whole template as a read-only sample. No database row or lead is involved.
- The carousel shows each page's landing screen. With `npm run dev` running, capture them with `npm run samples:screens` (add a slug to capture just that sample). Each one is the first screen of the live preview at tablet size, saved to `public/images/samples/`. Pages without a capture fall back to the template thumbnail, and a unit test fails until every page has one.
- Hovering any slide shows a card with the sample's second page.

**When samples appear:**

- The carousel needs at least two samples that are visible. Otherwise the section keeps the service cards.
- In production, only published versions count.
- A sample whose pinned version isn't the template's latest import is skipped. The manifest only lists thumbnails for the latest version.

## How it fits together

- **Site documents.** Visitors' sites are saved as a list of pages (`src/lib/builder/site-doc.ts`). A site made from a designer template stores `templateRef` (slug and version). Its sections are `DesignSection` blocks that hold only the visitor's values, never markup.
- **Rendering.** `src/components/builder/node-tree.tsx` renders sections from the package's JSON tree with `React.createElement`, with no HTML injection. It refuses scripts, handlers and unsafe links even if someone edits a package by hand.
- **Validation.** On submit, `src/server/builder/design-validation.ts` checks every section and value against the package on disk:
  - section ids must exist in the package
  - field names must belong to the section
  - links must be safe, or point to a page of the site
  - images must be inside the package or use `https:`
  - lists are capped in length
- **Theme.** The design's theme also becomes builder theme tokens (`src/lib/builder/theme.ts`). Native blocks dropped into an imported template match its colours and fonts.

## Building with blocks and HTML together

Visitors can mix a template's sections with the builder's own blocks, and change the inside of a section.

- **Match design.** Native blocks (Heading, Button, Pricing…) on a template site have a *Style: Match design / Simple* option. "Match design" uses the template's own classes for headings, text, buttons, cards, sections and images. These are derived from its sections by `deriveKit()` in `src/lib/builder/template-kit.ts`.
- **Everything is draggable from the start.** When a visitor opens a template in the editor, from the picker, a `?template=` link or **Add page**, every section arrives already taken apart into design pieces. The header, images, buttons, cards and texts can be selected, dragged, duplicated, deleted and styled straight away (`docFromTemplate(pkg, "pieces")` in `src/lib/builder/template-doc.ts`). The team's template review (`&review=1`) and the read-only previews keep whole, locked sections.
- **The template's own sections in the Blocks panel.** On a template site, the panel starts with a "<template> sections" group: one block per section of the template, with headers and footers that repeat on every page listed once (`src/components/builder/template-blocks.tsx`). Drag one anywhere and it arrives as design pieces, with links to the template's pages pointing at the site's own pages. **Add a section** (toolbar) does the same, at the bottom of the page.
- **Drops land between sections.** Puck only drops into the innermost zone under the pointer, and a template's pieces fill each section. So a whole page section, whether a ready-made one (Hero, Pricing…), a native Section or a template section, dropped onto a design is moved out beside the section it was dropped on (`tidyDrops`, in the same undo step). Content blocks such as Heading, Text or Button stay where they're dropped. Empty layers the design positions over or behind content (glows, overlays) are marked `decor` and are plain elements, not drop zones.
- **Ready-made blocks match the design.** With *Style: Match design*, native blocks use the template's heading, text, button, card and section classes. Headings and body text drop the design's text colour, since a headline taken from a dark hero would be white on a light section, and inherit the colour of where they're placed (`kitOf` in `src/lib/builder/template-kit.ts`). Labels and buttons keep theirs.
- **Pages.** **Add page** starts a page blank or from any page of the template, also as design pieces.
- **Edit layout.** A locked `DesignSection` (sites saved before this change, or added in review) can still be taken apart into **design pieces**, one block per element, in one undoable step:
  - the pieces are `Box`, `DText`, `DImage`, `DLink`, `DIcon`, `DField` and `DRaw` (`src/components/builder/blocks/elements.tsx`)
  - they're built by `sectionToElements()` in `src/lib/builder/elements.ts`
  - pieces and builder blocks nest inside each other freely, except that links never hold links
  - a section taken apart renders exactly like the locked one (unit-tested on every Noir section)
- **Style panel.** Each piece gets plain controls (`src/components/builder/style-field.tsx`):
  - arrangement, columns that become one column on phones, spacing, width
  - colours, text size, weight and font, corners, shadow
  - which screens it shows on

  They use the template's own colours, type scale and radii, read from its CSS. Each control rewrites only its own group of classes (`src/lib/builder/class-groups.ts`), so the design's other classes and its hover and dark variants stay put.
- **Per device.** The panel edits the device on the canvas (Desktop, Tablet or Phone). Changes cascade desktop-first, and a device's own value is marked with a **Reset**. It's stored as bare / `md:` / `lg:` classes, and every other device's value is kept (`writeDevice` in `class-groups.ts`). More controls are available too: margins, height, border, opacity, blur, position, stacking, line and letter spacing, and case.
- **Free layout.** "Arrange contents → Free" on a group turns it into a free canvas. Items are pinned where they were, then dragged, resized and snapped with smart guides; Shift-click selects several, which can be aligned and distributed. Places are `md:` classes, so phones stack (`free-layout.ts`, `free-canvas.tsx`). Layers can be hidden (left out of the design) or locked in the Outline.
- **Design system.** The Styles tab edits the design's colours, fonts (web fonts served from this site) and text sizes for the whole site. It also holds colour styles and text styles that pieces use by name. Any block can become a component whose copies follow it (Assets tab). See `docs/BUILDER_ROADMAP.md`, phase 3.
- **Content.** The Content tab holds collections (a ready-made Blog), their items and the site's menus. A Collection list repeats a designed card per item, item pages show one item, groups of links can follow a menu, and pages have search and sharing details. See `docs/BUILDER_ROADMAP.md`, phase 4.
- **Media and effects.** Pictures can be uploaded (stored privately and re-encoded on the server), cropped to a shape with a focal point, and pieces can animate in as they scroll into view or on hover. There's a Rich text piece, plus Numbers, How it works, Gallery, Team and Logos sections. See `docs/BUILDER_ROADMAP.md`, phase 5.
- **Interactions.** Templates' scripts never run. The importer recreates what they did with the builder's own interactions: reveals, headings whose words slide in, count-ups, endless photo walls, menus, accordions, tabs, card stacks, scroll-spy navigation and forms. Visitors add and change interactions in the Style panel's Interactions group, and see where every link goes with **Wiring**. For a template's own scripted parts the generic rules don't catch, add a hints file (`scripts/template-hints/<slug>.json`, `--hints`). Hand-written templates (no Tailwind) keep their own stylesheet, scoped and prefixed. Section names are cleaned, and sections are grouped by kind in the Blocks tab. See `docs/BUILDER_ROADMAP.md`, phase 6.
- **Shortcuts and layers.** ⌘C/X/V copies, cuts and pastes, also between pages. ⌘D duplicates, Alt ↑/↓ moves, Esc selects the parent, and ? lists the shortcuts (`shortcuts.tsx`). The Outline panel names each layer and can rename it (`layers.tsx`, stored as `name`). The plan beyond this is in `docs/BUILDER_ROADMAP.md`.
- **Advanced.** "Show class names (advanced)", remembered per browser, adds:
  - a raw **Classes** field, written without the `vt:` prefix
  - **Edit HTML** for a piece or a whole locked section. The server reads the HTML back through the importer's sanitiser (`src/server/builder/html-pieces.ts`, rate-limited, 50 KB, at most 1,500 elements). Builder blocks inside show as `<!--block:…-->` markers and are put back where the markers are.
- **New classes.** Classes a template's stylesheet doesn't have are compiled on demand:
  - by `POST /api/builder/css` (`src/server/builder/css-service.ts`), against the template's own theme
  - sites without a template compile against the site theme, scoped `[data-vt="site"]`
  - results are cached in memory and in the `BuilderCssCache` table
  - the team's design preview compiles them on the server
  - sites store only class names, never CSS
- **Checks on submit.** `src/server/builder/piece-validation.ts` checks every piece: tags, attributes, class tokens, text length, links, image addresses, and limits of 3,000 pieces and depth 40.

## Image rights

Images in an export (e.g. Stitch's) may be AI-generated or stock. Swap in licensed or client photography before using a template for real client work.
