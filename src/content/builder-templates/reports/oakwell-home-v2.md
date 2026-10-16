# Import report: Homeware boutique v2

## Summary

- Theme colours: accent ← primary, bg ← bg, surface ← surface, fg ← ink, muted ← muted, line ← line.
- Pages matched to links: home → “home”. If one is wrong, re-import with --map <folder>=<link>.
- 1 pages: Home (/, 17 sections).
- 17 sections, 335 editable fields, 16 editable lists.
- Theme: light, accent #3f4d36, headings ui-sans-serif, system-ui, sans-serif, body "DM Sans", Roboto, sans-serif.
- Stylesheet 55 KB, 50 asset files.
- Hand-written stylesheet kept: scoped to the template and its class names prefixed (vt-…). Style panel changes still override it.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- Skipped “Quick view”: it is hidden until a script shows it (modal, message or later step).
- The page's script switched these classes on and off; they show their first state: `cur`, `next`, `mm-open`, `locked`, `bump`, `front`, `gone`, `leave`, `pre`, `hide`, `done`, `paused`, `out`. Check the parts that use them.

## Removed or changed during import

- dialogs kept hidden (they open with a script): 1
- scripts removed: 1
- design data attributes kept (the stylesheet uses them): 9
- interactions recreated: text effects recreated: 25
- interactions recreated: words that slide in: 6
- interactions recreated: reveal on scroll: 24
- interactions recreated: numbers that count up: 3
- interactions recreated: accordions: 1
- interactions recreated: open/close buttons: 5
- interactions recreated: parts set up by the template's hints: 7
- interactions recreated: parts revealed on scroll: 7
- font files bundled: 2
- images bundled: 47
- script-revealed states applied up front (content that animated in on scroll): 9
