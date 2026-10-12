# SEO launch and measurement

This release targets global English-speaking businesses looking for business websites, redesign, and e-commerce development. Page content lives in `src/content/seo.ts`; it uses the existing inquiry service slugs and does not require a database migration.

## Before deployment

- Run lint, typecheck, the production build, and the SEO browser tests. Use real deployment environment values: the local `.env.production.local` may contain redacted placeholders and is not suitable for a release build.
- Set `NEXT_PUBLIC_SITE_URL` to `https://veloceapp.dev`. Check the configured company name, contact email, and social links. Organization markup uses these values and makes no unverified client or location claims.
- Verify the primary HTTPS hostname and alternate hostname redirects after deployment. `next.config.ts` redirects `www.veloceapp.dev` to `https://veloceapp.dev` with a permanent 308, preserving the path and query. HTTP already redirects to HTTPS at the hosting layer. Keep clean page URLs canonical; do not redirect away referral queries needed for attribution.
- Review the new content for accuracy. Add client work, biographies, testimonials, or metrics only when verified and cleared for publication.

## Domain owner: Search Console setup

1. Open [Google Search Console](https://search.google.com/search-console) and add the domain property `veloceapp.dev`.
2. Add the verification TXT record Google supplies through your DNS provider, then complete verification. Do not invent a record value or replace existing DNS records.
3. Submit `https://veloceapp.dev/sitemap.xml`.
4. Inspect the homepage, `/about`, and all three `/services/` pages. Confirm crawling is allowed, rendered content is present, and the selected canonical is the clean production URL. Request indexing after deployment.
5. Confirm `/build`, design previews, and `/refer/` pages remain excluded through their `noindex` tags. Referral pages are intentionally crawlable so Google can read the tag. Tokens are access links; `noindex` is not access control.

See [Google’s noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

## Baseline and reviews

- At launch, record deployment date, sitemap submission, inspection results, and mobile Lighthouse results for the homepage and new pages. Lab targets are LCP ≤2.5 seconds and CLS ≤0.1; field performance should be assessed when data becomes available.
- At 28 days, export Search Console clicks, impressions, CTR, average position, queries, landing pages, and country breakdown. Separate branded searches from service searches and compare equal date windows.
- At 90 days, review trends and identify which service queries produce relevant visits. Improve weak pages based on actual buyer queries before expanding into guides or country-specific content.
- Review existing lead records by service slug and landing path. Those records measure inquiries, not proven organic conversions. No analytics vendor or new attribution system is included in this release.
- Validate JSON-LD with [Schema Markup Validator](https://validator.schema.org/) and supported features with [Google’s Rich Results Test](https://search.google.com/test/rich-results). Markup does not guarantee a rich result or ranking.

## Acceptance checks

The sitemap has seven public URLs: homepage, three service pages, About, privacy, and terms. All return successfully with distinct titles/descriptions and clean canonicals. Unknown service slugs return HTTP 404. Service content and navigation render without JavaScript. Marketing pages have no blocking boot loader. Mobile and desktop navigation, service-specific inquiries, referral context, preview exclusions, and existing booking flows continue to work.

## Local validation results (2026-10-10)

Lint, typecheck, the production build, two SEO unit tests, and 72 production browser checks passed. Browser checks covered mobile, tablet, and desktop, including inquiry persistence, referral handling, hostname redirects, accessibility, and the meeting-request fallback. A saved design preview also returned `noindex`. The build used temporary local environment overrides because the production overlay contains redacted placeholders; production deployment configuration still needs verification.

Mobile Lighthouse, default simulated throttling, against the local production server:

| Page | Performance | LCP | CLS | Total blocking time |
| --- | ---: | ---: | ---: | ---: |
| Homepage | 84 | 4.4 s | 0 | 20 ms |
| Business websites | 93 | 3.3 s | 0 | 40 ms |
| Website redesign | 90 | 3.5 s | 0 | 30 ms |
| E-commerce | 90 | 3.6 s | 0 | 30 ms |
| About | 91 | 3.5 s | 0 | 20 ms |

The pre-change live homepage run scored 79 with LCP 4.3 seconds and CLS 0. The live and local runs use different environments, so they do not establish a performance improvement. LCP remains above the 2.5-second target on all inspected pages. Recheck after deployment and use production field data to prioritize further optimization. Search Console verification and sitemap submission have not been performed.

