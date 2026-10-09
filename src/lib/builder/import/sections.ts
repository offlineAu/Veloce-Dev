/*
 * Step 4: a page's body → the classes around it (its "frame") and its sections. Wrappers with a single child (and
 * <main>) are opened up; each landmark or top-level block inside becomes one section that visitors can move,
 * duplicate or delete. Labels come from the design's own HTML comments ("<!-- Immersive Editorial Hero -->"),
 * then headings, then the landmark.
 */
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

const tidyComment = (c: string) => c.replace(/^[\s=*#-]+|[\s=*#-]+$/g, "").replace(/\s+/g, " ").slice(0, 50);

const isHidden = (el: IREl) => "hidden" in el.attrs || classList(el).some((c) => c === "hidden" || c === "invisible");

export function splitSections(body: IREl, report: Report): { frame: string[]; sections: RawSection[] } {
  const frame = [...classList(body)];
  const sections: RawSection[] = [];

  const visit = (container: IREl) => {
    let comment: string | undefined;
    for (const child of container.children) {
      if (child.kind === "comment") {
        comment = tidyComment(child.text) || comment;
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
      const plain = !hasOwnText(child) && !["header", "footer", "nav", "section", "article", "aside", "form"].includes(child.tag);
      const holdsSections = kids.filter((k) => ["section", "header", "footer", "article", "aside"].includes(k.tag)).length >= 2;
      const wrapper = child.tag === "main" || (plain && (kids.length === 1 || holdsSections));
      if (wrapper && kids.length > 0) {
        frame.push(...classList(child));
        visit(child);
        comment = undefined;
        continue;
      }
      const label = comment ?? LANDMARK_LABEL[child.tag] ?? headingLabel(child) ?? `Section ${sections.length + 1}`;
      sections.push({ label, el: child, hidden: false });
      comment = undefined;
    }
  };
  visit(body);
  return { frame, sections };
}
