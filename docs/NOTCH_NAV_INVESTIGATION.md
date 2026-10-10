# Notch navigation active-state investigation

Investigated on 2026-10-10. Interpret “every active nav just like the notch” as using a small version of the header's curved notch shape for the current section in the desktop header, tablet shortcuts, and open mobile menus. The logo's central notch stays in place; the selected link gets its own recognizable marker.

## What exists

- `src/components/site/notch-header.tsx`: fixed 64px header, 40px outer rails, curved 50px shoulders. Active desktop links use one measured sliding **pill**, with `bg-accent/10` and a faint inset border. Active and inactive text differ only between `text-ink` and `text-muted`.
- The header mobile sheet uses a rounded rectangular active row with the same 10% accent tint.
- `src/components/site/quick-dock.tsx`: tablet shortcuts use accent-tinted pills; expanded menu links change text color only.
- Below 640px the shortcut links are hidden. After scrolling 480px the header also hides its menu button, leaving the dock's generic “More” button as the visible navigation control.
- `useActiveSection` observes linked sections in a band from approximately 30% to 45% of the viewport height. It returns no current section when none of those targets intersects that band.
- Both the homepage and referral page use these shared navigation components.

## Observed behavior

Inspected the running homepage in Chromium at 1440, 820, and 390px, navigating to Services, Our approach, Capabilities, and Offer. All four sections received the expected `aria-current="location"` state at the inspected scroll positions. This does not establish correct behavior at every section boundary or under rapid scrolling.

At 1440px the header's active marker is a faint rounded pill, visually unrelated to its curved shoulders. At 820px the header links become hidden after scrolling and the dock carries the selection. At 390px no current-section link is visible while the dock is collapsed: the only visible dock label is “More”.

With Services current, the expanded dock marks **all five service links plus the Explore → Services link** current, because they all point to `#services`. The tablet shortcut also receives that state. This makes the menu look as if several different destinations are selected. The service links point to the shared services section rather than individual service details.

Reviewed header captures in pistachio, periwinkle, and ember. The translucent marker is subdued in each palette. Its distinguishing shape is still a pill, even where its fill is visible. No numerical contrast audit was performed for the current navigation in this investigation.

## Recommended design

Use one shared **active notch** treatment across navigation surfaces:

1. **Shape:** a filled tab with curved shoulders and a central lower edge, echoing the header's existing 40px-to-64px transition. Use a decorative background behind the link; keep the anchor's hit area and focus outline rectangular and unclipped.
2. **Visibility:** use solid `bg-inverse` with `text-on-inverse`, rather than a 10% accent tint. In the dark palette this is a darker tab with light text; an accent border or short accent baseline makes its boundary clear against the dark header. Verify that boundary contrast as well as text contrast.
3. **Consistency:** use the same silhouette, fill, boundary treatment, and semibold label for every primary section. In menus, use a wider version of the shape that accommodates wrapping and a minimum 44px hit target.
4. **Motion:** a short restrained move between desktop links is appropriate, but the active state must be unmistakable while stationary. Respect the site's existing motion override and reduced-motion behavior. The first placement should be immediate.
5. **Phones:** show the current section next to the menu icon on the collapsed dock, for example **Capabilities**, with an accessible label such as “Open navigation, current section: Capabilities”. Use “Menu” when no linked section is current; retain “Close” when expanded. Displaying the section name must not change the button into an anchor.
6. **One primary destination:** apply the current marker to Explore section links and their shortcut equivalents. Keep “What we build” links neutral unless each points to an independently observed destination. Different responsive representations can mark the same section; unrelated service labels should not all appear selected.

Do not increase or move the entire central logo notch on selection: that would move the brand anchor and complicate the two navigation groups. The link marker should carry the distinctive geometry.

A standalone visual study is available in `docs/NOTCH_NAV_DESIGN_PREVIEW.html`. It lets each of the four links become current and switches between all three palettes. It is a concept illustration; it does not implement the production header, scroll tracking, mobile sheet, or dock.

## Implementation approach

- Add a small shared decorative marker or CSS module used by the header links, primary sheet rows, and dock shortcuts/menu rows. Keep the style scoped to navigation, rather than changing all elements with `aria-current` site-wide.
- Prefer a middle rectangle plus fixed-width curved shoulders, or a scalable SVG with fixed-width end shapes. Stretching the entire SVG across long menu labels would distort the curves. Clip only the decorative background; never clip the focus ring or label.
- Reserve space for the marker in both active and inactive links so changing sections does not move neighboring labels. Size it from the link's box, and handle font loading, viewport changes, and wrapped menu text.
- If retaining the measured sliding element, replace its pill silhouette and audit its measurements on font load and responsive visibility changes. If using per-link backgrounds, remove the redundant pill measurement state instead of maintaining both systems.
- Separate the dock's primary section targets from its related service links. Deduplicate observed IDs and avoid restarting the observer just because the dock opens, a palette changes, or a new combined links array is allocated during render. These are implementation risks inferred from the code, not failures demonstrated by this investigation.
- Keep `aria-current="location"` on the current primary anchors, normal anchor navigation, keyboard focus indication, sheet dismissal, and dock Escape/outside-click behavior.
- Retain the current policy of clearing selection in unlinked sections unless there is a deliberate decision to make it persist. A persistent last-section marker could otherwise imply that Services is current while the visitor reads Why custom.

Read the installed Next.js `use client` and accessibility guides while assessing the implementation. Existing client boundaries are appropriate for selection tracking and menu controls; the decorative marker needs no new animation dependency.

## Acceptance checks

- Every primary destination receives a visible notch marker when current, in all three palettes.
- No primary item looks selected in the hero or an unlinked section under the current scroll-spy policy.
- Desktop header, tablet shortcut, open dock, and mobile menu agree on the current section.
- Phone dock names the current section while collapsed; text fits at 320px and with enlarged text.
- Related service links sharing a section anchor do not all acquire the primary active marker.
- Click, smooth scroll, direct hash entry, reverse scrolling, section boundaries, resize across 640/768/1024px, and web-font completion update the marker correctly.
- A long or wrapped referral navigation label retains shoulder geometry and a readable focus ring.
- Keyboard operation, visible focus, `aria-current`, reduced motion, and scoped axe scans pass.
- Run typecheck, focused lint, and production visual checks. Add focused navigation coverage for meaningful state changes rather than assertions that only repeat class names.

This investigation adds a report and a concept preview only. Production navigation is unchanged. Runtime observations cover the homepage in Chromium; referral rendering, cross-browser behavior, native zoom, and manual screen-reader checks remain to be verified during implementation.
