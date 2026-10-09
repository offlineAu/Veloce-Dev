# “Built with modern tools” investigation

Investigated on 2026-10-10. Recommendation: replace the wrapping text strip with a compact, static panel that connects the technology to a useful business outcome. Keep it beneath Capabilities; it supports that section rather than needing another large homepage section.

## Evidence

- Rendering: `src/app/page.tsx:287–299`.
- Copy: `src/content/site.ts:134–135`; `toolStrip` is a string array whose only rendering reference is on the homepage.
- Current items: Modern web (React / Next.js), Mobile-ready apps, Reliable databases, Practical AI tools, Cloud hosting & security.
- Inspected the running homepage at `http://localhost:3000` in Chromium at widths 390, 820, and 1440 pixels. Screenshots were captured after the startup overlay cleared and visually reviewed. Local captures: `/tmp/veloce-tools-390.png`, `/tmp/veloce-tools-820.png`, `/tmp/veloce-tools-1440.png`.
- Read the installed Next.js guides for Server and Client Components and accessibility when assessing the implementation approach.

## Findings

| Priority | Finding | Improvement |
| --- | --- | --- |
| High | The list mixes a named stack, a device capability, a quality claim, AI, and hosting. These are hard to compare and do not explain why a client should care. | Give each item a consistent category, a short benefit, and optional technology names. |
| High | “Mobile-ready apps” can be read as native mobile development. The surrounding service copy describes websites and web applications. | Say “Responsive web apps” or explicitly describe use on phones, tablets, and desktops. |
| High | “Practical AI tools” has no supporting example in the adjacent capability groups or service descriptions. The repository alone cannot establish which AI services Veloce offers. | Describe a real offered use case if available, and scope AI to projects where it helps. Otherwise use the already described integrations and workflow automation. |
| Medium | At 1440px the 1152px panel has four items on its first list row and only hosting on the second. At 820px the list uses three rows. At 390px the 350px panel uses four rows in a 1 / 1 / 2 / 1 arrangement. | Use a deliberate grid with left-aligned content. Choose column changes based on the panel's available width. |
| Medium | Gray dots repeat without identifying categories. Only the final dot has an accent, although the copy gives no reason to emphasize hosting. | Use small category icons with consistent treatment, or remove dots entirely. |
| Medium | “Built with modern tools” says little about the selection process. It also contrasts with the site's otherwise concrete, plain-language copy. | Retain it as an eyebrow if desired, and add “The right tools for what you need.” plus one short explanatory sentence. |
| Low | The label is a paragraph. That is reasonable for a decorative strip, but a richer panel would benefit from a heading associated with its content. | Use an `h3` under the Capabilities `h2`, within a labeled wrapper. Preserve list semantics for the items. |

There was no page-level horizontal overflow at the three inspected widths. This is a content and visual hierarchy opportunity, not an observed overflow defect. No conversion analytics or user research were collected; likely effects on trust and comprehension are design judgments.

## Proposed content

Eyebrow: **Built with modern tools**

Heading: **The right tools for what you need.**

Lead: **We choose the technology around your workflows, existing systems, and plans for growth.**

The following is proposed copy for review, not a claim that every service has been independently verified:

| Category | Benefit copy | Supporting detail |
| --- | --- | --- |
| Web experiences | Websites and web apps designed for phones, tablets, and desktops. | React · Next.js · TypeScript |
| Business data | Structure the records your team needs to manage and use. | PostgreSQL · Prisma |
| Integrations & automation | Connect existing tools and reduce repetitive steps. | APIs · Workflow automation |
| Deployment & support | Plan how your system goes live and how it will be maintained. | Hosting and support scoped to the project |

React, Next.js, TypeScript, PostgreSQL, and Prisma are supported by this repository's dependencies and architecture. Those dependencies do not prove a company-wide preferred stack or delivery track record. Hosting vendor names and security guarantees should follow the actual project scope. If AI belongs here, replace or extend the integrations detail with a specific supported use case; avoid a generic AI badge.

## Layout and implementation

Use one shared rounded panel, a short introduction above the list, and four items in a grid: one column on narrow phones, two on tablets, and four only when each item has enough room. Left-align the copy. Keep the existing theme tokens, restrained borders, and spacing so it feels part of Capabilities. Small decorative icons can use the installed Lucide library and `aria-hidden`.

Move the rendering into `src/components/marketing/modern-tools.tsx`, with structured content in `src/content/site.ts` (`id`, `title`, `description`, and optional technology labels). Keep it a Server Component: this content needs no state, effects, hydration, or new dependencies. Keep meaningful information visible without hover, expandable cards, or animation.

Avoid a scrolling logo marquee: the useful work here is explaining the choices, and the panel already follows an interactive capability component. Vendor logos alone would not supply the missing explanation.

## Verification for an implementation

- Check 320, 390, 820, 1024, and 1440px layouts, including long labels and text zoom.
- Inspect all three existing palettes: pistachio, periwinkle, and ember.
- Verify heading structure, list semantics, and readable contrast with a scoped accessibility check.
- Run typecheck and lint on changed files. Use a production render for final visual verification.
- Preserve the existing capability tabs and inquiry flows.

This investigation adds documentation only. No application code, dependencies, or existing user changes were modified. The current visual observations cover Chromium and the default palette; other browsers, palettes, zoom, and accessibility scans have not been verified in this investigation.

## Implementation and validation

Implemented on 2026-10-10 after approval of the recommendation. The homepage now uses the static `ModernTools` Server Component and the structured `modernTools` content. Four categories replace the original strip, with the proposed heading, benefit descriptions, technology details, and decorative Lucide icons. The list uses one column on phones, two from the `sm` breakpoint, and four from `xl`.

Validation completed:

- Typecheck and ESLint for the three changed application files passed.
- All 109 existing contrast tests passed.
- Production build passed using command-scoped valid environment values. The existing production environment contains invalid placeholders for Cal URLs, site URL, hash secret, contact email, and the referrer notification setting; environment files were not edited.
- Chromium production checks at 320, 390, 820, 1024, and 1440px passed for all three palettes, with no horizontal overflow or clipped list items at those widths.
- Scoped axe WCAG A/AA checks passed for the panel in pistachio, periwinkle, and ember.
- At 200% root font size and 390px width, the panel and its items remain within the viewport without clipping. Existing hero content causes page-level overflow under that enlargement; it is outside this section's changes. Root font enlargement is a proxy for text zoom, not a native browser zoom test.
- Every existing capability tab remained selectable, and the hero inquiry button opened its dialog in the production render. No inquiry was submitted during these checks.
- Production desktop and mobile screenshots were visually inspected. No additional dependencies or client interactivity were introduced.

The build retains an existing filesystem-tracing warning in `src/server/builder/template-store.ts`. Cross-browser and manual screen-reader checks were not performed for this change.
