# Services and approach: content audit and rebuild

Reviewed 2026-10-05 against the homepage, marketing components, owner-supplied brand copy in `src/content/site.ts`, and the original feature mapping. This is a code and design review, not a claim of user-research findings.

## What Veloce is trying to communicate

Veloce builds practical websites, customer applications, and business systems. Its distinction is focused delivery: understand the real problem, agree the functionality that matters first, produce a working version early, then improve through real use. “Think it. Build it. Make it work.” is the owner's existing message.

The audience needs to identify the work they need, understand how they would participate, and start a conversation. There are no supplied case studies, team portraits, client results, prices, or delivery SLAs to use as evidence. The reference's AI, blockchain, senior-team, and no-handoff claims do not establish Veloce's services or credentials.

## Overall impression

The prior version adopted the bento's shape and later its theme, but the visual metaphor still came from the reference: paper cards, a tilted BUILD badge, avatars replaced with icons, and an engineering tile field. Its animation changed decorative text without helping a visitor make a decision. The actual brand palette, logo, and typography already provide a useful foundation for a more specific design.

## Usability and redundancy findings

| Finding | Severity | Why it matters | Resulting change |
| --- | --- | --- | --- |
| The same component drew both the nine-service catalogue and the five-card delivery pitch. | Moderate | Matching graphics made “what we offer” and “how we work” feel like two versions of one section. | Separate purpose-built service explorer and delivery workbench. |
| The first two service cards used BUILD and delivery graphics regardless of their service type. | Moderate | A business website inherited automation imagery; a web application inherited a process card. The art did not explain the service. | Services use their configured icons, benefits, descriptions, and inquiry actions. |
| Five approach cards, six process steps, four philosophy items, and the additional capability/scope bento repeated the delivery story. | Moderate | Readers encountered scope, working versions, feedback, and growth multiple times before reaching the CTA. | One three-stage workbench contains the six steps and their practical implications. Remove the extra philosophy and capability bento from the homepage. |
| The capability bento repeated booking, payments, integrations, dashboards, and automation already covered by services and capability tabs. | Moderate | Three catalogues competed with one another. | Keep Services for project types and the existing Capabilities section for specific functionality. |
| The paper stack was decorative and hidden from assistive technology. | Moderate | A visitor could watch it but could not learn by interacting with it. | A labelled example workflow accepts scope choices, sample actions, and improvement feedback. |
| Changing colours and copy retained the reference's composition. | Moderate | The page remained recognisable as a reskin rather than an expression of Veloce's own process. | Use the Veloce mark, a service chooser, and a working-interface motif. No reference card stack or reference wording. |
| Automatic stage changes controlled what a reader saw. | Moderate | Motion could interrupt reading rather than support it. | Visitors control the stage. Animation accompanies their selection; reduced motion retains every action. |

## New information architecture

| Section | Visitor's question | Content owned by this section |
| --- | --- | --- |
| Hero | Why should I keep reading? | Veloce's promise and first conversation CTA. |
| Services | Can you build or improve what I need? | All nine configured service types, organised around customers, operations, and existing software. Descriptions expand on demand. |
| Why custom | Does custom development make sense for me? | Existing honest comparison of template and custom development. |
| Our approach | What would working together involve? | The six delivery steps grouped into Think it, Build it, and Make it work, with the customer's role and the output of each stage. |
| Capabilities | What functionality could be included? | Existing feature groups, such as bookings, authentication, payments, and integrations. These are building blocks, not additional delivery promises. |
| Offer and expectations | What happens if I contact you? | Referral-aware offer or proposed scope, initial conversation, pricing discussion, and next steps. |

The philosophy remains in the content source because the referral page uses it. Its principles are expressed through the workbench on the homepage. The original capability-bento component remains available but is no longer mounted on the homepage.

## The original Veloce interaction

Services starts with “What needs to work better?” Visitors can filter by business need, return to the full catalogue, expand a service, and open the existing inquiry dialog. Services still come from the database/fallback catalogue. Unknown configured slugs appear under Other services, so new services are not silently lost.

Our approach uses the owner's three-part message as a navigation system:

1. **Think it:** understand the problem and agree priorities. The visitor can choose what belongs in the example's first version. The visible First version/Later scope updates.
2. **Build it:** design the key screens and build a functional version. The example changes with the priority: choose a booking time or reminder channel, review a request or choose an escalation rule.
3. **Make it work:** test through real use and agree improvements/support. The visitor selects an improvement; the next item to discuss updates. Improvements do not repeat functionality already prioritised.

Customer bookings and team approvals are illustrative examples drawn from Veloce's existing service/capability scope. They are not client projects and create no real bookings, approvals, or messages. Choosing another example resets the example choices; moving between stages preserves them. Preview choices are temporary and are not submitted with the inquiry form.

## Visual hierarchy and consistency

- Services foregrounds business needs and actual service names. Expandable details keep the catalogue scannable.
- Our approach foregrounds three visitor-controlled stages, then separates delivery information from the working example.
- “Your part” and “What you receive” replace broad claims with concrete expectations.
- Existing palette variables, heading/body fonts, radii, logo, buttons, and inquiry flow are reused. Both Periwinkle and Ember resolve through the same tokens.
- Motion is a response to a chosen stage, not an autoplay pitch. A headline flips and the example changes on selection; there is no continuous stage carousel.

## Accessibility and verification

The stage controls use the existing Radix Tabs with arrow-key navigation. Service disclosures use native buttons with expanded/control relationships. Example choices expose pressed state, and results use status regions. Forward/back example actions focus the selected stage tab so keyboard focus does not disappear with an exiting panel. Controls have at least 44px touch targets. Reduced motion removes transforms while preserving the entire journey.

Verification covers all service filters and the inquiry dialog, all six steps, scope-dependent examples, workflow reset and state preservation, keyboard navigation, reduced motion, both palettes, and mobile/tablet/desktop overflow. Screenshots and axe checks verify rendered layouts and readable content rather than treating decorative motion as evidence of usability.

Verified for this rebuild: TypeScript, ESLint, and the production build pass. The new Playwright spec passes all 12 cases across the three configured viewports. Scoped axe checks report no WCAG A/AA violations in the new sections in Periwinkle and Ember at 1440, 820, 390, and 320px; the later delivery stages were checked too. Browser checks report no runtime errors or horizontal page overflow.

## Priority decisions implemented

1. Give Services and Our Approach different jobs and different interfaces.
2. Consolidate the delivery narrative without losing any of the six steps.
3. Replace the borrowed decorative card with an original, stateful example of Veloce's process.

Actual conversion impact remains unmeasured. The examples are explanations of a possible collaboration, not a commitment to a specific scope, timeline, or result.
