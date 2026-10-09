# Import report: Tattoo studio v1

## Summary

- Pages matched to links: noir_needle_bespoke_session_booking → “booking-consultation”, noir_needle_curated_flash_custom_concepts → “flash-and-custom”, noir_needle_portfolio_atelier_showcase → “portfolio”, noir_needle_resident_artists_directory → “resident-artists”. If one is wrong, re-import with --map <folder>=<link>.
- 4 pages: Portfolio (/, 9 sections), Resident Artists (/resident-artists, 7 sections), Flash & Custom (/flash-and-custom, 3 sections), Booking consultation (/booking-consultation, 4 sections).
- 23 sections, 515 editable fields, 42 editable lists.
- Theme: dark, accent #f2ca50, headings "Playfair Display", serif, body Outfit, sans-serif.
- Stylesheet 57 KB, 46 asset files.
- Interactive parts that relied on scripts (tabs, filters, sliders, multi-step forms, modals) show their first state. Rebuild the behaviour when building the real site.

## Needs review

- Links to “bespoke-process” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “the-atelier” point to a page that isn't in the export; they link nowhere until you set them.
- Links to “client-reviews” point to a page that isn't in the export; they link nowhere until you set them.
- 18 class names produced no CSS (unknown to Tailwind v4 or custom to the export): `no-scrollbar`, `artist-filter-btn`, `artist-card`, `filter-cat-btn`, `active`, `status-btn`, `flash-card`, `step-nav-item`, `step-content-panel`, `commission-opt`, `selected-opt`, `next-step-trigger`, `placement-card`, `size-opt`, `prev-step-trigger`, `artist-select-card`, `cal-day`, `time-slot`

## Removed or changed during import

- scripts removed: 3
- inline event handlers removed (onclick…): 26
- font files bundled: 5
- images bundled: 37
- page <style> blocks left out (page boilerplate): 4
