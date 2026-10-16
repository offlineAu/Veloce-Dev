/*
 * Names and kinds for a template's sections. Designers' exports label sections with whatever their HTML comments say
 * ("HERO", "SERVICES (bento)", "Atmospheric Luxury Hero Section", "Interactive Slide-Out Mini-Cart Drawer (Hidden by");
 * the builder shows short, plain names instead ("Hero", "Services", "Slide-out mini-cart drawer") and groups sections
 * by what they are (navigation, hero, pricing, reviews…). Used by the importer, and when any template is loaded, so
 * templates imported before this keep working with clean names. No React.
 */
import type { ElementNode, TemplatePackage, TemplateSection, TreeNode } from "./template-package";

export const SECTION_KINDS = ["navigation", "hero", "features", "pricing", "reviews", "faq", "cta", "contact", "gallery", "logos", "footer", "other", "utility"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** How each kind is titled in the Blocks panel, in the panel's order (utility parts are never offered). */
export const KIND_TITLES: Record<Exclude<SectionKind, "utility">, string> = {
  navigation: "Navigation", hero: "Hero", features: "Features", pricing: "Pricing", reviews: "Reviews", faq: "FAQ",
  cta: "Call to action", contact: "Contact and booking", gallery: "Gallery", logos: "Logos", footer: "Footer", other: "Other",
};

// Not "IT", "US" or "HR": in ALL-CAPS labels ("HOW IT WORKS") they're ordinary words.
const ACRONYMS = new Set(["FAQ", "CTA", "SEO", "AI", "BI", "UK", "USA", "AU", "NZ", "EU", "UI", "UX", "API", "CEO", "VIP", "24/7"]);
/** Words that say nothing about what a section is. */
const NOISE = new Set(["section", "block", "component", "wrapper", "container", "module", "element", "area"]);
const LEAD_NOISE = /^(interactive|main|primary|sticky|global|custom)\s+/i;
/** Whole-label synonyms. */
const SYNONYMS: Record<string, string> = { topbar: "Top bar", "top bar": "Top bar", navbar: "Navigation", nav: "Navigation", menu: "Navigation", masthead: "Hero", questions: "FAQ", "q&a": "FAQ", faqs: "FAQ", cta: "Call to action" };

const KIND_WORDS: [SectionKind, RegExp][] = [
  ["utility", /^icons?\b|sprite/i],
  ["navigation", /\b(header|nav|navbar|navigation|menu|top ?bar|side ?panel|sidebar)\b/i],
  ["footer", /\bfooter\b/i],
  ["hero", /\b(hero|masthead|intro|landing|splash)\b/i],
  ["faq", /\b(faq|faqs|questions|q&a|accordion)\b/i],
  ["reviews", /\b(reviews?|testimonials?|feedback|accolades?|quotes?)\b/i],
  ["pricing", /\b(pricing|prices?|plans?|estimate|costs?|rates|packages)\b/i],
  ["logos", /\b(logos?|brands?|partners?|clients|syndicate|sponsors?|trusted)\b/i],
  ["contact", /\b(contact|booking|book|consultation|appointment|intake|reserve|reservation|enquir\w*|inquir\w*|form)\b/i],
  ["cta", /\b(cta|call to action|closing|newsletter|subscribe|subscription|action bar|ribbon|banner)\b/i],
  ["gallery", /\b(gallery|portfolio|lookbook|showcase|mosaic|archives?|recent jobs|our work|projects|catalog|products?)\b/i],
  ["features", /\b(services?|features?|offerings?|benefits|how it works|process|steps|ritual|experience|story|about|areas|telemetry|outcomes|stats|numbers)\b/i],
];

const words = (s: string) => s.split(/\s+/).filter(Boolean);

function sentenceCase(s: string): string {
  return words(s)
    .map((w, i) => {
      const bare = w.replace(/[^\w/&-]/g, "");
      if (ACRONYMS.has(bare.toUpperCase())) return w.toUpperCase();
      const lower = w.toLowerCase();
      return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(" ");
}

/**
 * A short, plain name for a section from its raw label: parentheses and noise words dropped, cut at the first
 * separator, at most four words, sentence case. Labels that were cut off mid-word lose the partial word.
 */
export function cleanLabel(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "Section";
  // A label stored cut off at the importer's old limit: drop the partial last word.
  if (t.length >= 48 && !/[\s)]$/.test(raw)) t = t.replace(/\s+\S*$/, "");
  t = t.replace(/\([^)]*\)?|\[[^\]]*\]?/g, " ").replace(/\bhidden by\b.*$/i, " ");
  // camelCase and snake_case/kebab names read as words.
  t = t.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const syn = SYNONYMS[t.toLowerCase()];
  if (syn) return syn;
  // The name is what comes before a separator ("Editorial deep dive: …", "Appointment / consultation …").
  t = t.split(/\s[:/|–—]\s|:\s|\s\/\s|\s&\s|\sand\s|\sfor\s|\swith\s/i)[0]!.trim();
  t = t.replace(LEAD_NOISE, "");
  let list = words(t).filter((w, i, all) => !(NOISE.has(w.toLowerCase()) && all.length > 1));
  if (!list.length) list = words(t);
  if (list.length > 4) list = list.slice(0, 4);
  const out = sentenceCase(list.join(" ")).replace(/[\s,.;:-]+$/, "");
  return SYNONYMS[out.toLowerCase()] ?? (out || "Section");
}

const isEl = (n: TreeNode): n is ElementNode => typeof n === "object" && "t" in n;
function* nodes(n: ElementNode): Generator<ElementNode> {
  yield n;
  for (const c of n.c ?? []) if (isEl(c)) yield* nodes(c);
}

/** What a section is, from its raw label, then its markup and place on the page. */
export function sectionKind(raw: string, tree: ElementNode | undefined, index: number, total: number): SectionKind {
  const label = raw.replace(/\([^)]*\)/g, (m) => ` ${m} `);
  // Parenthetical notes ("(FAQ Accordion)", "(Logo Slider)") often say it best; the label's own words come first.
  const own = label.replace(/\([^)]*\)/g, " ");
  for (const text of [own, label]) for (const [kind, re] of KIND_WORDS) if (re.test(text)) return kind;
  if (!tree) return "other";
  const all = [...nodes(tree)];
  const tags = (t: string) => all.filter((n) => n.t === t).length;
  if (tree.t === "svg" && all.some((n) => n.t === "symbol")) return "utility";
  if (tree.t === "header" || tree.t === "nav") return "navigation";
  if (tree.t === "footer") return "footer";
  if (tags("h1") && index < 3) return "hero";
  if (tags("form") || tags("input") + tags("textarea") + tags("select") >= 2) return "contact";
  if (tags("blockquote") >= 2 || tags("figure") >= 3 && tags("blockquote")) return "reviews";
  if (tags("img") >= 4 && tags("p") <= 2) return "gallery";
  if (index >= total - 2 && tags("a") + tags("button") >= 1 && all.length < 25) return "cta";
  return all.length > 12 ? "features" : "other";
}

/** A package with clean section names and kinds (templates imported before these existed included), names unique per page. */
export function normalizePackage(pkg: TemplatePackage): TemplatePackage {
  return {
    ...pkg,
    pages: pkg.pages.map((page) => {
      const used = new Map<string, number>();
      return {
        ...page,
        sections: page.sections.map((s, i): TemplateSection => {
          const rawLabel = s.rawLabel ?? s.label;
          const kind = s.kind ?? sectionKind(rawLabel, s.tree, i, page.sections.length);
          let base = s.rawLabel ? s.label : cleanLabel(rawLabel);
          // "Section 2" says nothing: name it after what it is.
          if (/^\d*$/.test(base) || base === "Section") base = kind === "other" || kind === "utility" ? "Section" : KIND_TITLES[kind];
          const n = (used.get(base) ?? 0) + 1;
          used.set(base, n);
          return { ...s, rawLabel, label: n === 1 ? base : `${base} ${n}`, kind };
        }),
      };
    }),
  };
}

/**
 * A layer name as shown: a site made from a template before names were cleaned stores the section's raw label as its
 * name ("HERO"); that shows as the clean one. Names visitors typed are never changed.
 */
export function displayName(name: string, pkg: TemplatePackage | undefined): string {
  if (!pkg) return name;
  for (const page of pkg.pages) for (const s of page.sections) if (s.rawLabel && s.rawLabel !== s.label && name === s.rawLabel.slice(0, 60)) return s.label;
  return name;
}
