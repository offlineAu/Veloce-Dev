# Source Audit

Audit of the supplied ZIP (`Client Referral Page Review.zip`, extracted outside the repo). Stage A deliverable. No application code has been written.

## 1. Package contents

| File | Size | Role |
|---|---|---|
| `Client Referral.dc.html` | 49 KB | Referral page (the page a referrer shares). |
| `Custom Website Offer.dc.html` | 69 KB | Public sales page the referred prospect lands on. |
| `support.js` | 69 KB | Generated "dc-runtime" that interprets the `.dc.html` files. Not product code. |
| `_ds/organic-…/styles.css` | 11 KB | "Organic" design system: tokens plus component classes. |
| `_ds/organic-…/readme.md` | 7 KB | Design-system guidance (direction, do/don't). |
| `_ds/organic-…/_ds_manifest.json`, `_ds_bundle.js`, `_adherence.oxlintrc.json` | small | Design-tool metadata. The bundle is an empty namespace stub. |
| `uploads/Gemini_Generated_Image_….jpg` | 706 KB | 1024×1042 image. **Not referenced by either page.** An AI-generated image of unknown rights, so it is not reused. |
| `.thumbnail` | 19 KB | WebP preview image. |

The README references files that are not in the ZIP (`theme.json`, `components/*.html`, `templates/`, `assets/photo.jpg`). We only have `styles.css` and the readme.

## 2. How the source works

Both pages are `.dc.html` files. They are templates in a custom format (`<x-dc>`, `{{ }}` bindings, `<sc-if>`, `<sc-for>`, `style-hover`). A class `Component extends DCLogic` drives them. `support.js` loads React 18.3.1 and `@babel/standalone` from **unpkg.com** at runtime and compiles the template in the browser.

Consequences:
- The format is design-tool-specific, so it is not portable code. There is no SSR, no SEO, no indexable HTML, and it needs a third-party CDN at runtime.
- Both pages are visual references plus a UX script. They are not to be ported literally. This matches the brief.
- `support.js` contains `fetch` calls only for its own loading (`location.href`, the unpkg libraries, and blobs). **Neither page contains any network call to a backend.**

## 3. Page 1 — Client Referral (`Client Referral.dc.html`)

**Audience:** an existing client who has been sent the page and is asked to pass the offer on.

### Sections (in order)
1. Sticky nav: brand, anchors (What we do, The offer, Share; hidden below 860px), "Make an introduction" button.
2. Hero: "A better website starts with the right development team." Primary CTA opens the form. Secondary CTA scrolls to `#what-we-do`. Decorative abstract browser mockup with a "Recommended by {clientName}" chip (initials avatar).
3. Recommendation: a quote written in the *referrer's voice* ("We worked with {companyName}, and I'd be glad to introduce you"), captioned with name, role and company.
4. What we do: 4 cards (Custom development, Business-focused, Scalable, Flexible integrations).
5. Why us: 6 benefits (Custom solutions, Professional development, Modern technology, Responsive design, Business-specific functionality, Ongoing support).
6. Offer: dark panel with `{referralOffer}`, and three blocks (What you get / Why you get it / How to claim). Optional "valid until {expiryDate}" line. CTA "Claim with an introduction".
7. How it works: Share → Introduce → Build.
8. Share message: 5-paragraph prewritten message. Buttons: Email (`mailto:`), WhatsApp (`wa.me`), Copy link, Copy message.
9. Final CTA ("Make an introduction", "Start a conversation" → `mailto:`), closing thank-you, footer.
10. Mobile sticky bar (shown at width < 720 and scroll > 520): introduction button plus copy-message icon.
11. Toast (2.6 s) and the introduction dialog.

### Dynamic variables (all are design-tool props with `[PLACEHOLDER]` defaults)
`companyName`, `clientName`, `clientRole`, `clientCompany`, `referralOffer`, `expiryDate`, `showExpiry`, `websiteUrl`, `contactEmail`, `stickyMobileCta`, `markPlaceholders`.

`markPlaceholders` highlights unfilled values in a tinted pill. It is an authoring aid and is **dropped** in the rebuild. `clientName` also yields `initials`. Services, benefits, steps and message copy are hardcoded in the script.

**Intended data source for each:**
- `companyName`, `websiteUrl`, `contactEmail` → company profile (env/DB).
- `clientName`, `clientRole`, `clientCompany` → referral campaign.
- `referralOffer`, `expiryDate` → referral campaign.

### Interactions
- **Copy message:** `navigator.clipboard.writeText` with a hidden-textarea `execCommand` fallback. The fallback only runs when the Clipboard API is *absent*, or when the promise rejects. **Defect:** the success toast and the "Copied!" label are shown unconditionally, even if both paths fail. The brief asks for success *and* failure feedback.
- **Copy link:** copies `websiteUrl` (the *company site*), or `location.href` if the URL is still a placeholder. **Defect:** it does not copy a referral-specific link. It copies the company site, so attribution would be lost.
- **Email share:** `mailto:?subject=…&body=` with `encodeURIComponent`. Correctly encoded.
- **WhatsApp share:** `https://wa.me/?text=` with `encodeURIComponent`. Correctly encoded.
- **Dialog:** `role="dialog" aria-modal`, `aria-labelledby`, Esc closes, backdrop click closes. **Gaps:** no focus trap, no focus return to the trigger, and no initial focus on open. Background scroll is not locked.
- **Form validation (client-only):** required yourName, yourEmail, referralName, referralEmail, lookingFor. Email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Errors render below the fields and focus moves to the first invalid field. Inputs use `onChange`, which fires on blur for native inputs, so errors clear late.
- **Submit:** `this.setState({ sent: true })` plus a toast "Introduction sent". **Nothing is sent anywhere.**
- Scroll-reveal via IntersectionObserver (respects `prefers-reduced-motion`). `scroll-behavior: smooth` is disabled under reduced motion.

### Form fields
yourName*, yourEmail*, referralName*, referralEmail*, company, lookingFor* (`new` / `redesign` / `feature` / `unsure`), message.

### Honesty issues in the copy (must change)
- Success text: *"We'll reach out to {referralName} within a couple of business days and copy you on the first email."* This promises a **response-time SLA** and a **CC to the referrer**. Neither is implemented. The brief says to promise only what is implemented.
- Offer text: "We'll mention the offer on our first call" and "*This is our thank-you to both of you*". The second implies a benefit to the referrer that is not defined anywhere.
- Closing says "We worked with {companyName}" in the referrer's voice. That is a **claim made on behalf of a real client**, so it needs the referrer's consent. It is an assertion the business cannot verify per campaign.
- The privacy line is a single sentence with no consent checkbox. The form collects a **third party's** email without their involvement. See the privacy notes in `TECHNICAL_DECISIONS.md`.

## 4. Page 2 — Custom Website Offer (`Custom Website Offer.dc.html`)

**Audience:** the prospective customer, either referred or arriving directly.

### Sections (in order)
1. Sticky nav: brand (logo glyph), anchors Services, Approach, Capabilities, Offer (hidden below 900px), "Start a conversation".
2. Hero: pill link "SPECIAL OFFER — Available through an existing client introduction" → `#offer`. Headline has two variants via the `headline` prop: `custom` ("Custom websites built around your business.") and `template` ("Your business deserves more than a template."). CTAs "Let's build your website" and "Explore our services". Decorative mockup (browser, code card, phone).
3. What we build: 6 services (Business websites, Corporate websites, E-commerce, Web applications, Landing pages, Custom features).
4. Why custom: template vs custom lists (5 items each). Copy is reasonably balanced ("Templates are a reasonable starting point…") but the left card lists only negatives.
5. Approach: 4 steps (Discover, Design, Develop, Launch & support).
6. Why us: 6 benefit cards.
7. Capabilities: radio-group "tabs" (For customers / For your team / Commerce & data), each with 4 capabilities and a decorative mock panel (booking calendar, dashboard, checkout).
8. Offer: `{referralOffer}`, "Available through an introduction from {clientName}", optional "valid until {offerExpiration}", CTA.
9. What to expect: 3 points (conversation first, solution built around needs, clear next steps).
10. Final CTA: "Start a conversation" and "Request a consultation".
11. Footer (name, description, website, email), mobile sticky CTA, toast, inquiry dialog.

### Dynamic variables
`headline`, `showExpiry`, `stickyMobileCta`, `markPlaceholders`, `companyName`, `companyDescription`, `clientName`, `referralOffer`, `offerExpiration`, `contactEmail`, `websiteUrl`.

Note the naming differs from page 1 (`offerExpiration` vs `expiryDate`). Page 2 has `companyDescription`, which page 1 lacks. Page 1 has `clientRole`/`clientCompany`, which page 2 lacks.

### Interactions
- **Capability tabs:** a `.seg` radio group switches `state.tab`. Native radios, so keyboard-accessible.
- **Request a consultation:** opens the same inquiry dialog with `details` prefilled as "I'd like to request a consultation." There is **no calendar or scheduling**. The "Book a time" calendar and the "Checkout / Pay securely" panel are **purely decorative mockups** (`aria-hidden`) illustrating *capabilities we could build*, not features of this site.
- **Inquiry form:** required name, email, company, projectType, siteType, goal. Optional website, details. Checkbox `introduced` ("I was introduced by an existing client — apply the special offer"), checked by default.
- **Submit:** `setState({ sent: true })` and a toast. **Nothing is sent.**
- Success text echoes the user's name and email as typed. This is not persisted or verified.
- Dialog has the same accessibility gaps as page 1.
- The `introduced` checkbox is self-declared and **checked by default**: anyone gets the "referral offer" claim without any verification. Not trustworthy for attribution.
- The hero pill and the offer card advertise a "special offer" even when `referralOffer` is unset, and show the raw `[REFERRAL OFFER]` placeholder in production. The offer must be conditional.
- The only difference in Project types between pages: page 2 lists 7 project types (New website, Website redesign, E-commerce, Web application, Landing page, Custom development, Not sure yet). The brief's list (New project, Website redesign, E-commerce, Custom web application, Integration, Maintenance, Other) is different. See `FEATURE_MAPPING.md`, open decisions.
- Page 2 form field is "Project type" (a radio group) *and* "Website type" (a select) with overlapping values (e.g. both include E-commerce and Web application). That is confusing and a candidate for the "conditional fields only where they help" rule.

## 5. Working vs simulated vs missing

| Capability | Status |
|---|---|
| Layout, responsive grids, sticky nav, anchors, smooth scroll | **Working** (visual) |
| Scroll-reveal, hover lifts, toast, dialog open/close/Esc | **Working** (UI only) |
| Client-side form validation | **Working** (client-only, untrusted) |
| Copy message to clipboard | **Partly working**: no failure feedback |
| Email / WhatsApp share links | **Working**, correctly encoded |
| Copy link | **Defective**: copies the company site, not a referral link |
| Capability tabs | **Working** |
| Form submission (both pages) | **Simulated**: no network, no storage, no email |
| "We'll copy you on the first email" / "within a couple of business days" | **Not implemented** (false as written) |
| Calendar booking and checkout panels | **Decorative mockups** |
| Referral attribution / offer verification | **Missing** (self-declared checkbox) |
| Offer expiry | **Display-only text**, never evaluated |
| Personalization | **Props only**, no per-campaign data source |
| SEO, OG metadata, canonical, noindex for personal pages | **Missing** |
| Analytics, rate limiting, spam protection, consent | **Missing** |
| Dialog focus management | **Missing** |
| Admin / lead management | **Missing** |

## 6. Reusable components and shared patterns

Shared between both pages (becomes the shared component set):
- Nav, brand mark, mobile sticky CTA, toast, dialog shell, footer.
- Section "eyebrow + H2 + lead" heading pattern (appears ~12×).
- Icon-circle feature/service card, numbered step (circle numeral), tinted list item, tag/pill.
- Form field + error line pattern; pill radio.
- Offer card (dark panel on page 1, tinted panel on page 2) — one component, two variants.
- Dialog + form + success state — **same shell, different fields**.

Duplicated copy that should be a single data source: service/benefit lists (page 1 has 4 services and 6 benefits, page 2 has 6 services and 6 benefits that overlap in meaning), and the "Custom website development" description.

## 7. Design language

"Organic": warm, rounded, flush-left, asymmetric; pill buttons; soft circular decoration; display face Caprasimo with Figtree body; Lucide icons at stroke-width 2.75.

- Page 1 uses the system's default palette (cream `#f5ead8`, terracotta `#c67139`, sage `#7a8a5e`).
- **Page 2 overrides the tokens** with a different palette (warm grey `#f2eae0`, violet `#5f5291`, teal `#6c9aa3`), so the two pages are not visually the same brand. The brief asks for consistency. Decision needed: see `TECHNICAL_DECISIONS.md` §D1.
- Contrast: the readme itself notes accent on ground is only ≥3:1, and body text at `color-mix(text 76%)` over the cream ground needs measuring. Small uppercase eyebrow text (13px) in `accent-700` must be checked against WCAG AA. Not measured yet; to be validated during build.
- The hero mockups are generic abstract UI. They are acceptable as abstract art but are not product screenshots and must not be presented as client work.
- The "code card" mock shows React code snippets. It is decorative copy; decide whether to keep it.

## 8. External dependencies and reuse

| Item | Source | Reuse? |
|---|---|---|
| React 18.3.1, Babel standalone | unpkg CDN at runtime | **No.** Replaced by Next.js build. |
| Caprasimo, Figtree | Google Fonts (`@import`) | **Yes, if kept.** Both are SIL OFL. Self-host via `next/font` (no runtime Google request). |
| Lucide icons | Inline SVG paths copied from Lucide (ISC) | **Yes**, via `lucide-react`. |
| `styles.css` tokens | Design-tool "Organic" system | **Reuse the token values** as the basis of the Tailwind theme. Licence/provenance of the system itself is not stated in the ZIP; we only carry over values (colours, radii) and re-implement components. Confirm ownership with the owner. |
| Gemini-generated JPG | unreferenced | **No.** Unknown rights, unused. |
| `support.js`, `.dc.html` | design tool output | **No.** Reference only. |
| Brand logo glyph (3 polygons in page 2) | inline SVG | **Unknown ownership.** Treat as placeholder; owner to confirm/provide the real logo. |

## 9. Missing information (needed from the owner)

1. **Company facts:** legal/trading name, description, contact email, website URL, logo, location/timezone, (optional) phone/WhatsApp number. The ZIP has only placeholders.
2. **Real offer(s):** what the referral offer actually is, whether the *referrer* receives anything, validity rules, and who authorises a discount. We will not invent any.
3. **Referral terms:** may we state "existing client" and name the referrer on the page? Does the referrer consent to be named in the quote?
4. **Visual identity decision:** terracotta/sage (page 1) vs violet/teal (page 2), or a new brand palette.
5. **Project type taxonomy:** keep the brief's list or the page 2 list.
6. **Notification recipients** and a transactional email provider/domain.
7. **Legal/privacy:** jurisdiction (the account email suggests the Philippines, i.e. the Data Privacy Act of 2012), privacy policy text, data-retention period, who is the data controller.
8. **Deployment target** and a PostgreSQL host.
9. **Testimonials / credentials / case studies:** none exist. The new site will have none until supplied.
10. **Language/locale and currency** (no prices are used).

## 10. Journey map (as designed vs as implemented)

**Intended:** Referrer receives page (P1) → reads → copies/sends message or clicks Make an introduction → fills form → submits → *(intended)* we contact the referred person → referred person lands on the sales page (P2) with the offer → Start a conversation → inquiry form → submit → we reply.

**Gaps in that journey:** P1 and P2 are **not linked** (nothing in P1 sends the prospect to P2; the share message contains no link at all). The copied message has no URL, so a recipient cannot find the offer. Neither form transmits data. There is no mechanism that ties a P2 inquiry to the referrer.

**Rebuild fix (carried to FEATURE_MAPPING):** the share message includes a campaign-specific, non-guessable link to the prospect landing page, which carries attribution server-side.
