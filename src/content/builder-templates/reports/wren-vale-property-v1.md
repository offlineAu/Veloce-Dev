# Import report: Real estate agency v1

## Summary

- Theme colours: accent ← primary, bg ← bg, surface ← surface, fg ← ink, muted ← muted, line ← line.
- Pages matched to links: home → “home”. If one is wrong, re-import with --map <folder>=<link>.
- 1 pages: Home (/, 14 sections).
- 14 sections, 250 editable fields, 10 editable lists.
- Theme: light, accent #b8945a, headings "Cormorant Garamond", "Iowan Old Style", Georgia, serif, body Manrope, sans-serif.
- Stylesheet 54 KB, 34 asset files.
- Hand-written stylesheet kept: scoped to the template and its class names prefixed (vt-…). Style panel changes still override it.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- Low contrast for muted text on background (4.18:1, needs 4.5:1).
- The page's script switched these classes on and off; they show their first state: `ok`, `shimmer`, `scrolled`, `gone`, `out`, `seen`, `cur`, `done`, `paused`, `drag`, `touring`, `immersive`, `bad`. Check the parts that use them.

## Removed or changed during import

- scripts removed: 1
- design data attributes kept (the stylesheet uses them): 5
- interactions recreated: text effects recreated: 1
- interactions recreated: reveal on scroll: 15
- interactions recreated: numbers that count up: 22
- interactions recreated: open/close buttons: 1
- interactions recreated: parts set up by the template's hints: 4
- font files bundled: 4
- images bundled: 29
- script-revealed states applied up front (content that animated in on scroll): 2
