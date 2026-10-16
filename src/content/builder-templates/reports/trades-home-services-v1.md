# Import report: Trades & home services v1

## Summary

- Theme colours: accent ← accent, bg ← paper, surface ← card, fg ← ink, muted ← muted, line ← line.
- Pages matched to links: home → “home”. If one is wrong, re-import with --map <folder>=<link>.
- 1 pages: Home (/, 16 sections).
- 16 sections, 256 editable fields, 11 editable lists.
- Theme: light, accent #ffc21a, headings "Barlow Condensed", sans-serif, body Barlow, sans-serif.
- Stylesheet 47 KB, 35 asset files.
- Hand-written stylesheet kept: scoped to the template and its class names prefixed (vt-…). Style panel changes still override it.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- The page's script switched these classes on and off; they show their first state: `clone`, `down`, `slow`. Check the parts that use them.

## Removed or changed during import

- inline event handlers removed (onclick…): 1
- scripts removed: 1
- interactions recreated: copies made by the script left out: 3
- interactions recreated: text effects recreated: 26
- interactions recreated: words that slide in: 8
- interactions recreated: reveal on scroll: 21
- interactions recreated: numbers that count up: 6
- interactions recreated: accordions: 1
- interactions recreated: open/close buttons: 1
- interactions recreated: navigation that follows the page: 1
- interactions recreated: forms with a thank-you message: 1
- interactions recreated: parts set up by the template's hints: 20
- font files bundled: 14
- images bundled: 20
- script-revealed states applied up front (content that animated in on scroll): 9
