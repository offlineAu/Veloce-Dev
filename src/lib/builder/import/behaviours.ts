/*
 * Step 2b: a template's interactions, mapped onto the builder's own (lib/builder/behaviours.ts). Its scripts never come
 * along, so what they did is recognised and written as `data-vt-*` behaviours on the elements, which the builder's
 * runtime then performs, with the template's own CSS doing the looks:
 *   - common markers: `data-reveal`/`data-aos` (reveal on scroll), `data-split` (words slide in), `data-count`
 *     (count up), a button with `aria-controls` + `aria-expanded` (opens and closes its target, e.g. a mobile menu),
 *     a list of items each with an `aria-expanded` button (accordion), a navigation of in-page links whose script marks
 *     the current one (scroll-spy), a form next to a thank-you element
 *   - hints for one template (`--hints`, scripts/template-hints/*.json): `{ selector, set, remove }` for what can't be
 *     recognised in general (an endless photo wall, a review stack…)
 *   - the CSS variables a script set (`--d`, `--shift`…) are renamed to the runtime's (`--vt-d`, `--vt-shift`…), and the
 *     data attributes the CSS targets (`[data-reveal]`) to the behaviours that replace them (`[data-vt-reveal]`)
 * Works on the parsed pages (ir.ts), before they're split into sections.
 */
import { BEHAVIOUR_ATTR, designDataAttr, parseBehaviour, type StateToken } from "../behaviours";
import postcss from "postcss";
import { classList, walk, type IREl } from "./ir";
import type { Report } from "./report";

export interface BehaviourHint {
  /** Simple CSS selectors, comma-separated: tag, #id, .class, descendant and `>` child. */
  selector: string;
  /** Attributes to set: behaviours (`data-vt-…`), or `required`, `aria-controls`, `aria-label`. */
  set?: Record<string, string | boolean>;
  /** Attributes to take off (a state a script left in the markup, inline styles it wrote). */
  remove?: string[];
}

export interface BehaviourMap {
  /** CSS variable a script set → the runtime's name. */
  vars: Map<string, string>;
  /** Data attribute the CSS targets → the behaviour attribute that replaces it. */
  attrs: Map<string, string>;
  /** Class names of elements that show only for a moment (typing dots): never forced visible. */
  transient: Set<string>;
  /** Whether anything on the pages reveals content (so forced "revealed" CSS can wait for the runtime). */
  reveals: boolean;
}

/** A class standing alone in a selector compound (`.sub .in`, `.in:hover`), not added to another (`h1.in`). */
export const standaloneClass = (name: string) => new RegExp(`(^|[\\s>+~(,])\\.${name.replace(/[^\w-]/g, "")}(?=$|[\\s>+~),:])`);

/** Classes a script adds to reveal content (scroll reveals, entrance animations, a typing indicator…). */
export const REVEAL_STATES = new Set(["in", "show", "shown", "visible", "is-visible", "revealed", "is-revealed", "in-view", "inview", "is-inview", "play", "playing", "animate", "animated", "loaded", "is-loaded", "ready", "is-ready", "appear", "appeared"]);

/** A script's state classes → the runtime state that replaces them (`.open` → `[data-vt-state~="open"]`). */
export const STATE_ALIAS: Record<string, StateToken> = {
  ...Object.fromEntries([...REVEAL_STATES].map((s) => [s, "in" as const])),
  open: "open", opened: "open", "is-open": "open", expanded: "open", "is-expanded": "open",
  on: "on", active: "on", "is-active": "on", current: "on", "is-current": "on", selected: "on", "is-selected": "on",
  hit: "hit", match: "hit", matched: "hit", "is-match": "hit",
  dim: "dim", dimmed: "dim", "is-dim": "dim",
  invalid: "invalid", error: "invalid", "has-error": "invalid", "is-invalid": "invalid",
};
const SET_ALLOWED = /^(required|aria-controls|aria-label|aria-expanded)$/;
/** Runtime names for variables templates commonly set from script. */
const VAR_NAMES: Record<string, string> = { "--mx": "--vt-x", "--my": "--vt-y" };

/* ---------------------------------------------------------------------------------------------- selector matching */

type Compound = { tag?: string; id?: string; classes: string[] };
type Step = { compound: Compound; combinator: " " | ">" };

function parseSelector(sel: string): Step[] | null {
  const steps: Step[] = [];
  let combinator: " " | ">" = " ";
  for (const raw of sel.trim().replace(/\s*>\s*/g, " > ").split(/\s+/)) {
    if (raw === ">") {
      combinator = ">";
      continue;
    }
    const m = /^([a-z][a-z0-9]*|\*)?((?:[#.][\w-]+)*)$/i.exec(raw);
    if (!m) return null;
    const compound: Compound = { classes: [] };
    if (m[1] && m[1] !== "*") compound.tag = m[1].toLowerCase();
    for (const part of m[2]!.match(/[#.][\w-]+/g) ?? []) {
      if (part[0] === "#") compound.id = part.slice(1);
      else compound.classes.push(part.slice(1));
    }
    steps.push({ compound, combinator });
    combinator = " ";
  }
  return steps.length ? steps : null;
}

const matches = (el: IREl, c: Compound) =>
  (!c.tag || el.tag === c.tag) && (!c.id || el.attrs.id === c.id) && c.classes.every((k) => classList(el).includes(k));

function matchesSteps(el: IREl, steps: Step[], parents: Map<IREl, IREl>): boolean {
  const last = steps.at(-1)!;
  if (!matches(el, last.compound)) return false;
  let cur: IREl | undefined = el;
  for (let i = steps.length - 2; i >= 0; i--) {
    const combinator = steps[i + 1]!.combinator;
    cur = parents.get(cur!);
    if (combinator === ">") {
      if (!cur || !matches(cur, steps[i]!.compound)) return false;
    } else {
      while (cur && !matches(cur, steps[i]!.compound)) cur = parents.get(cur);
      if (!cur) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------------------------------------------- mapping */

/** Behaviours that switch states on other elements: on their children, or on the elements their value names. */
const CONTAINERS = ["tabs", "stack", "accordion", "spy", "filter", "seq"];

/** The elements whose states the runtime sets: those with a behaviour, and the parts that containers and targets run. */
function drivenElements(all: IREl[], ids: Map<string, IREl>): Set<IREl> {
  const out = new Set<IREl>();
  const under = (root: IREl) => {
    for (const e of walk(root)) out.add(e);
  };
  for (const el of all) {
    for (const [a, v] of Object.entries(el.attrs)) {
      if (!BEHAVIOUR_ATTR.test(a) || a.startsWith("data-vt-x-")) continue;
      out.add(el);
      const name = a.slice("data-vt-".length);
      if (CONTAINERS.includes(name)) under(el);
      // The element a value names (tabs → its panels, toggle → its target, filter → its list, form → its thank-you).
      const target = ids.get(String(v).split(/\s+/)[0] ?? "");
      if (target && ["tabs", "toggle", "filter", "form"].includes(name)) under(target);
    }
  }
  return out;
}

/** A behaviour attribute on an element, if its value is valid. */
function put(el: IREl, attr: string, value: string, report: Report): boolean {
  const parsed = parseBehaviour(attr, value);
  if (parsed === null) {
    report.warn(`Ignored an interaction that isn't valid: ${attr}="${value.slice(0, 40)}".`);
    return false;
  }
  el.attrs[attr] = parsed;
  return true;
}

/** A plain number (`607`, `1,600`, `4.9`). */
const NUMBER = /^-?\d[\d,]*(\.\d+)?$/;

const INLINE = new Set(["b", "strong", "em", "i", "span", "small", "mark", "u", "sup", "sub"]);

/** Parts that only show for a moment (a typing indicator, a loader): never revealed for good. */
const TRANSIENT_CLASS = /typing|loader|loading|spinner|skeleton/i;

/** The classes of a selector's last part (".wall:hover .wall-col.down" → ["wall-col", "down"]); null if it's more than classes. */
function lastClasses(selector: string): string[] | null {
  const last = selector.trim().split(/\s*[\s>+~]\s*/).pop() ?? "";
  const m = /^((?:\.[\w-]+)+)$/.exec(last.replace(/::?[\w-]+(\([^)]*\))?/g, ""));
  return m ? m[1]!.split(".").filter(Boolean) : null;
}

type Slide = { axis: "x" | "y"; dir: "up" | "down" | "left" | "right" };

/**
 * What a design's CSS says its script animates (read, never run):
 *   - endless scrolls: keyframes that slide by a variable the script sets (`translateY(calc(var(--shift) * -1))`),
 *     with the classes of the elements that use them, and whether hovering pauses them
 *   - reveals: classes whose rules only apply once the script adds a reveal class (`.bento.in .card`, `.bubble.show`)
 */
function readScriptedCss(css: string, scriptVars: Set<string>, revealStates: Set<string>) {
  const slides: { classes: string[]; slide: Slide | null; order: number }[] = [];
  const paused: string[][] = [];
  const reveals = new Map<string, { stagger: boolean; children: string[][] }>();
  let root;
  try {
    root = postcss.parse(css);
  } catch {
    return { slides, paused, reveals };
  }
  const usesScriptVar = (v: string) => [...v.matchAll(/var\(\s*(--[\w-]+)/g)].some((m) => scriptVars.has(m[1]!));
  const frames = new Map<string, Slide>();
  root.walkAtRules(/keyframes$/i, (a) => {
    a.walkDecls(/^transform$/i, (d) => {
      const m = /translate(X|Y)\((.*)\)/i.exec(d.value);
      if (!m || !usesScriptVar(m[2]!)) return;
      const axis = m[1]!.toLowerCase() as "x" | "y";
      const step = (d.parent as postcss.Rule).selector.trim();
      const negative = /\*\s*-1|-\s*var|calc\(\s*-/.test(m[2]!);
      const atEnd = /^(to|100%)$/.test(step);
      // Ending further back (or starting there and coming forward) decides the way it moves.
      const back = atEnd === negative;
      frames.set(a.params.trim(), { axis, dir: axis === "y" ? (back ? "up" : "down") : back ? "left" : "right" });
    });
  });
  let order = 0;
  root.walkRules((r) => {
    if (r.parent?.type === "atrule" && /keyframes$/i.test((r.parent as postcss.AtRule).name)) return;
    order++;
    r.walkDecls((d) => {
      const prop = d.prop.toLowerCase();
      if (prop === "animation" || prop === "animation-name") {
        const name = d.value.split(/[\s,]+/).find((w) => frames.has(w));
        for (const sel of r.selectors) {
          const classes = lastClasses(sel);
          if (classes && (name || prop === "animation-name")) slides.push({ classes, slide: name ? frames.get(name)! : null, order });
        }
      }
      if (prop === "animation-play-state" && /paused/.test(d.value)) for (const sel of r.selectors) if (/:hover/.test(sel)) {
        const classes = lastClasses(sel);
        if (classes) paused.push(classes);
      }
    });
    // ".bento.in .card", ".bubble.show": the class next to a reveal state is what the script reveals.
    for (const sel of r.selectors) {
      for (const m of sel.matchAll(/((?:\.[\w-]+)+)/g)) {
        const parts = m[1]!.split(".").filter(Boolean);
        const own = parts.filter((p) => !revealStates.has(p));
        if (own.length === parts.length || !own.length || own.some((c) => TRANSIENT_CLASS.test(c))) continue;
        const key = own.join(".");
        const entry = reveals.get(key) ?? { stagger: false, children: [] };
        const child = lastClasses(sel.slice((m.index ?? 0) + m[0].length));
        if (child) entry.children.push(child);
        reveals.set(key, entry);
      }
    }
  });
  // A revealed part whose children each wait a script-set time (".card{transition-delay:calc(var(--d) * 1ms)}") staggers.
  const delayed: string[][] = [];
  root.walkDecls(/^(transition-delay|transition|animation-delay|animation)$/i, (d) => {
    if (!usesScriptVar(d.value) || !/delay|calc/.test(`${d.prop} ${d.value}`)) return;
    for (const sel of (d.parent as postcss.Rule).selectors ?? []) {
      const classes = lastClasses(sel);
      if (classes) delayed.push(classes);
    }
  });
  for (const v of reveals.values()) v.stagger = v.children.some((c) => delayed.some((d) => d.every((x) => c.includes(x))));
  return { slides, paused, reveals };
}

/** The text of an element, every level down. */
const textIn = (el: IREl): string => el.children.map((c) => (c.kind === "text" ? c.text : c.kind === "el" ? textIn(c) : "")).join("");

/**
 * Text a script split into one span per word or letter (for a slide-in or a flip), captured that way: folded back into
 * plain text, so the builder's own text effect can take over (the spans' letters are often drawn from data-* values,
 * which don't come along, and would show nothing).
 */
function unsplit(el: IREl, cssText: string): "split" | "flip" | "roll" | null {
  const spans = [...walk(el)].filter((x) => x !== el);
  if (spans.length < 3 || !spans.every((x) => x.tag === "span")) return null;
  // Only spans a script made: they carry a per-letter value (data-c) or an index (style="--i: 3"). Ordinary spans
  // (a row of tags, a price split for styling) stay as they are.
  const marked = spans.filter((x) => Object.keys(x.data ?? {}).length || /--[\w-]+\s*:/.test(x.attrs.style ?? "")).length;
  if (marked < spans.length / 2) return null;
  const letters = spans.filter((x) => x.children.every((c) => c.kind === "text") && textIn(x).trim().length <= 1 && textIn(x).length >= 1);
  const lettered = letters.length >= textIn(el).replace(/\s/g, "").length * 0.8 || spans.some((x) => x.data?.["data-c"] !== undefined);
  const worded = !lettered && el.children.every((c) => c.kind !== "el" || (c.tag === "span" && textIn(c).trim().split(/\s+/).length === 1));
  if (!lettered && !worded) return null;
  const text = textIn(el).replace(/\s+/g, " ").trim();
  // Letters that move on hover roll; ones that play once flip; words slide in.
  // A hover rule that reaches this text's own letter spans (".room:hover .roll .ch") means they roll.
  const spanClasses = [...new Set(spans.flatMap((x) => classList(x)))];
  const hovers = cssText.match(/[^{}]*:hover[^{}]*\{/g) ?? [];
  const rolls = spanClasses.some((c) => hovers.some((h) => new RegExp(`\\.${c.replace(/[-]/g, "\\-")}(?![\\w-])`).test(h)));
  const effect = !lettered ? "split" : rolls ? "roll" : "flip";
  el.children = [{ kind: "text", text }];
  return effect;
}

export function mapBehaviours(bodies: IREl[], opts: { scripts: string[]; css: string; scriptStates: Set<string>; hints?: BehaviourHint[]; report: Report }): BehaviourMap {
  const { report } = opts;
  const map: BehaviourMap = { vars: new Map(), attrs: new Map(), transient: new Set(), reveals: false };
  const counted = new Map<string, number>();
  const note = (what: string) => counted.set(what, (counted.get(what) ?? 0) + 1);

  // Variables the scripts set, renamed everywhere the design uses them.
  for (const s of opts.scripts) {
    for (const m of s.matchAll(/setProperty\(\s*["'](--[\w-]+)["']|(--[\w-]+):\s*\$\{/g)) {
      const name = m[1] ?? m[2]!;
      if (!name.startsWith("--vt-")) map.vars.set(name, VAR_NAMES[name] ?? `--vt-${name.slice(2)}`);
    }
  }

  for (const body of bodies) {
    const parents = new Map<IREl, IREl>();
    const all: IREl[] = [];
    for (const el of walk(body)) {
      all.push(el);
      for (const c of el.children) if (c.kind === "el") parents.set(c, el);
    }
    // Copies a script made (a marquee's repeated sets, hidden from screen readers): the builder makes its own.
    for (const el of all) {
      const before = el.children.length;
      el.children = el.children.filter((c) => !(c.kind === "el" && c.attrs["aria-hidden"] === "true" && classList(c).some((k) => /^(clone|cloned|copy|dup|duplicate)$/.test(k))));
      if (el.children.length !== before) note("copies made by the script left out");
    }
    // Words and letters a script split into spans (in a page captured after its script ran).
    for (const el of all) {
      if (!/^(h[1-6]|p|span|a|button|div|strong|em)$/.test(el.tag)) continue;
      const effect = unsplit(el, opts.css);
      if (!effect) continue;
      if (!["data-vt-split", "data-vt-flip", "data-vt-roll"].some((a) => a in el.attrs)) put(el, `data-vt-${effect}`, effect === "split" ? "words" : "", report);
      if (effect !== "roll") map.reveals = true;
      note("text effects recreated");
    }
    const ids = new Map(all.filter((e) => e.attrs.id).map((e) => [e.attrs.id!, e]));
    const data = (el: IREl) => el.data ?? {};

    for (const el of all) {
      const d = data(el);
      // Reveal on scroll (the delay stays in the element's own --d, renamed with the other variables).
      const reveal = ["data-reveal", "data-aos", "data-animate", "data-sr"].find((k) => k in d);
      if (reveal) {
        const delay = d["data-delay"] ?? d["data-aos-delay"];
        if (put(el, "data-vt-reveal", delay && /^\d+$/.test(delay) ? delay : "", report)) {
          map.attrs.set(reveal, "data-vt-reveal");
          map.reveals = true;
          note("reveal on scroll");
        }
      }
      if ("data-split" in d || "data-splitting" in d) {
        put(el, "data-vt-split", "words", report);
        map.attrs.set("data-split" in d ? "data-split" : "data-splitting", "data-vt-split");
        map.reveals = true;
        note("words that slide in");
      }
      // Count-ups: on the block around an inline number, so it survives the text becoming one piece.
      const count =
        ["data-count", "data-counter", "data-countup"].find((k) => k in d) ??
        // A number to count to (`<b data-n="607">0</b>`), which a script tweens the text towards.
        ["data-n", "data-to", "data-target", "data-end", "data-num"].find((k) => NUMBER.test(d[k] ?? ""));
      if (count) {
        // The page may have been captured before (or while) its script counted: the number is the one it counts to.
        const target = d[count]!;
        const only = el.children.length === 1 && el.children[0]!.kind === "text" ? el.children[0]! : undefined;
        if (NUMBER.test(target) && only?.kind === "text" && NUMBER.test(only.text.trim()) && only.text.trim() !== target) only.text = target;
        let host = el;
        while (INLINE.has(host.tag) && parents.get(host)) host = parents.get(host)!;
        if (!("data-vt-count" in host.attrs) && put(host, "data-vt-count", "", report)) note("numbers that count up");
        map.attrs.set(count, "data-vt-count");
      }
    }

    // Accordions: a list whose items each have a button that opens them.
    const inAccordion = new Set<IREl>();
    for (const el of all) {
      if (el.tag !== "ul" && el.tag !== "ol" && el.tag !== "div") continue;
      const items = el.children.filter((c): c is IREl => c.kind === "el");
      const buttons = items.map((i) => [...walk(i)].find((x) => x.tag === "button" && "aria-expanded" in x.attrs));
      if (items.length >= 2 && buttons.every(Boolean) && buttons.every((b) => !b!.attrs["aria-controls"] || !ids.has(b!.attrs["aria-controls"]))) {
        put(el, "data-vt-accordion", "single", report);
        // Open or not is the runtime's to say (a stored value would be put back on every redraw).
        buttons.forEach((b) => (inAccordion.add(b!), delete b!.attrs["aria-expanded"]));
        note("accordions");
      }
    }
    // Buttons that open and close another element (a mobile menu, a drawer).
    for (const el of all) {
      const target = el.attrs["aria-controls"];
      if (el.tag !== "button" || !("aria-expanded" in el.attrs) || !target || !ids.has(target) || inAccordion.has(el)) continue;
      const hasLinks = [...walk(ids.get(target)!)].some((x) => x.tag === "a");
      // A design that shows the opened part with `.on` (and no open-type class) gets that state.
      const shownBy = (state: string) => [`#${target}`, ...classList(ids.get(target)!).map((c) => `.${c}`)].some((s) => new RegExp(`${s.replace(/[.#-]/g, "\\$&")}(?![\\w-])[^,{]*\\.${state}(?![\\w-])`).test(opts.css));
      const openClass = Object.keys(STATE_ALIAS).some((c) => STATE_ALIAS[c] === "open" && shownBy(c));
      const opts2 = [hasLinks ? "close-links" : "", !openClass && shownBy("on") ? "on" : ""].filter(Boolean);
      if (put(el, "data-vt-toggle", [target, ...opts2].join(" "), report)) {
        delete el.attrs["aria-expanded"];
        note("open/close buttons");
      }
    }
    // A navigation of in-page links whose script marks the current one.
    if (["active", "current", "is-active"].some((s) => opts.scriptStates.has(s))) {
      for (const el of all) {
        if (el.tag !== "nav") continue;
        const own = [...walk(el)].filter((x) => x.tag === "a" && /^#[\w-]+$/.test(x.attrs.href ?? ""));
        const isToggled = all.some((b) => b.attrs["data-vt-toggle"]?.split(" ")[0] === el.attrs.id);
        if (own.length >= 3 && !isToggled && put(el, "data-vt-spy", "", report)) note("navigation that follows the page");
      }
    }
    // A form next to its thank-you message.
    for (const el of all) {
      if (el.tag !== "form" || !el.attrs.id) continue;
      const around = parents.get(el);
      const success = around?.children.find((c): c is IREl => c.kind === "el" && c !== el && !!c.attrs.id && (c.attrs.role === "status" || /success|thank|done|sent/i.test(classList(c).join(" "))));
      if (success && put(el, "data-vt-form", success.attrs.id!, report)) note("forms with a thank-you message");
    }

    // Hints for this template.
    for (const hint of opts.hints ?? []) {
      let hit = 0;
      for (const part of hint.selector.split(",")) {
        const steps = parseSelector(part);
        if (!steps) {
          report.warn(`Hint selector not understood: “${part.trim().slice(0, 60)}”.`);
          continue;
        }
        for (const el of all) {
          if (!matchesSteps(el, steps, parents)) continue;
          hit++;
          for (const name of hint.remove ?? []) delete el.attrs[name];
          for (const [name, value] of Object.entries(hint.set ?? {})) {
            if (BEHAVIOUR_ATTR.test(name)) {
              if (put(el, name, value === true ? "" : String(value), report) && /reveal|split|flip|seq/.test(name)) map.reveals = true;
              if (name === "data-vt-transient") classList(el).forEach((c) => map.transient.add(c));
            } else if (SET_ALLOWED.test(name)) el.attrs[name] = value === true ? "" : String(value);
            else report.warn(`Hint attribute not allowed: ${name}.`);
          }
        }
      }
      if (!hit) report.warn(`Hint matched nothing: “${hint.selector.slice(0, 60)}”.`);
      else note("parts set up by the template's hints");
    }

    // What the CSS says the script animated: endless scrolls, and parts it revealed by adding a class.
    {
      const revealStates = new Set([...opts.scriptStates].filter((c) => REVEAL_STATES.has(c)));
      const { slides, paused, reveals } = readScriptedCss(opts.css, new Set(map.vars.keys()), revealStates);
      for (const el of all) {
        const cls = classList(el);
        const has = (classes: string[]) => classes.every((c) => cls.includes(c));
        // The rule that applies last wins (more classes first, then later in the stylesheet), as in CSS.
        const rule = slides.filter((x) => has(x.classes)).sort((a, b) => a.classes.length - b.classes.length || a.order - b.order).at(-1);
        if (rule?.slide && !("data-vt-marquee" in el.attrs)) {
          const pause = paused.some(has) ? " pause" : "";
          if (put(el, "data-vt-marquee", `${rule.slide.axis} ${rule.slide.dir} ${rule.slide.axis === "y" ? 24 : 40}${pause}`, report)) note("endless scrolls");
        }
        for (const [key, v] of reveals) {
          // Not when it has a behaviour already, or plays in a sequence (its parent's).
          const parent = parents.get(el);
          if (!has(key.split(".")) || ["data-vt-reveal", "data-vt-split", "data-vt-flip", "data-vt-seq", "data-vt-marquee", "data-vt-transient"].some((a) => a in el.attrs) || (parent && "data-vt-seq" in parent.attrs)) continue;
          if (put(el, "data-vt-reveal", v.stagger ? "stagger:120 from:center" : "", report)) {
            map.reveals = true;
            note("parts revealed on scroll");
          }
        }
      }
    }

    // States a script left in the markup (a slide marked "on", rows marked current): where an interaction runs that
    // part (a tab list and its panels, a stack, an accordion, a toggle's target…), the runtime sets them now; elsewhere
    // (a page captured after its script ran) they're the design's, and stay (the stylesheet matches either).
    const driven = drivenElements(all, ids);
    for (const el of all) {
      const cls = classList(el);
      const kept = cls.filter((c) => !(opts.scriptStates.has(c) && STATE_ALIAS[c]) || !driven.has(el));
      if (kept.length !== cls.length) el.attrs.class = kept.join(" ");
      if (el.attrs.style && map.vars.size)
        el.attrs.style = el.attrs.style.replace(/--[\w-]+(?=\s*:)/g, (v) => map.vars.get(v) ?? v);
    }
  }

  // Data attributes the design's stylesheet styles by that no interaction replaces (`[data-mark]`, `attr(data-mark)`):
  // kept, as design data the runtime leaves alone.
  const styled = new Set([...opts.css.matchAll(/\[(data-[a-z][a-z0-9-]{0,30})(?=[\]=~|^$*\s])|attr\(\s*(data-[a-z][a-z0-9-]{0,30})\s*\)/g)].map((m) => m[1] ?? m[2]!));
  for (const name of styled) {
    if (map.attrs.has(name) || name.startsWith("data-vt-")) continue;
    const to = designDataAttr(name);
    let kept = 0;
    for (const body of bodies) {
      for (const el of walk(body)) {
        const v = el.data?.[name];
        if (v === undefined || to in el.attrs) continue;
        if (put(el, to, v, report)) kept++;
      }
    }
    map.attrs.set(name, to);
    if (kept) report.count("design data attributes kept (the stylesheet uses them)", kept);
  }

  for (const [what, n] of counted) report.count(`interactions recreated: ${what}`, n);
  return map;
}
