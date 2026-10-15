import { currentVersion, findImported, isDraftVersion, showDrafts } from "@/content/builder-templates";
import { packageBase } from "@/lib/builder/template-package";

/**
 * Sample websites shown in the home page's "Tailored services" carousel. Each one is an imported designer template
 * (npm run template:import, then template:publish) with a fixed preview token: /build/preview/<token> renders the
 * whole template as a read-only sample, without a SiteDraft row or a lead behind it.
 *
 * To add a sample: import and publish the template, then add an entry here with a new token
 * (node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))").
 */
export interface SampleSite {
  /** Unguessable-looking but public: 16–64 characters of [A-Za-z0-9_-], unique across samples. */
  token: string;
  /** Imported template slug, from src/content/builder-templates/manifest.json. */
  slug: string;
  /** Pinned template version, so the sample doesn't change when the template is re-imported. */
  version: number;
  title: string;
  description: string;
}

export const SAMPLE_SITES: SampleSite[] = [
  {
    token: "PT2OPZBwy8zmg0uJ4F-yeA",
    slug: "aurelia-advisory",
    version: 1,
    title: "Advisory firm website",
    description: "A refined business website for a professional services firm, with practice areas, case results and a consultation request form.",
  },
  {
    token: "Y84T2boFIRuwuh9AAKd2Cg",
    slug: "aurelia-store",
    version: 1,
    title: "Homeware online store",
    description: "An online store for handcrafted homeware, with curated categories, a product grid, a shoppable room scene and reviews.",
  },
  {
    token: "hCT0-y-W4qGL8T1dPTARQA",
    slug: "aurelia-portal",
    version: 1,
    title: "Client portal",
    description: "A secure portal where clients follow their engagement, share documents and message their advisor.",
  },
  {
    token: "Y_IKC6s7jH1_v8oNjpM0rg",
    slug: "aurelia-insights",
    version: 1,
    title: "Executive dashboard",
    description: "A business intelligence dashboard with live KPIs, revenue against forecast, a report builder and an audit feed.",
  },
  {
    token: "5SehrWX_9G4mKjbiKebxSQ",
    slug: "noir-needle",
    version: 1,
    title: "Tattoo studio",
    description: "A dark, editorial four-page site with a portfolio, artists, flash gallery and booking.",
  },
];

export const findSample = (token: string) => SAMPLE_SITES.find((s) => s.token === token);

/** The carousel needs at least this many samples; below it the home page keeps the service cards. */
export const MIN_SHOWCASE = 2;

export interface ShowcaseSample extends SampleSite {
  href: string;
  /** Template slug to start a new site from. */
  startSlug: string;
  pages: { title: string; thumbnail?: string }[];
  thumbnail: string;
}

/**
 * Where `npm run samples:screens` saves a sample page's landing screen (the first screen at tablet size, 3:4, which
 * fills a carousel slide), relative to public/.
 */
export const screenPath = (s: Pick<SampleSite, "slug" | "version">, pageKey: string) => `/images/samples/${s.slug}-v${s.version}-${pageKey || "home"}.webp`;

/**
 * Samples that can be shown: the template exists, the pinned version is imported, and (in production) published.
 * Each page uses its landing screen when one was captured (`hasScreen` checks the file), otherwise the template's
 * thumbnail. Manifest thumbnails belong to the latest version, so a sample pinned to an older one is skipped rather
 * than shown with another version's screens.
 */
export function showcaseSamples(samples: SampleSite[] = SAMPLE_SITES, drafts = showDrafts(), hasScreen: (path: string) => boolean = () => false): ShowcaseSample[] {
  return samples.flatMap((s) => {
    const t = findImported(s.slug);
    if (!t || !t.versions.includes(s.version)) return [];
    if (!drafts && isDraftVersion(t, s.version)) return [];
    if (Math.max(...t.versions) !== s.version || !t.thumbnails[0]) return [];
    const base = packageBase(t.slug, s.version);
    const pages = t.pages.map((p, i) => {
      const screen = screenPath(s, p.key);
      return { title: p.title, thumbnail: hasScreen(screen) ? screen : t.thumbnails[i] ? `${base}/${t.thumbnails[i]}` : undefined };
    });
    return [{ ...s, href: `/build/preview/${s.token}`, startSlug: currentVersion(t, drafts) ? t.slug : "", pages, thumbnail: pages[0]!.thumbnail ?? `${base}/${t.thumbnails[0]}` }];
  });
}
