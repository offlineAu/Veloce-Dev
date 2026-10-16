/*
 * Step 4: a page's body → the classes around it (its "frame") and its sections. Wrappers with a single child (and
 * <main>) are opened up; each landmark or top-level block inside becomes one section that visitors can move,
 * duplicate or delete. A block the design lays out as a grid of cards (a dashboard's card grid) is kept whole, since
 * its cards only line up inside it. Labels come from the design's own HTML comments ("<!-- Immersive Editorial Hero -->"),
 * then headings, then the landmark.
 */
import postcss from "postcss";
import { classList, textOf, type IREl, type IRNode } from "./ir";
import type { Report } from "./report";

export interface RawSection {
  label: string;
  el: IREl;
  hidden: boolean;
}

const LANDMARK_LABEL: Record<string, string> = { header: "Header", nav: "Navigation", footer: "Footer", aside: "Side panel", form: "Form" };

const elements = (n: IREl) => n.children.filter((c): c is IREl => c.kind === "el");
const hasOwnText = (n: IREl) => n.children.some((c) => c.kind === "text" && c.text.trim());

/** Heading text, shortened, as a fallback label. */
function headingLabel(el: IREl): string | undefined {
  const stack: IRNode[] = [el];
  while (stack.length) {
    const n = stack.shift()!;
    if (n.kind !== "el") continue;
    if (/^h[1-4]$/.test(n.tag)) {
      const t = textOf(n);
      if (t) return t.length > 40 ? `${t.slice(0, 38)}…` : t;
    }
    stack.push(...n.children);
  }
  return undefined;
}

/** "BEGIN: CTAContactSection" → "CTA contact section"; plain comments are only trimmed. */
export function tidyComment(c: string): string {
  let t = c.replace(/^[\s=*#-]+|[\s=*#-]+$/g, "").replace(/^(begin|start)\s*[:\-]\s*/i, "").replace(/\s+/g, " ");
  if (/^[A-Za-z0-9]+$/.test(t) && /[a-z][A-Z]|[A-Z]{2}[a-z]/.test(t)) {
    t = t
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(" ")
      .map((w, i) => (i === 0 || /^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase()))
      .join(" ");
  }
  return t.slice(0, 50);
}

/** Closing markers ("END: MainHeader") label nothing. */
const isEndMarker = (c: string) => /^[\s=*#-]*(end|\/)\b/i.test(c);

const SECTION_TAGS = ["section", "header", "footer", "article", "aside"];
const plainBlock = (el: IREl) => !hasOwnText(el) && !["header", "footer", "nav", "section", "article", "aside", "form"].includes(el.tag);

/**
 * Whether a plain block is the page's wrapper: it holds sections, or wraps (through single-child wrappers) something
 * that does. A bar with one row inside (a top bar, a banner) is a section of its own, not the page around everything.
 */
function wrapsPage(el: IREl): boolean {
  const kids = elements(el);
  if (kids.filter((k) => SECTION_TAGS.includes(k.tag)).length >= 2) return true;
  if (kids.length !== 1) return false;
  const only = kids[0]!;
  return only.tag === "main" || (plainBlock(only) && wrapsPage(only));
}

/** A readable name from the element's first class ("topbar" → "Topbar", "mobile-call" → "Mobile call"). */
function classLabel(el: IREl): string | undefined {
  const c = classList(el).find((x) => /^[a-z][a-z-]{2,30}$/i.test(x) && !x.includes(":"));
  return c ? (c.charAt(0).toUpperCase() + c.slice(1)).replace(/-/g, " ") : undefined;
}

const isHidden = (el: IREl) => "hidden" in el.attrs || classList(el).some((c) => c === "hidden" || c === "invisible");

/**
 * The `.class` and `#id` selectors a hand-written stylesheet lays out as a grid of columns
 * (`display: grid` with `grid-template-columns`).
 */
export function gridSelectors(css: string): Set<string> {
  const out = new Set<string>();
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return out;
  }
  root.walkRules((rule) => {
    let grid = false;
    let columns = false;
    rule.walkDecls((d) => {
      if (d.prop === "display" && /^(inline-)?grid$/.test(d.value.trim())) grid = true;
      if (d.prop === "grid-template-columns" || (d.prop === "grid-template" && d.value.includes("/"))) columns = true;
    });
    if (!grid || !columns) return;
    for (const sel of rule.selectors) if (/^[.#][\w-]+$/.test(sel.trim())) out.add(sel.trim());
  });
  return out;
}

export function splitSections(body: IREl, report: Report, grids: Set<string> = new Set()): { frame: string[]; sections: RawSection[] } {
  const isGrid = (el: IREl) => (el.attrs.id !== undefined && grids.has(`#${el.attrs.id}`)) || classList(el).some((c) => grids.has(`.${c}`));
  const frame = [...classList(body)];
  const sections: RawSection[] = [];

  const visit = (container: IREl) => {
    let comment: string | undefined;
    for (const child of container.children) {
      if (child.kind === "comment") {
        if (!isEndMarker(child.text)) comment = tidyComment(child.text) || comment;
        continue;
      }
      if (child.kind === "text") {
        if (child.text.trim()) report.warn("Loose text between sections was dropped.");
        continue;
      }
      const kids = elements(child);
      // Modals and messages that only a script would reveal would be invisible blocks in the editor: leave them out.
      if (isHidden(child)) {
        report.warn(`Skipped “${comment ?? LANDMARK_LABEL[child.tag] ?? headingLabel(child) ?? child.attrs.id ?? child.tag}”: it is hidden until a script shows it (modal, message or later step).`);
        comment = undefined;
        continue;
      }
      // Open up page wrappers: <main>, an element that only wraps one other element, or a plain block whose children
      // are themselves sections.
      const wrapper = (child.tag === "main" || (plainBlock(child) && wrapsPage(child))) && !isGrid(child);
      if (wrapper && kids.length > 0) {
        frame.push(...classList(child));
        visit(child);
        comment = undefined;
        continue;
      }
      // An SVG sprite (symbols the page's icons use) shows nothing itself, but the icons need it.
      const sprite = child.tag === "svg" && kids.some((k) => k.tag === "symbol") ? "Icons (used by the page)" : undefined;
      const label = comment ?? sprite ?? LANDMARK_LABEL[child.tag] ?? headingLabel(child) ?? classLabel(child) ?? `Section ${sections.length + 1}`;
      sections.push({ label, el: child, hidden: false });
      comment = undefined;
    }
  };
  visit(body);
  return { frame, sections };
}
