# Import report: Client portal v1

## Summary

- Theme colours: accent ← primary, bg ← background, surface ← surface-container-low, fg ← on-surface, muted ← on-surface-variant, line ← outline-variant.
- Pages matched to links: home → “client-portal”. If one is wrong, re-import with --map <folder>=<link>.
- 1 pages: Portfolio Telemetry (/, 2 sections).
- 2 sections, 93 editable fields, 6 editable lists.
- Theme: light, accent #7a582d, headings Newsreader, sans-serif, body Manrope, sans-serif.
- Stylesheet 30 KB, 9 asset files.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- Links to “overview” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “analytics-intelligence” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “transactions-vault” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “advisory-team” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “portal-settings” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “auth-access” point to a page that isn't in the export; they link nowhere until you set them.

## Removed or changed during import

- font files bundled: 7
- images bundled: 1
- page <style> blocks left out (page boilerplate): 1
