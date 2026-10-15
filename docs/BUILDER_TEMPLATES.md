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
- **Edit layout.** A locked `DesignSection` can be taken apart into **design pieces**, one block per element, in one undoable step:
  - the pieces are `Box`, `DText`, `DImage`, `DLink`, `DIcon`, `DField` and `DRaw` (`src/components/builder/blocks/elements.tsx`)
  - they're built by `sectionToElements()` in `src/lib/builder/elements.ts`
  - pieces and builder blocks nest inside each other freely, except that links never hold links
  - a section taken apart renders exactly like the locked one (unit-tested on every Noir section)
- **Style panel.** Each piece gets plain controls (`src/components/builder/style-field.tsx`):
  - arrangement, columns that become one column on phones, spacing, width
  - colours, text size, weight and font, corners, shadow
  - which screens it shows on

  They use the template's own colours, type scale and radii, read from its CSS. Each control rewrites only its own group of classes (`src/lib/builder/class-groups.ts`), so the design's other classes and its hover and dark variants stay put.
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
