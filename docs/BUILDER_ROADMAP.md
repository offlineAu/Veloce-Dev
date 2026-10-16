# Site builder roadmap: Wix + Figma + WordPress

The builder stays a **lead tool**. Visitors design a site, then send it with an inquiry, and the team builds the real thing, so there is no hosting, no accounts and no billing. Within that, the goal is an editor that combines:

- **Wix's** editing comfort
- **Figma's** free canvas and design system
- **WordPress's** content model

Each phase ships on its own.

## Where it started (October 2026)

**What existed:**

- A section-and-block editor on Puck 0.23.
- Designer templates open as draggable design pieces.
- Template sections and ready-made sections drop between sections (`tidyDrops`).
- Strict server checks on submitted designs (`siteDraftSchema`, `checkPieces`, `checkDesignSections`).
- Drafts live in the browser (localStorage) and are sent once, as a `SiteDraft`.

**What was missing:**

- Styles per device: one style applied to every screen, and changing padding wiped a design's tablet and desktop padding.
- Margin, border, opacity, height, position and stacking controls.
- Copy/paste, multi-select and shortcuts.
- A readable layers panel.
- Free positioning.
- Media upload (images were URLs only).
- Linked components and shared styles.
- Collections, SEO fields and menus.

## Phase 1: Editor foundations (done)

**Styles per device.** The canvas shows Desktop (1280), Tablet (768) or Phone (375), and the Style panel edits the device on the canvas.

- Changes cascade desktop-first, as in Wix or Webflow: a desktop change reaches smaller devices unless they have their own value.
- Values are stored mobile-first as Tailwind classes (bare, `md:`, `lg:`).
- A device's own value is marked "● Phone only", with a **Reset**.
- Writing one device keeps every other device's value.
- Code: `deviceValues`, `writeDevice` and `ownOn` in `src/lib/builder/class-groups.ts`; the panel is `style-field.tsx`.

**Full style controls.**

- Margins (above, below, sides, centre).
- Height and minimum height.
- Border width, line and colour.
- Opacity ("see-through") and blur.
- Position: in the flow, pinned inside its group, sticky or fixed, with offsets.
- Stacking (bring forward, send back).
- Line spacing, letter spacing and letter case.

**Clipboard and shortcuts.** In `src/components/builder/shortcuts.tsx`:

| Shortcut | What it does |
| --- | --- |
| ⌘/Ctrl C, X, V | Copy, cut and paste, also between pages |
| ⌘/Ctrl D | Duplicate |
| Alt ↑/↓ | Move up or down |
| Esc | Select the parent |
| ? | Show the shortcut list |

The block toolbar also gets Copy and Paste buttons.

**Layers panel.** In `src/components/builder/layers.tsx`:

- Outline layers show readable names: section names from the template, the start of a text, an image's description.
- Double-click a layer to rename it. The name is stored as `name` and is at most 60 characters.

**Fixes found along the way:**

- Decorative layers (glows, overlays) no longer catch clicks or drops meant for the content under them.
- Template headings and text no longer carry the design's text colour into native blocks.

## Phase 2: Free canvas (Figma) (done)

**Free layout.** A group's "Arrange contents" has a **Free** option.

- Switching to Free measures each item on the canvas and pins it where it was: nothing jumps.
- Items get a place (left, top, width, and a height for images) as `md:` classes. They're placed from tablets up; on phones they stack in the flow, so nothing runs off a small screen.
- The desktop and tablet can differ (`lg:`), and changes cascade as with every style.
- The group gets `md:relative` and a minimum height that grows to fit its items.
- Switching back to another arrangement returns the items to the flow.
- Code: `src/lib/builder/free-layout.ts`.

**On the canvas.** In `src/components/builder/free-canvas.tsx`, rendered inside the canvas:

- The selected item gets a frame to drag and eight handles to resize. Shift keeps the proportions on corners.
- Smart guides snap to the group's edges and centre and to the neighbours' edges and centres. Alt turns snapping off.
- Arrow keys nudge 1px; Shift+arrows nudge 10px.
- Double-click a text to type in it.
- Every move or resize is one undo step.

**Multi-select.** Shift-click items of the same free group. They drag together, and a toolbar under them aligns (left, centre, right, top, middle, bottom) and spaces them evenly.

**Drops into a free group.** A block dropped into a free group gets a place near its top-left corner. Builder blocks (Heading, Button…) are wrapped in a positioned group.

**Lock and hide.** Eye and lock buttons on every layer in the Outline:

- A hidden layer fades in the editor and is left out of the preview, the sent design and the team preview.
- A locked layer can't be dragged, deleted or moved on the canvas.
- They're stored as `hidden` and `locked` (switches checked on the server).
- Code: `withLayerFlags` in `blocks/elements.tsx`.

**Fixed along the way:**

- **Double undo.** One ⌘Z undid two steps. `<Puck>` was given `<Puck.Layout />` as a child, which nests two layouts that both listen for shortcuts. The editor's extras now live in Puck's `puck` override.
- **Collapsing groups.** Puck's slot styling reset a group's own minimum height, so a free group collapsed to 0px. `PIECE_CSS` now reverts it.
- **No remount.** The editor now mounts once its template has loaded, instead of remounting when it arrives.

## Phase 3: Design system (Figma) (done)

**Styles tab.** A new tab in the left sidebar, `src/components/builder/styles-panel.tsx`:

- **Colours.** Every colour of the template can be changed, each with a reset back to the design's own. The template's named colours are listed first; Tailwind's stock palette is under "More colours". On sites without a template, the theme's colours are edited instead.
- **Fonts.** Each of the design's fonts (or the theme's heading and body fonts) can be swapped for one of 20 web fonts.
- **Text sizes.** The template's own named sizes are editable.
- **How it's stored.** Changes are kept as token overrides in `SiteDoc.styles.tokens` and written as CSS variables scoped to the design (`stylesCss` in `src/lib/builder/site-styles.ts`).

**Web fonts from this site.** `/api/builder/fonts` fetches a font's stylesheet from Google on the server, for listed families only, and rewrites its files to `/api/builder/fonts/file`. Visitors' browsers never contact Google, and both routes are cached.

**Colour styles.** Named colours become CSS variables (`--vs-<id>`). They come first in every swatch row of the Style panel, and pieces use them as classes such as `text-(--vs-brand)`. Changing a colour style changes it everywhere.

**Text styles.** Named text looks ("Heading 1"):

- Save one from the selected text, or apply one from the Text group.
- A piece following a style stores `textStyle`. Its own text classes give way to the style, and the style's classes are added when it renders (`withLayerFlags`).
- Editing the style in the Styles tab changes every text using it. "Detach" copies the look back onto the text.

**Components.** In `src/lib/builder/components.ts` (rules) and `src/components/builder/component-tools.tsx` (editor):

- **Making one.** The block toolbar's component button turns any block into a main component, stored in `SiteDoc.components`.
- **Copies.** Copies are inserted from the Assets tab. When the main one changes, every copy on every page takes the change, but keeps its own texts, images and links where they were changed in that copy.
- **Matching parts.** Parts are matched by a `ckey`, and the last synced main tells an override from a value that should follow.
- **On a copy.** "Go to main component" and "Detach". A duplicated main becomes a copy; if the main is deleted, a copy can take over.
- **In the editor.** Mains and copies have violet outlines.

**Assets tab.** The site's components (insert a copy) and every image used on the site (put one on the selected image or group).

**Validation.** Styles are normalized whenever a site is read. Component blocks are checked like a page, and the pieces' `textStyle`, `component` and `ckey` props are checked too.

**Fixed along the way:**

- **Design headings.** The canvas forced the theme's heading font on every heading, overriding a design's own heading fonts. Headings that name a font now keep it.
- **Editor markers.** Layer and component markers are now render-time classes: groups keep the element they mounted with, so attributes set through the ref didn't follow later changes.

## Phase 4: Content (WordPress) (done)

The rules are in `src/lib/builder/content.ts` (no React); the editor parts are in `src/components/builder/content-tools.tsx`.

**Content tab.** A new tab in the left sidebar:

- **Collections.** "Add a blog" makes a Blog (title, summary, image, date, text) with three sample posts. "New collection" starts one from scratch. Each collection has a name, a name for one item ("post"), fields (short text, long text, image, link, date) and items.
- **Items.** Items are added, edited, reordered and deleted in the panel. Each gets an address (slug) of its own. Image and link values must be safe addresses: images are https or the template's own files, the same rule as an image piece.
- **Menus.** A main menu and a footer menu, each a list of labels going to one of the site's pages or a web address. "Start with every page" fills one in. Page settings has an "In the main menu" switch.

**Collection list.** A "Collection list" block (Blocks tab, Collections):

- **Dropping one.** It becomes a group that repeats a card for each item, with a card made from the collection's fields. On a site without collections, a Blog is made first.
- **The design card.** The first card is the design: edit it, and every card follows. The others are copies, which can't be edited, dragged or deleted on their own (`listCopy`, `resolvePermissions`).
- **Settings.** Order and number of items are in the Style panel (newest, oldest, A to Z, or as in the Content tab; up to 200). Any group can become a list there too ("Repeat for a collection").
- **How it's stored.** Lists are written out as ordinary pieces (`syncList`): the copies have ids made from the design's and the item's, so a sync with no changes changes nothing, and a sent design needs no special rendering. The open page is synced by `ContentSync` as content changes; other pages are synced when the Content tab changes them.

**Bindings.** "Content from" in the Style panel binds a text, image, link or background photo to an item's field, or binds a link to the item's own page. It's offered for parts of a list's card, and for any part of an item page. Bindings are stored as `bind` (`{ content: "title" }`). A text's words are bound as `content`, not `text`, because Puck rewrites every `text` key in a block's props for typing on the canvas, nested ones included.

**Item pages.** In the page panel, "This page shows one item of" makes a page the item page of a collection, and "Preview with" picks the item shown while editing.

- **Showing the item.** The page root provides the item (`ItemContext`), and each bound part shows its field when it renders (`withLayerFlags`). Lists on the page keep showing their own items.
- **Links.** Links to an item are `page:<id>/<slug>`. In the team preview they open `?page=/<path>/<slug>`, or `/<slug>` when the home page shows the items.

**Menus on the canvas.** "Follow the site menu" (Style panel, for a group with links) writes the group out from the main or footer menu, on every page (`syncMenu`). A plain link of the group is the design for every entry: one not marked as the current page, whose `aria-current` is dropped. Other children of the group are replaced by the menu's links.

**Search and sharing.** Page settings has a title, description and sharing image (`seo` on the page root). The team preview uses them for the page's metadata, or an item's title, summary and image on an item page. The preview is still never indexed.

**Validation.** Collections, menus and page settings are normalized whenever a site is read (`migrateDoc`). Submitted pieces' `bind`, `list`, `listCopy`, `listItem`, `menu` and `menuItem` are checked (`piece-validation.ts`), and item links must name an existing page.

Limits:

- 10 collections
- 20 fields per collection
- 200 items per collection
- 30 links per menu

`MAX_SITE_BYTES` (2 MB) still caps the whole site. A very content-heavy blog is told it's too large rather than accepted.

**Not built:**

- A filter on lists. Lists have order and limit only.
- Rich text in items. Long text is plain.
- Picking an item image from the Assets tab. Item images are typed as addresses.

## Phase 5: Media and effects (Wix) (done)

**Image upload.** Visitors upload pictures in the builder:

- **Where.** The Upload button sits under every image address: image pieces, group backgrounds, the Image and Hero blocks, collection item images, the sharing image and the new sections' pictures. The Assets tab can also upload and use one straight away, and lists this browser's uploads first.
- **Storage.** Uploads go to a private Vercel Blob store (`veloce-builder-media`, connected to every environment) through `POST /api/builder/media`. They're shown through `/api/builder/media/<id>.webp`, which caches for good because ids are random and files never change.
- **Safety.** The server takes JPEG, PNG, WebP, AVIF or GIF only, up to 5 MB and 40 megapixels. It decodes and re-encodes every file to WebP (at most 2400px), so location and camera details are gone and nothing hidden in a file survives. SVG and HEIC are refused.
- **Limits.** Uploads must come from this site's own pages (Origin check), with at most 30 an hour and 100 a day per address.
- **How long they're kept.** Uploads stay 30 days unless a sent design uses them. Sending a design copies its uploads to `kept/` (`keepMedia`, in `lead.ts`).
- **Cleanup.** `POST /api/builder/media/maintenance?dryRun=true|false` (bearer `PRIVACY_CRON_SECRET`) deletes uploads past 30 days, and kept files that no stored design refers to any more. A kept file goes once privacy retention deletes its lead and design. **It needs a daily schedule, like the privacy cleanup.**
- **Code.** `src/server/builder/media.ts` (rules) and `src/components/builder/media-tools.tsx` (editor).

**Crop and focal point.** For image pieces, in the Style panel and per device:

- **Shape.** Square, 4:3, 16:9, 21:9 or 3:4. The image fills the shape.
- **Focal point.** Click the part of the picture that must stay in view.
- **How it's stored.** As classes (`aspect-…`, `object-cover`, `object-[x%_y%]`), so nothing new to validate.

**Animations.** For any design piece, in the Style panel's Animation group (`src/lib/builder/motion.ts`):

- **Entrances.** Fade in, rise, grow in, from the left or from the right, as the piece scrolls into view. These are CSS scroll-driven animations, with no script in the editor or the preview. Browsers without them simply show the piece.
- **Hover effects.** Lift, grow or dim.
- **Reduced motion.** Both are off for visitors who prefer reduced motion.
- **How it's stored.** As one `vt-enter-…` and one `vt-hover-…` class. They animate `transform` and `opacity`, which Tailwind v4's own translate and scale utilities don't use, so a piece keeps its own placement.

**Rich text.** A new **Rich text** design piece, edited on the canvas with Puck's `richtext` field (Tiptap):

- **Formatting.** Paragraphs, headings 2 to 4, bold, italic, underline, strike, links, lists and quotes.
- **Sanitizing.** When a design is sent, the server keeps exactly that and removes everything else (`sanitizeRichText`), with links going only to web, email and phone addresses.
- **Collection text.** It can show a collection's long text (Content from), such as a blog post's body. The field's text is escaped into paragraphs (`textToParagraphs`) and never read as HTML.
- **Edit HTML.** It stays whole there, like a builder block.
- **Template text not replaced.** It doesn't replace a template's own texts. Puck renders rich text inside a wrapping `div`, which would break a design's `h1` and `p` markup.

**More ready-made sections.** Numbers, How it works, Gallery, Team and Logos (`src/components/builder/blocks/more-sections.tsx`). They match a template's own headings, text, cards and images with "Match design", like the others.

**Not built:**

- Cropping the stored file. Crop and focal point are display classes, and the whole picture is kept.
- A shared media library across browsers. There are no accounts, so each browser lists its own uploads.

## Phase 6: Interactions and prototype (done)

**Built-in interactions.** Templates' own scripts never run. Instead the builder runs a vetted set of interactions itself: `src/lib/builder/behaviours.ts` holds the rules, and `src/components/builder/behaviours.tsx` is the runtime.

- **How a part gets one.** Each interaction is one allow-listed attribute on the part it applies to, `data-vt-<name>`:
  - **Scrolling:** `reveal`, `split` (words slide in), `count`, `flip`, `seq`/`transient` (a sequence, e.g. typing dots then bubbles).
  - **Hover:** `roll` (letters roll), `spotlight`, `pointer` (light follows the pointer).
  - **Motion:** `marquee` (endless scroll, x or y).
  - **Opening and switching:** `toggle` (open or close a part), `accordion`, `alt` (+/−), `tabs`, `stack`/`step` (a card stack with next/previous), `spy` (the navigation marks the section in view).
  - **Forms:** `filter`, `form` (checks required fields and shows a thank-you message; never sends).
- **What's allowed.** The importer, pieces, locked sections and the server all use the same value rules (`parseBehaviour`). Anything else is dropped or rejected.
- **Where it runs.** It's mounted in the page root, in the editor (inside Puck's iframe), in Preview and in the team's preview. It never runs inside thumbnails (`metadata.static`).
- **What it's allowed to change.**
  - It writes only `data-vt-state` (in, open, on, hit, dim, invalid), ARIA states, `--vt-*` properties, text it formats itself, and cleaned copies of a marquee's first child (`data-vt-clone`, inert, no ids).
  - It never uses `innerHTML`, `eval` or the network.
- **Editing and reduced motion.**
  - In edit mode motion plays, but clicks belong to the editor.
  - While a block is dragged, everything holds still (`data-vt-busy`).
  - With reduced motion nothing animates, and everything shows in its finished state.
- **The editor's scaled-down frame.** Visibility uses `visibleRange`: the canvas is a scaled iframe, so what's on screen is worked out from the frame's rectangle, not the window's.
- **Text effects.** Word, letter-roll and flip spans are rendered by React (`text-effects.tsx`), not written into the page by a script. While text is being edited on the canvas it shows plain.

**Importing interactions** (`src/lib/builder/import/behaviours.ts`, page-css.ts):

- **Common markers are recognised:**
  - `data-reveal`/`data-aos` → reveal
  - `data-split` → split
  - `data-count` → count (moved to the block around the number)
  - a button with `aria-controls` and `aria-expanded` → toggle (`close-links` when its target holds links)
  - a list whose items each have an `aria-expanded` button → accordion
  - a navigation of in-page links whose script marks one active → spy
  - a form next to a `role=status`/"success" element → form
  - From the CSS (read, never run):
    - Keyframes that slide by a variable the script sets, such as `translateY(calc(var(--shift) * -1))`, become an endless scroll on the elements that use them. The direction comes from the keyframes, and it pauses on hover if a `:hover` rule pauses it. This is how an uploaded photo wall works without hints.
    - Classes whose rules only apply once the script adds a reveal class (`.bento.in .card`, `.bubble.show`) are revealed on scroll, staggered when their children wait a script-set delay. Typing indicators and loaders are never kept on.
- **Hints for one template.** `--hints scripts/template-hints/<slug>.json` handles what can't be recognised in general, e.g. the Kestrel photo wall, review stack, job tabs and message sequence. Each hint is `{ selector, set, remove }`.
- **The design's CSS drives the looks:**
  - Its script state classes become runtime states (`.open` → `[data-vt-state~=open]`).
  - Data-attribute selectors become the behaviours that replace them (`[data-reveal]` → `[data-vt-reveal]`).
  - Variables the script set are renamed (`--d` → `--vt-d`, `--shift` → `--vt-shift`, `--mx` → `--vt-x`).
- **Fallbacks.** Forced "revealed" copies only apply without the runtime (`:not([data-vt-motion])`). Transient parts such as typing dots never get one.
- **The page wrapper.** The page's own html/body rules now land on the template root:
  - `overflow-x: hidden` becomes `clip`, so sticky headers stick.
  - `scroll-padding-top` becomes `scroll-margin-top` on targets.
  - `scroll-behavior: smooth` becomes `--vt-smooth: 1`, which the runtime reads.

**Clean names** (`src/lib/builder/section-labels.ts`):

- **Names.** `cleanLabel` turns export comments into short plain names: "HERO" → "Hero", "SERVICES (bento)" → "Services", "…Mini-Cart Drawer (Hidden by" → "Slide-out mini-cart drawer".
- **Kinds.** `sectionKind` sorts sections into navigation, hero, features, pricing, reviews, FAQ, call to action, contact, gallery, logos, footer, other, and utility (an icon sprite, never offered).
- **Applying them.** `normalizePackage` runs on every template load (client and server), so templates imported earlier get clean names without re-importing. `displayName` shows sites' stored raw names as the clean ones. Names visitors typed are never changed.

**Figma-like editing:**

- **Blocks tab.** The template's sections show as pictures (`section-gallery.tsx`): the real section drawn at desktop width and scaled down, mounted when scrolled into view. They're grouped by kind, with search, and dragged like any block. "Add a section" shows the same pictures and search.
- **Layers.** Names come from the design: aria-label, id, or its own class ("Job wall", "Hero copy", "Book a job button"). Each row has a type icon, and a ⚡ badge marks parts with an interaction.
- **Interactions panel** (Style panel, `interactions.tsx`):
  - **On click:** a page, a section of this page (it gets an id if it has none), a web address, open or close a part, next or previous card.
  - **On hover:** an effect, or a light that follows the pointer.
  - **While scrolling:** an entrance, counting up, endless scroll (direction, speed, pause on hover).
  - **The rest.** Its other interactions show as removable chips.
- **Wiring** (toolbar, `wiring.tsx`):
  - **Lines.** Lines run from every link and button to where it goes: a section (blue), another page (violet, to the page list pinned at the side), or the part it opens (dashed).
  - **Changing a link.** Select a link and drag its handle onto a section or a page to point it there, in one undo step. Click a line to select its link.

**Sites made before a template gained interactions** catch up when opened (`src/lib/builder/template-upgrade.ts`).

- **Matching.** Each section the site still has is rebuilt from the template and walked side by side with the site's own parts.
- **What's added.** Where a part still matches, the template's interactions are added, along with the attributes they work with. Stale ARIA states and script-written styles are cleared.
- **What's kept.** The visitor's own changes stay, and parts whose shape changed are left alone.

**Fixed along the way:** a link or group that holds other parts (a Puck slot) kept the attributes and link it had when first drawn, because Puck doesn't call a slot's ref again. It now redraws when they change.

**Not built:**

- The Kestrel price calculator still doesn't calculate. Its dropdowns are filled in, so it isn't broken.
- The review stack has no "throw" animation; it moves with a transition.
- The live upload uses only the generic rules; hints (for what can't be read from markup and CSS, like the Kestrel review stack or job-list hover) are for the CLI.

