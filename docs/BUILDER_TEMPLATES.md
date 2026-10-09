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

## Image rights

Images in an export (e.g. Stitch's) may be AI-generated or stock. Swap in licensed or client photography before using a template for real client work.
