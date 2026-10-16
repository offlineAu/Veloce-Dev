# Import report: Accountants & advisers v1

## Summary

- Theme colours: accent ← primary, bg ← bg, surface ← surface, fg ← ink, muted ← muted, line ← line.
- Pages matched to links: home → “home”. If one is wrong, re-import with --map <folder>=<link>.
- 1 pages: Home (/, 14 sections).
- 14 sections, 241 editable fields, 22 editable lists.
- Theme: light, accent #0f766e, headings ui-sans-serif, system-ui, sans-serif, body "Plus Jakarta Sans", Roboto, sans-serif.
- Stylesheet 46 KB, 9 asset files.
- Hand-written stylesheet kept: scoped to the template and its class names prefixed (vt-…). Style panel changes still override it.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- Unsupported <output> replaced by its contents. (×3)
- The page's script switched these classes on and off; they show their first state: `go`, `bad`. Check the parts that use them.

## Removed or changed during import

- inline event handlers removed (onclick…): 1
- scripts removed: 1
- interactions recreated: text effects recreated: 24
- interactions recreated: words that slide in: 9
- interactions recreated: reveal on scroll: 31
- interactions recreated: numbers that count up: 8
- interactions recreated: accordions: 1
- interactions recreated: open/close buttons: 1
- interactions recreated: navigation that follows the page: 1
- interactions recreated: forms with a thank-you message: 1
- interactions recreated: parts set up by the template's hints: 4
- interactions recreated: parts revealed on scroll: 1
- font files bundled: 2
- images bundled: 6
- script-revealed states applied up front (content that animated in on scroll): 8
