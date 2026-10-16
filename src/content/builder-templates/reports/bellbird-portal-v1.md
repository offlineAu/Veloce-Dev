# Import report: Construction client portal v1

## Summary

- Theme colours: accent ← primary, bg ← bg, surface ← surface, fg ← ink, muted ← muted, line ← line.
- Pages matched to links: overview → “overview”, project → “project”, approvals → “approvals”, invoices → “invoices”, files → “files”, messages → “messages”. If one is wrong, re-import with --map <folder>=<link>.
- 6 pages: Overview (/, 6 sections), Project (/project, 6 sections), Approvals (/approvals, 6 sections), Invoices (/invoices, 6 sections), Files (/files, 6 sections), Messages (/messages, 6 sections).
- 36 sections, 645 editable fields, 10 editable lists.
- Theme: light, accent #2357a6, headings ui-sans-serif, system-ui, sans-serif, body Inter, Roboto, sans-serif.
- Stylesheet 66 KB, 25 asset files.
- Hand-written stylesheet kept: scoped to the template and its class names prefixed (vt-…). Style panel changes still override it.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- Skipped “SIGN IN”: it is hidden until a script shows it (modal, message or later step). (×6)
- Skipped “approval dialog”: it is hidden until a script shows it (modal, message or later step). (×6)
- Skipped “command palette”: it is hidden until a script shows it (modal, message or later step). (×6)
- Skipped “photo lightbox”: it is hidden until a script shows it (modal, message or later step). (×6)
- Skipped “sample email with the sign-in code (only when DEMO”: it is hidden until a script shows it (modal, message or later step). (×6)
- The page's script switched these classes on and off; they show their first state: `ph-load`, `bye`, `theming`, `filled`, `bad`, `ok`, `zero`, `off`, `enter`, `locked`, `leaving`, `signed`, `done`, `over`. Check the parts that use them.

## Removed or changed during import

- dialogs kept hidden (they open with a script): 18
- scripts removed: 6
- design data attributes kept (the stylesheet uses them): 31
- interactions recreated: numbers that count up: 36
- interactions recreated: open/close buttons: 22
- font files bundled: 2
- images bundled: 17
- script-revealed states applied up front (content that animated in on scroll): 1
