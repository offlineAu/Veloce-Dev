# Developer template list layout investigation

Investigated 2026-10-16 against the supplied screenshot, the current working tree, and the local site at `http://localhost:3000`. This is an investigation and implementation recommendation. Application code was not changed; existing uncommitted work was preserved.

## Implementation follow-up (2026-10-16)

Implemented grouped template cards with latest-version summaries, publication status, author/date metadata, collapsible version history, responsive actions, and a keyboard-accessible Delete menu. The restored HTML source editor remains available for every uploaded version. History expansion, focus, and scroll position are retained when returning from the editor. Mutations provide pending feedback and prevent repeated/conflicting operations.

Review links now include the exact version. The server validates the selection without silently substituting the newest version, and the builder loads the package matching the review banner. Review sessions preserve existing saved designs rather than restoring or overwriting them.

The original work was restored from stash `fd1ffbf710a509427b1fc319962d7536af7c8559` and reconciled with the fix. The stash was retained. Comparison against the restored tracked snapshot showed only the three intended application files changed, plus the new list component/styles, review resolver, regression tests, screenshots, and this follow-up.

Validation:

- TypeScript and scoped ESLint passed; 27 focused tests passed across review version selection, source routes, and developer template behavior.
- Chromium fixture checks passed at 320px, 390px, 820px, and 1440px; WebKit passed at 390px and 820px. Long names/slugs/authors and mixed publication states stayed within the modal. All visible version action targets retained 44px height.
- Browser fixture checks exercised history via keyboard, exact-version links/source loading, returning from Edit HTML with history/focus intact, disabled controls while publishing, the Delete menu, deletion refresh, and repository action restrictions. Chromium's scoped WCAG accessibility scan reported no violations. Fixture mutations did not alter database records.
- An actual local builder review for `oakwell-home` v1 fetched the v1 package even with v2 available, displayed the matching review banner, and preserved an existing saved draft. An invalid explicit version rendered the not-found UI.
- Production build passed with process-only, non-secret local validation overrides for site URL, company email, hash secret, notification/booking flags, and Cal endpoint configuration. The first attempt exposed invalid pre-existing local environment values; no environment files were edited.
- Firefox checks were not run because its Playwright browser executable is not installed. The database-resetting developer E2E suite was not run.

Visual artifacts: `artifacts/dev-template-list-1440.png` and `artifacts/dev-template-list-390.png`.

## Findings

The screenshot shows a structural layout problem. The upload interface has dedicated CSS Module styling, but the Templates view is a minimally styled, automatic-width table. Expanding the modal alone would postpone the wrapping problem.

| Finding | Evidence | Effect |
| --- | --- | --- |
| Columns have no separation contract | `TemplateList` in `src/components/dev/dev-panel.tsx` uses `w-full` and automatic table layout. Only the first body cell has right padding; Version, Status, and By have none. Header cells have no horizontal padding. | Labels visually merge, and long names or button text compete with metadata for space. |
| Actions determine row height | The action `td` itself is `display: flex` with wrapping. Shared small buttons use 44px minimum height, 40px total horizontal padding, and nonwrapping labels; Delete is another 44px square. | Delete wraps onto an isolated second line, leaving large empty areas under other cells. At smaller widths, several lines of actions dominate every row. |
| Version grouping is implicit | `rows.flatMap` produces one row per version, but the name and slug appear only on the first row. All body rows receive the same divider treatment. | Older versions look detached from the template. A template with six versions consumes most of the modal before the next template appears. |
| Visual hierarchy is weak | Each draft has the same bright Publish button; status is plain text, and there is no distinction between latest and historical versions. | Repeated calls to action overpower the information needed to choose the right version. |
| Small screens have no list-specific layout | The list has no responsive card mode or deliberate overflow container. | Narrow columns, fragmented text, and horizontal overflow occur together. |
| Review does not select the row's version | Every row links to `/build?template=<slug>&review=1`. `src/app/build/page.tsx` accepts no version parameter, and `reviewInfo` selects the highest uploaded version. | Clicking Review beside v3 opens the latest version. A polished history view must also make version selection accurate. Changing link text alone cannot fix this. |
| Mutation progress is not reflected in controls | The list sets `aria-busy={pending}` but does not use `pending` to disable Publish, Unpublish, or Delete. | Controls remain clickable during an operation. Include pending/disabled feedback when implementing the new presentation. |

The header and segmented tabs can remain visually consistent with the current panel. Most of the improvement belongs in the template list, rather than a redesign of the whole developer tool or the shared Button component.

## Browser evidence and limits

Chromium was run at 1440px, 820px, and 390px viewport widths, with a 900px viewport height. The actual developer modal was opened using its shortcut, loading its current CSS and shared styles. A browser-only fixture reproducing the current table markup and button sizing was inserted into its content area, using the screenshot's name, slug, four draft versions, and authors. No authenticated template data was read and no upload, publish, unpublish, or delete action was performed.

| Viewport width | Modal width | Table width | First body row height | Action placement |
| --- | ---: | ---: | ---: | --- |
| 1440px | 880px | 790px | 60.5px | All four actions on one line |
| 820px | 796px | 706px | 108.5px | Delete wraps to a second line |
| 390px | 366px | 355px | 204.5px | Four action lines; content overflows the dialog |

At 390px the modal's scroll width was 379px against a 356px client width. The table's Version, Status, and By cells had zero padding at all three widths. The desktop fixture's metadata columns also had no padding even when its buttons fit.

These are layout reproduction measurements, not an end-to-end authenticated session or a pixel-identical recreation of the screenshot. The Delete fixture used a glyph in the same 44px button footprint. Browser zoom and device scale in the supplied image are unknown. The reproduction establishes that the current structure can produce the observed wrapping without a global font-size bug.

## Recommended presentation

Use one bordered card per template, with the newest version visible and older versions in an accessible Version history disclosure. This matches the data model and removes the mostly empty Template column from every historical row.

Each card should contain:

1. A header with the template name, muted slug, and a small source label (Uploaded or Repository). Long names should wrap, and long unbroken slugs should wrap within the card.
2. A version summary: `v6` and a compact Draft/Published/Unpublished badge, followed by `Uploaded by Au · <date>`. `createdAt` is already returned by the list action, so this does not require a new database field. Distinguish “Latest version” from “Published”; a newer draft may coexist with an older published version.
3. An action area with Review, Edit HTML, Publish or Unpublish, and an accessible More menu containing Delete draft when allowed. Keep 44px hit targets, but use local, less padded action styles rather than changing site-wide buttons. Preserve the current repository/upload and status restrictions.
4. A `Version history (5)` disclosure listing older versions with the same version, status, author, date, and version-specific actions. Separate historical entries within the card, and separate template cards with a larger gap.

On wide layouts, place the version summary and actions side by side. When the available card width cannot hold both, stack them deliberately. At phone widths, put Review and Edit HTML on one action line, and Publish/Unpublish plus More on the next. Repository templates should show their existing CLI guidance and only supported actions. Do not leave empty placeholders for unavailable controls.

Use the existing background, line, text, and accent tokens. Aim for 16–20px card padding, consistent 8–12px internal gaps, 16px template titles, 13–14px metadata, and restrained status badges that include text. Keep bright Publish emphasis in the visible version summary; collapsed history avoids repeating it throughout the initial view. These are starting values to validate with the existing typography, not reasons to shrink text or touch targets until the table fits.

The modal can retain its 880px maximum width. Grouping and history disclosure solve the information-density problem at that width. A larger administrative screen can be considered separately if filtering or managing many templates becomes necessary.

## Implementation sequence

1. Extract the list presentation into a focused component and scoped styles. Keep list fetching and existing guarded server mutations intact.
2. Replace the flattened table with grouped cards and version-history disclosure. Show explicit loading and empty states within the same list area.
3. Make Review version-specific end to end: validate an optional version parameter server-side, resolve the matching template package and review information, and retain the existing developer access checks. Ensure the builder loads the same version displayed in its review banner. Existing slug-only links should retain their current default behavior.
4. Add row-specific operation feedback and prevent conflicting repeated mutations while an action is pending. Keep success/error feedback and list refresh. Keep focus usable when deleting an entry or closing the HTML editor.
5. Verify the responsive presentation and version behavior using fixtures containing multiple templates and multiple versions. No schema migration should be needed for the presentation.

If a smaller interim change is needed, retain table-cell display on every `td`, put flex actions in an inner wrapper, add explicit column padding and widths, combine author metadata under version/status, and move Delete into a menu. That improves the desktop table but still requires a phone layout and does not solve the repeated-version density as well as grouped cards.

## Acceptance criteria

- No horizontal overflow at 390px, 820px, or 1440px, or at 200% browser zoom. Card layout responds to the available space rather than assuming desktop viewport means desktop content width.
- Long template names, unbroken slugs, 40-character author names, and Unpublished status stay within their card without covering actions.
- Initial content makes each template's latest version and status clear. Expanding history makes ownership and historical versions unambiguous; latest and published are never conflated.
- Review, Edit HTML, Publish, Unpublish, and Delete operate on the version named beside them. Review v3 must load v3 even when v6 exists.
- Repository templates retain CLI guidance and do not acquire upload-only actions. Only drafts expose Delete.
- History and action menus work with keyboard, expose expanded state and useful accessible names, and preserve focus. Menus remain reachable inside the scrollable modal.
- Buttons preserve at least 44px hit targets, clear focus indicators, and pending feedback. Opening/closing the source editor returns to a usable list location.
- Check one-version and many-version templates, mixed publication states, multiple templates, loading, empty, failure, and mutation refresh states. Confirm the production build's CSS behavior, then smoke-test WebKit and Firefox.

Current `tests/e2e/dev-templates.spec.ts` explicitly skips viewports narrower than 1200px and does not cover list geometry, multiple-version grouping, or selecting an older version for review. The investigation did not run its database-resetting test setup, the full test suite, or a production build.

## Local references

- `src/components/dev/dev-panel.tsx`: modal, toolbar, TemplateList, version action links.
- `src/components/dev/dev-upload.module.css`: existing developer panel and upload styling; no dedicated template-list styling.
- `src/components/ui/button.tsx`: shared 44px minimum small buttons, horizontal padding, and icon sizing.
- `src/components/ui/dialog.tsx`: modal width, padding, and scrolling.
- `src/server/actions/dev-templates.ts`: grouped data, dates, and allowed server mutations.
- `src/app/build/page.tsx` and `src/components/builder/builder-app.tsx`: review selection and package loading.
- `tests/e2e/dev-templates.spec.ts`: current desktop-only developer workflow coverage.
- `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`: installed Next.js guidance on scoped styles and development/production CSS ordering.
