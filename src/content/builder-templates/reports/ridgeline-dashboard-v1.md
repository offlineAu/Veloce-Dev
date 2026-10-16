# Import report: Operations dashboard v1

## Summary

- Theme colours: accent ← default, bg ← page, surface ← card, fg ← ink, muted ← muted, line ← default.
- Pages matched to links: home → “home”. If one is wrong, re-import with --map <folder>=<link>.
- 1 pages: Home (/, 8 sections).
- 8 sections, 204 editable fields, 9 editable lists.
- Theme: light, accent #b4472a, headings ui-sans-serif, system-ui, sans-serif, body "IBM Plex Sans", sans-serif.
- Stylesheet 27 KB, 3 asset files.
- Hand-written stylesheet kept: scoped to the template and its class names prefixed (vt-…). Style panel changes still override it.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- No accent colour found; native blocks use the default accent. Pick one in the theme step.
- Low contrast for muted text on background (3.15:1, needs 4.5:1).
- The page's script switched these classes on and off; they show their first state: `bye`, `draw`, `refreshing`. Check the parts that use them.

## Removed or changed during import

- scripts removed: 1
- interactions recreated: parts set up by the template's hints: 4
- font files bundled: 2
- images bundled: 0
