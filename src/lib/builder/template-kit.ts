/*
 * A template's "design kit": the class strings its own headings, text, buttons, cards and sections use. Native blocks
 * render with these (their "Template" look), so a pricing table or FAQ added to an imported design looks like the
 * design. Derived from the package's section trees, so it works for every package, old or new. No React.
 */
import type { ElementNode, TemplatePackage, TreeNode } from "./template-package";

export interface DesignKit {
  h1?: string;
  h2?: string;
  h3?: string;
  text?: string;
  label?: string;
  button?: string;
  buttonAlt?: string;
  card?: string;
  section?: string;
  container?: string;
  image?: string;
}

interface Visit {
  el: ElementNode;
  parent?: ElementNode;
  /** Root of a list item (card, step, link…). */
  listItem: boolean;
  /** Inside the page's header, navigation or footer: site chrome, not content. */
  chrome: boolean;
  /** The section's default field values, to measure text by its real content. */
  values: Record<string, string>;
}

const isEl = (n: TreeNode): n is ElementNode => typeof n === "object" && "t" in n;
const cls = (n: ElementNode) => (typeof n.a?.className === "string" ? n.a.className : "");
const utility = (token: string) => token.replace(/^vt:/, "").split(":").pop()!.replace(/!$/, "");
const has = (c: string, re: RegExp) => c.split(/\s+/).some((t) => re.test(utility(t)));
const CHROME = new Set(["header", "nav", "footer", "aside"]);

function* walk(node: TreeNode, parent: ElementNode | undefined, chrome: boolean, values: Record<string, string>, listItem = false): Generator<Visit> {
  if (!isEl(node)) {
    if (typeof node === "object" && "r" in node) yield* walk(node.item, parent, chrome, values, true);
    return;
  }
  const inChrome = chrome || CHROME.has(node.t);
  yield { el: node, parent, listItem, chrome: inChrome, values };
  for (const c of node.c ?? []) yield* walk(c, node, inChrome, values);
}

/** Visible text, using the section's default values for editable text (list items, which have their own, count as one word). */
const textOf = (n: TreeNode, values: Record<string, string>): string =>
  typeof n === "string" ? n : isEl(n) ? (n.c ?? []).map((c) => textOf(c, values)).join(" ") : "f" in n ? (values[n.f] ?? "word") : "";
const textOnly = (el: ElementNode) => (el.c ?? []).every((c) => typeof c === "string" || "f" in (c as object) || (isEl(c) && ["br", "span", "strong", "em", "b", "i"].includes(c.t)));

/** The most common non-empty value (ties go to the earliest). */
function mostCommon(values: (string | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | undefined;
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

/**
 * Keeps how a piece looks, drops where it sits: margins, positioning, stacking, grid placement and hide/show toggles
 * belong to the layout around it, which the builder controls.
 */
const PLACEMENT = /^(-?m[trblyse]?-.+|-?mx-(?!auto$).+|hidden|absolute|fixed|sticky|relative|-?inset.*|-?top-.+|-?left-.+|-?right-.+|-?bottom-.+|z-.+|order-.+|col-span-.+|col-start-.+|row-span-.+|self-.+|justify-self-.+|animate-.+|-?translate-.+|-?rotate-.+)$/;
const DISPLAY = /^(block|inline|inline-block|flex|inline-flex|grid|inline-grid)$/;
export function cleanKitClasses(c: string | undefined): string | undefined {
  if (!c) return undefined;
  const out = c.split(/\s+/).filter((t) => {
    if (!t) return false;
    const u = utility(t);
    const variant = t.replace(/^vt:/, "").includes(":");
    return !PLACEMENT.test(u) && !(variant && DISPLAY.test(u));
  });
  return out.join(" ") || undefined;
}

export function deriveKit(pkg: Pick<TemplatePackage, "pages">): DesignKit {
  const all = pkg.pages.flatMap((p) => p.sections.flatMap((s) => [...walk(s.tree, undefined, false, s.defaults ?? {})]));
  const content = all.filter((x) => !x.chrome);
  const of = (t: string, list = content) => list.filter((x) => x.el.t === t);

  const padded = (c: string) => has(c, /^p[xytrbl]?-/);
  const filled = (c: string) => has(c, /^bg-(?!transparent|clip|gradient|none|\[)/) && padded(c);
  const actions = content.filter((x) => x.el.t === "a" || x.el.t === "button");
  const primary = actions.filter((x) => filled(cls(x.el)));
  // Secondary buttons sit next to a primary one (hero CTAs: "Book now" + "See work").
  const besidePrimary = actions.filter((x) => !filled(cls(x.el)) && padded(cls(x.el)) && primary.some((p) => p.parent === x.parent));

  const sectionRoots = pkg.pages.flatMap((p) => p.sections.map((s) => s.tree)).filter((t) => t.t === "section");
  const containers = sectionRoots.flatMap((s) => (s.c ?? []).filter(isEl)).map(cls).filter((c) => has(c, /^(max-w-.+|mx-auto|container)$/));
  // Cards: list items with padding and something to read in them (not icon circles or tags).
  const cards = content.filter((x) => {
    const c = cls(x.el);
    return x.listItem && padded(c) && (has(c, /^rounded/) || has(c, /^bg-/) || has(c, /^border/)) && !has(c, /^rounded-full$/) && textOf(x.el, x.values).length > 20;
  });
  const paragraphs = of("p").filter((x) => textOnly(x.el) && textOf(x.el, x.values).length > 40);

  const kit: DesignKit = {
    h1: cls(of("h1", all)[0]?.el ?? { t: "h1" }) || undefined,
    h2: mostCommon(of("h2").map((x) => cls(x.el))),
    h3: mostCommon(of("h3").map((x) => cls(x.el))),
    text: mostCommon(paragraphs.map((x) => cls(x.el))) ?? mostCommon(of("p").filter((x) => textOnly(x.el)).map((x) => cls(x.el))),
    label: mostCommon(content.filter((x) => (x.el.t === "span" || x.el.t === "p") && textOnly(x.el) && has(cls(x.el), /^uppercase$/)).map((x) => cls(x.el))),
    button: mostCommon(primary.map((x) => cls(x.el))),
    buttonAlt: mostCommon(besidePrimary.map((x) => cls(x.el))),
    card: mostCommon(cards.map((x) => cls(x.el))),
    section: mostCommon(sectionRoots.map(cls).filter((c) => !has(c, /^-m[ty]?-.+$/))),
    container: mostCommon(containers),
    image: mostCommon(of("img").map((x) => cls(x.el)).filter((c) => has(c, /^w-full$/))) ?? mostCommon(of("img").map((x) => cls(x.el)).filter((c) => has(c, /^(object-cover|aspect-.+)$/))),
  };
  return Object.fromEntries(Object.entries(kit).map(([k, v]) => [k, cleanKitClasses(v)])) as DesignKit;
}

/** How Tailwind escapes a class in a selector (same as the importer's check). */
const escapeClass = (c: string) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);

/**
 * The kit of a loaded template, worked out once per package. With the template's stylesheet, class names it never
 * defines (script hooks such as "next-step-trigger") are left out.
 */
const cache = new WeakMap<object, DesignKit>();
export function kitOf(pkg: TemplatePackage | undefined, css?: string): DesignKit | undefined {
  if (!pkg) return undefined;
  let k = cache.get(pkg);
  if (!k) {
    k = deriveKit(pkg);
    if (css) {
      const known = (c: string | undefined) => c?.split(/\s+/).filter((t) => css.includes(`.${escapeClass(t)}`)).join(" ") || undefined;
      k = Object.fromEntries(Object.entries(k).map(([r, c]) => [r, known(c)])) as DesignKit;
    }
    cache.set(pkg, k);
  }
  return k;
}
