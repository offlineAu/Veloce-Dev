# Import report: Executive dashboard v1

## Summary

- Theme colours: accent ← primary, bg ← background, surface ← surface-container-low, fg ← on-surface, muted ← on-surface-variant, line ← outline-variant.
- Pages matched to links: home → “analytics-intelligence”. If one is wrong, re-import with --map <folder>=<link>.
- 1 pages: Intelligence & Models (/, 2 sections).
- 2 sections, 106 editable fields, 7 editable lists.
- Theme: light, accent #7a582d, headings Newsreader, sans-serif, body Manrope, sans-serif.
- Stylesheet 28 KB, 8 asset files.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- Links to “overview” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “client-portal” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “transactions-vault” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “advisory-team” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “portal-settings” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “auth-access” point to a page that isn't in the export; they link nowhere until you set them.
- 1 class names produced no CSS (unknown to Tailwind v4 or custom to the export): `group`

## Removed or changed during import

- scripts removed: 1
- font files bundled: 7
- images bundled: 0
- page <style> blocks left out (page boilerplate): 1
