/*
 * Step 3c: a hand-written design's own stylesheet (pages styled by their <style> blocks rather than Tailwind).
 * The CSS is kept, made safe and scoped like the compiled Tailwind CSS:
 *   - the design's class names become `vt-<name>` (as in the markup, classes.ts), so they can't meet the site's
 *   - every selector is scoped to the template root; `html`, `body` and `:root` are the root itself
 *   - it sits in the `components` layer, so classes added in the Style panel (utilities) still win
 *   - keyframe names get the template's prefix, so two templates' animations can't collide
 *   - remote files: background images are downloaded into the template (like the markup's); anything else, @import,
 *     and values that could run or load something are dropped
 *   - states the page's script would switch on as content scrolls into view (`.in`, `.show`, `.play`…) are applied
 *     up front, since scripts don't come along: otherwise that content would stay invisible
 * Also reads the design's colours and fonts from its `:root` custom properties, for the builder theme.
 */
import postcss, { type AtRule, type ChildNode, type Container, type Declaration, type Rule } from "postcss";
import { REVEAL_STATES, STATE_ALIAS, standaloneClass, type BehaviourMap } from "./behaviours";
import { AS_BUTTON, customClassName } from "./classes";
import { STANDIN_TAGS } from "./ir";
import type { DesignTokens } from "./theme";
import type { Report } from "./report";

export const MAX_PAGE_CSS = 400_000;

/** Parts that only show for a moment (a typing indicator, a loader): never forced visible. */
const TRANSIENT = /typing|loader|loading|spinner|skeleton/i;

const UNSAFE_VALUE = /expression\s*\(|javascript:|vbscript:|-moz-binding|behaviou?r\s*:|@import/i;
const URL_IN_VALUE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,]/i;

/** Splits on `sep` at the top level only (outside brackets, parentheses and strings). */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = "";
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (quote) {
      if (ch === "\\") {
        cur += ch + (s[++i] ?? "");
        continue;
      }
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Applies `fn` to every class name in a selector (outside strings and attribute brackets), returning the new selector.
 * `fn` returning null drops that `.class` from the selector.
 */
function mapClasses(selector: string, fn: (name: string) => string | null): string {
  let out = "";
  let quote = "";
  let attr = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i]!;
    if (quote) {
      out += ch;
      if (ch === "\\") out += selector[++i] ?? "";
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "[") attr++;
    else if (ch === "]") attr--;
    else if (ch === "\\") {
      out += ch + (selector[++i] ?? "");
      continue;
    } else if (ch === "." && attr === 0) {
      const m = /^-?[_a-zA-Z][\w-]*/.exec(selector.slice(i + 1));
      if (m) {
        const next = fn(m[0]);
        // A class may become an attribute selector or a choice (a script's state class → the runtime's state).
        if (next !== null) out += /^[[:]/.test(next) ? next : `.${next}`;
        i += m[0].length;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

/** Every class name a stylesheet's selectors use. */
export function cssClasses(css: string): Set<string> {
  const out = new Set<string>();
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return out;
  }
  root.walkRules((r) => {
    if (r.parent?.type === "atrule" && /keyframes$/i.test((r.parent as AtRule).name)) return;
    mapClasses(r.selector, (n) => (out.add(n), n));
  });
  return out;
}

/** Classes the page's scripts add, toggle, remove or test (`el.classList.add("in")`). */
export function scriptClasses(scripts: string[]): Set<string> {
  const out = new Set<string>();
  for (const s of scripts)
    for (const m of s.matchAll(/classList\.(?:add|toggle|remove|contains)\(\s*(["'])([\w-]+)\1/g)) out.add(m[2]!);
  return out;
}

/** One complex selector scoped to the template root. */
function scopeSelector(sel: string, scope: string): string {
  const s = sel.trim();
  if (!s) return s;
  // html, body and :root (alone, or with classes and states of their own) are the template root.
  const lead = /^(?:html|:root)(?=$|[\s>+~.#:[])/.exec(s) ?? /^body(?=$|[\s>+~.#:[])/.exec(s);
  if (lead) {
    let rest = s.slice(lead[0].length);
    // "html body …" and "html > body …": body is the root too.
    rest = rest.replace(/^\s*>?\s*body(?=$|[\s>+~.#:[])/, "");
    // Direct children of <body> sit deeper inside the builder: any depth will do.
    rest = rest.replace(/^\s*>\s*/, " ");
    return `${scope}${rest}`;
  }
  return `${scope} ${s}`;
}

export interface PageCssOptions {
  slug: string;
  /** The design's own classes (they become vt-<name>). */
  classes: Set<string>;
  /** Classes the page's scripts switch on. */
  scriptStates: Set<string>;
  /** Remote image address → its file in the template (after downloading); anything not here is dropped. */
  asset: (url: string) => string | undefined;
  /** The page's interactions, recreated by the builder's runtime (import/behaviours.ts). */
  behaviours?: BehaviourMap;
  report: Report;
}

/** The remote images a stylesheet loads (background photos, textures), to download into the template. */
export function cssImageUrls(css: string): string[] {
  const out = new Set<string>();
  for (const m of css.matchAll(URL_IN_VALUE)) if (/^https:\/\//i.test(m[2]!.trim())) out.add(m[2]!.trim());
  return [...out];
}

export function scopePageCss(css: string, opts: PageCssOptions): string {
  const { report } = opts;
  const scope = `[data-vt="${opts.slug}"]`;
  if (css.length > MAX_PAGE_CSS) {
    report.warn(`The page's stylesheet is over ${MAX_PAGE_CSS / 1000} KB; only the first part was kept.`);
    css = css.slice(0, MAX_PAGE_CSS);
  }
  let root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    report.warn(`The page's stylesheet couldn't be read (${(e as Error).message.slice(0, 120)}); the design is unstyled.`);
    return "";
  }
  const map = opts.behaviours;
  // With the runtime recreating the page's interactions, its state classes become the runtime's states.
  const stateOf = (n: string) => (map && opts.scriptStates.has(n) ? STATE_ALIAS[n] : undefined);
  const rename = (n: string) => {
    const state = stateOf(n);
    // The runtime's state where an interaction sets it, or the class the captured page left on the element.
    if (state) return opts.classes.has(n) ? `:is(.${customClassName(n)},[data-vt-state~="${state}"])` : `[data-vt-state~="${state}"]`;
    return opts.classes.has(n) ? customClassName(n) : n;
  };
  const attrRenames = [...(map?.attrs ?? new Map<string, string>())].map(([from, to]) => [new RegExp(`\\[${from}(?=[\\]=~|^$*\\s])`, "g"), `[${to}`] as const);
  const varName = (v: string) => map?.vars.get(v) ?? v;
  /** `attr(data-mark)` → the attribute it was kept as. */
  const renameAttrs = (value: string) => (map?.attrs.size && value.includes("attr(") ? value.replace(/attr\(\s*(data-[\w-]+)/g, (m, n: string) => (map.attrs.has(n) ? `attr(${map.attrs.get(n)}` : m)) : value);
  const renameVars = (value: string) => (map?.vars.size ? value.replace(/--[\w-]+/g, varName) : value);
  /** A selector with the design's names: classes, states, and the data attributes interactions replace. */
  // A design's `button` rules also style its buttons that became links (they navigate to a page: fields.ts), and its
  // rules for tags shown as a <span> (`output`: ir.ts) style the span.
  const STANDIN = new RegExp(`(^|[\\s>+~(,])(${STANDIN_TAGS.join("|")})(?![\\w-])`, "g");
  const buttons = (sel: string) =>
    sel.replace(/(^|[\s>+~(,])button(?![\w-])/g, `$1:is(button,.${AS_BUTTON})`).replace(STANDIN, (_m, pre: string, tag: string) => `${pre}:is(${tag},.as-${tag})`);
  const named = (sel: string) => attrRenames.reduce((s, [re, to]) => s.replace(re, to), mapClasses(buttons(sel), rename));
  const isTransient = (sel: string) => TRANSIENT.test(sel) || [...(map?.transient ?? [])].some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(sel));
  // Forced "revealed" copies wait for the runtime: they only apply while it isn't moving things (no script, reduced motion).
  const shownScope = map?.reveals ? `${scope}:not([data-vt-motion])` : scope;
  const keyframes = new Map<string, string>();
  root.walkAtRules(/keyframes$/i, (a) => {
    const name = a.params.trim();
    if (/^[\w-]+$/.test(name)) {
      keyframes.set(name, `vt-${opts.slug}-${name}`);
      a.params = keyframes.get(name)!;
    }
  });
  const reveals = [...opts.scriptStates].filter((s) => REVEAL_STATES.has(s));
  let revealed = 0;

  const visit = (container: Container<ChildNode>) => {
    for (const node of [...(container.nodes ?? [])]) {
      if (node.type === "comment") node.remove();
      else if (node.type === "atrule") {
        const name = node.name.toLowerCase();
        if (["import", "namespace", "charset", "document", "-moz-document"].includes(name)) {
          if (name === "import") report.count("stylesheet @import rules left out (files from other sites)");
          node.remove();
        } else if (name === "font-face") {
          // Fonts come from the page's Google Fonts links, downloaded into the template; other remote fonts don't.
          const src = String(node.nodes?.find((d): d is Declaration => d.type === "decl" && d.prop === "src")?.value ?? "");
          if ([...src.matchAll(URL_IN_VALUE)].some((m) => !/^data:font\//i.test(m[2]!.trim()))) {
            report.count("stylesheet @font-face rules left out (fonts from other sites)");
            node.remove();
          }
        } else if (/keyframes$/i.test(name)) cleanDecls(node);
        else if (name === "property") continue;
        else if (node.nodes) visit(node);
      } else if (node.type === "rule") {
        if (!cleanDecls(node)) {
          node.remove();
          continue;
        }
        const selectors = splitTop(node.selector, ",").map((s) => s.trim()).filter(Boolean);
        node.selector = selectors.map((s) => scopeSelector(named(s), scope)).join(",\n");
        if (selectors.every((s) => /^(html|body|:root)$/.test(s))) rootRule(node);
        // A state the script switches on (".bento.in .card"): the same rule without it, right after, so it applies now.
        const shown = selectors
          // Not where the state class is also a part of the layout on its own (`.sub .in`): without it, the rule
          // would land on another element.
          .filter((s) => !reveals.some((r) => standaloneClass(r).test(s)))
          .filter((s) => reveals.some((r) => mapClasses(s, (n) => (n === r ? null : n)) !== s))
          .filter((s) => !isTransient(s))
          .map((s) => mapClasses(s, (n) => (reveals.includes(n) ? null : n)))
          .filter((s) => /[\w\]*)]/.test(s.replace(/^[\s>+~]+|[\s>+~]+$/g, "")))
          .map((s) => scopeSelector(named(s), shownScope));
        if (shown.length) {
          node.after(node.clone({ selector: shown.join(",\n") }));
          revealed++;
        }
      } else if (node.type === "decl") {
        // Declarations outside any rule (invalid CSS) are dropped.
        node.remove();
      }
    }
  };

  /**
   * The page's own html/body rules now sit on the template root, an ordinary element inside the builder's page:
   * smooth scrolling and the space kept under a fixed header become settings the runtime and every section use, and
   * hiding sideways overflow clips instead (a scroll box around the page would stop sticky headers sticking).
   */
  function rootRule(node: Rule) {
    node.walkDecls((d) => {
      if (/^overflow(-x)?$/i.test(d.prop) && /^hidden$/i.test(d.value.trim())) d.value = "clip";
      else if (/^scroll-behavior$/i.test(d.prop)) d.replaceWith(postcss.decl({ prop: "--vt-smooth", value: /smooth/i.test(d.value) ? "1" : "0" }));
      else if (/^scroll-padding(-top)?$/i.test(d.prop)) {
        node.after(postcss.rule({ selector: `${scope} :where([id])`, nodes: [postcss.decl({ prop: "scroll-margin-top", value: d.value })] }));
        d.remove();
      }
    });
  }

  /** Drops unsafe declarations and remote files; renames keyframes and variables. False when nothing is left. */
  function cleanDecls(node: Rule | AtRule): boolean {
    node.walkDecls((d) => {
      if (d.prop.startsWith("--")) d.prop = varName(d.prop);
      d.value = renameAttrs(renameVars(d.value));
      if (UNSAFE_VALUE.test(d.value)) {
        report.count("unsafe stylesheet values removed");
        d.remove();
        return;
      }
      let dropped = false;
      d.value = d.value.replace(URL_IN_VALUE, (whole, _q: string, raw: string) => {
        const url = raw.trim();
        if (SAFE_DATA_IMAGE.test(url) || url.startsWith("#")) return whole;
        const local = /^https:\/\//i.test(url) ? opts.asset(url) : undefined;
        if (local) return `url("${local}")`;
        dropped = true;
        return whole;
      });
      if (dropped) {
        report.count("stylesheet images left out (couldn't be downloaded, or not https)");
        d.remove();
        return;
      }
      if (/^(animation|animation-name)$/i.test(d.prop) && keyframes.size)
        d.value = d.value.replace(/[\w-]+/g, (w) => keyframes.get(w) ?? w);
    });
    return node.type === "atrule" || (node.nodes?.length ?? 0) > 0;
  }

  visit(root);
  if (revealed) report.count("script-revealed states applied up front (content that animated in on scroll)", revealed);
  const states = [...opts.scriptStates].filter((s) => !REVEAL_STATES.has(s) && !stateOf(s));
  if (states.length)
    report.warn(`The page's script switched these classes on and off; they show their first state: ${states.slice(0, 20).map((s) => `\`${s}\``).join(", ")}. Check the parts that use them.`);
  // Below utilities: classes added in the Style panel override the design's own CSS.
  // Headings take their font from the design's own rules (after this one), or else inherit the body's, as in the
  // original, rather than the site's (the builder leaves a hand-written design's headings alone: config.tsx).
  // The site's reset takes list markers off; a design's own lists (no classes but its own) keep the browser's, as in the original.
  const lists = `${scope} :where(ul:not([class]),ul[class^="vt-"]:not([class*="vt:"])){list-style:disc}\n${scope} :where(ol:not([class]),ol[class^="vt-"]:not([class*="vt:"])){list-style:decimal}`;
  return `@layer components {\n${scope} :is(h1,h2,h3,h4,h5,h6){font-family:inherit}\n${lists}\n${root.toString()}\n}`;
}

/** Colours and fonts from the design's `:root { --name: value }`, for the builder's theme. */
const GENERIC_FONT = /^(system-ui|-apple-system|sans-serif|serif|monospace|ui-[\w-]+|"?Segoe UI"?|BlinkMacSystemFont)$/i;
const families = (value: string) => splitTop(value, ",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter((f) => f && !GENERIC_FONT.test(f));

/** How a hand-written page uses its colour tokens: what its body is painted with (token names). */
export interface PageCssUsage {
  bodyBg?: string;
  bodyText?: string;
}

export function tokensFromPageCss(css: string): Pick<DesignTokens, "colors" | "fontFamily"> & { usage: PageCssUsage } {
  const colors: Record<string, string> = {};
  const fontFamily: Record<string, string[]> = {};
  const usage: PageCssUsage = {};
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return { colors, fontFamily, usage };
  }
  const vars = new Map<string, string>();
  root.walkRules((r) => {
    if (!splitTop(r.selector, ",").some((s) => /^\s*(:root|html)\s*$/.test(s))) return;
    r.walkDecls(/^--[A-Za-z][\w-]{0,58}$/, (d) => {
      const name = d.prop.slice(2);
      const value = d.value.trim();
      if (!vars.has(name)) vars.set(name, value);
      if (/^#[0-9a-f]{6}$/i.test(value)) colors[name] = value.toLowerCase();
      else if (/^#[0-9a-f]{3}$/i.test(value)) colors[name] = `#${[...value.slice(1)].map((c) => c + c).join("")}`.toLowerCase();
      else if (/^font(-|$)/i.test(name) && !/url\(|[;{}]/.test(value)) {
        const f = families(value);
        if (f.length) fontFamily[name.replace(/^font-?/i, "") || "body"] = f;
      }
    });
  });
  // What the page itself sets on its body and top headings, so a design that names its tokens freely (`--serif`,
  // `--paper`) still gets the right heading font and background. `var(--x)` is resolved through :root.
  const token = (value: string) => /^var\(--([\w-]+)\s*(?:,[^)]*)?\)$/.exec(value.trim())?.[1];
  const resolve = (value: string) => (token(value) ? (vars.get(token(value)!) ?? "") : value);
  let heading: string[] | undefined;
  let body: string[] | undefined;
  root.walkRules((r) => {
    if (r.parent?.type !== "root") return;
    const sels = splitTop(r.selector, ",").map((s) => s.trim());
    const isBody = sels.some((s) => s === "body" || s === "html,body");
    const isHeading = sels.includes("h1");
    if (!isBody && !isHeading) return;
    r.walkDecls((d) => {
      if (isBody && (d.prop === "background" || d.prop === "background-color") && token(d.value) && colors[token(d.value)!]) usage.bodyBg ??= token(d.value);
      if (isBody && d.prop === "color" && token(d.value) && colors[token(d.value)!]) usage.bodyText ??= token(d.value);
      if (d.prop === "font-family" && !/url\(|[;{}]/.test(resolve(d.value))) {
        const f = families(resolve(d.value));
        if (!f.length) return;
        if (isHeading) heading ??= f;
        else body ??= f;
      }
    });
  });
  // A page whose headings don't name their own font sets them in the body's.
  if (!heading && !Object.keys(fontFamily).some((k) => /^(display|headline|heading|head$|h1|title)/i.test(k))) heading = body;
  // Ahead of the name guesses (theme.ts picks the first key that looks like a heading or body font).
  return { colors, fontFamily: { ...(heading ? { heading } : {}), ...(body ? { body } : {}), ...fontFamily }, usage };
}
