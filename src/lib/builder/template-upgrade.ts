/*
 * Sites made from a template before it gained interactions (an endless photo wall, an accordion…) keep the parts they
 * were copied with: a newer import of the same template version changes the template, not sites already made from it.
 * `upgradeFromTemplate` brings those sites up to date without touching anyone's work. Every section of the template is
 * built again, and each part of the site is matched with its fresh copy:
 *   - by place: a section the site still has (its top part named after it, or looking like it) is walked side by side
 *     with the fresh one, as far as the parts still match (same kind of part, same tag)
 *   - by look: any part with the same kind, tag and design classes as exactly one kind of fresh part ("vt-wall-col
 *     vt-up"), wherever it now sits (sites made from an older import, sections taken apart or rearranged)
 * and gets what the template now adds:
 *   - interactions (`data-vt-*`) it doesn't have, and the attributes they work with (`required`, `hidden`)
 *   - ARIA states the runtime now keeps itself (`aria-expanded`, `aria-current`, `aria-hidden`) are left to it
 *   - inline values a script used to write (a card stack's `z-index`, `opacity`, `transform`) are dropped, and variables
 *     renamed for the runtime (`--d` → `--vt-d`)
 *   - a dropdown that had no choices gets the template's
 * Nothing the template doesn't add is changed. No React.
 */
import { isSlot, mapBlocks, type BlockItem } from "./blocks";
import { BEHAVIOUR_ATTR, behavioursOf } from "./behaviours";
import type { SiteDoc } from "./site-doc";
import { sectionPieces, templatePageIds } from "./template-doc";
import type { TemplatePackage, TemplateSection } from "./template-package";

type Attrs = Record<string, string | number | boolean>;
const RUNTIME_ARIA = ["aria-expanded", "aria-current", "aria-hidden"];
const SCRIPT_STYLE = new Set(["zIndex", "z-index", "opacity", "transform"]);

/** A part's identity by look: kind, tag and the design's own classes (not utilities added in the Style panel). */
const signature = (b: BlockItem) => {
  const design = String(b.props.className ?? "").split(/\s+/).filter((c) => c.startsWith("vt-") && !/^vt-(enter|hover)-/.test(c)).sort().join(" ");
  return design ? `${b.type}|${b.props.tag ?? ""}|${design}` : undefined;
};

/** What the template now adds to one part (not the parts inside it); null when nothing. */
function merge(own: BlockItem, fresh: BlockItem): BlockItem["props"] | null {
  if (own.type !== fresh.type || own.props.tag !== fresh.props.tag) return null;
  let changed = false;
  const props: BlockItem["props"] = { ...own.props };

  const mine = { ...((own.props.attrs ?? {}) as Attrs) };
  const theirs = (fresh.props.attrs ?? {}) as Attrs;
  let attrsChanged = false;
  for (const [k, v] of Object.entries(theirs)) {
    if ((BEHAVIOUR_ATTR.test(k) || k === "required" || k === "hidden") && !(k in mine)) {
      mine[k] = v;
      attrsChanged = true;
    }
  }
  for (const k of RUNTIME_ARIA) {
    if (k in mine && !(k in theirs)) {
      delete mine[k];
      attrsChanged = true;
    }
  }
  if (attrsChanged) {
    props.attrs = mine;
    changed = true;
  }

  const style = own.props.style as Record<string, string> | undefined;
  const freshStyle = fresh.props.style as Record<string, string> | undefined;
  if (style) {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(style)) {
      if (!freshStyle && SCRIPT_STYLE.has(k)) continue;
      // A variable the runtime now reads under its own name.
      const renamed = k.startsWith("--") && !k.startsWith("--vt-") && freshStyle && `--vt-${k.slice(2)}` in freshStyle ? `--vt-${k.slice(2)}` : k;
      next[renamed] = v;
    }
    if (JSON.stringify(next) !== JSON.stringify(style)) {
      props.style = Object.keys(next).length ? next : undefined;
      changed = true;
    }
  }

  if (own.type === "DField" && Array.isArray(fresh.props.options) && fresh.props.options.length && !(Array.isArray(own.props.options) && own.props.options.length)) {
    props.options = fresh.props.options;
    changed = true;
  }
  return changed ? props : null;
}

/** By place: a part and everything inside it, walked side by side with its fresh copy. */
function walk(own: BlockItem, fresh: BlockItem): BlockItem | null {
  if (own.type !== fresh.type || own.props.tag !== fresh.props.tag) return null;
  const merged = merge(own, fresh);
  const props: BlockItem["props"] = merged ?? { ...own.props };
  let changed = !!merged;
  for (const [k, v] of Object.entries(own.props)) {
    const freshKids = fresh.props[k];
    if (!isSlot(v) || !isSlot(freshKids)) continue;
    let slotChanged = false;
    const kids = (v as BlockItem[]).map((child, i) => {
      // Lists may have more or fewer items than the template's; extra ones follow the pattern of the first.
      const twin = (freshKids as BlockItem[])[i] ?? (freshKids as BlockItem[])[0];
      const up = twin ? walk(child, twin) : null;
      if (up) slotChanged = true;
      return up ?? child;
    });
    if (slotChanged) {
      props[k] = kids;
      changed = true;
    }
  }
  return changed ? { ...own, props } : null;
}

/** The site with its template's newer interactions added (null when there's nothing to add). */
export function upgradeFromTemplate(doc: SiteDoc, pkg: TemplatePackage): SiteDoc | null {
  if (doc.templateRef?.slug !== pkg.slug || doc.templateRef.version !== pkg.version) return null;
  const ids = templatePageIds(pkg, doc.pages);
  const sections: { s: TemplateSection; fresh: BlockItem }[] = [];
  const seen = new Set<string>();
  for (const page of pkg.pages) for (const s of page.sections) if (!seen.has(s.id)) {
    seen.add(s.id);
    sections.push({ s, fresh: sectionPieces(s, ids) });
  }

  // Fresh parts by look, when that look always has the same interactions (otherwise it can't tell which they'd be).
  const byLook = new Map<string, BlockItem | null>();
  for (const { fresh } of sections) {
    mapBlocks([fresh], (b) => {
      const sig = signature(b);
      if (!sig) return b;
      const prev = byLook.get(sig);
      if (prev === undefined) byLook.set(sig, b);
      else if (prev && JSON.stringify(behavioursOf(prev.props.attrs as Attrs)) !== JSON.stringify(behavioursOf(b.props.attrs as Attrs))) byLook.set(sig, null);
      return b;
    });
  }
  const sectionFor = (b: BlockItem) => {
    const name = typeof b.props.name === "string" ? b.props.name : undefined;
    const sig = signature(b);
    return (
      sections.find(({ s }) => name && (s.label.slice(0, 60) === name || s.rawLabel?.slice(0, 60) === name)) ??
      (sig ? sections.find(({ fresh }) => signature(fresh) === sig) : undefined)
    );
  };

  let changed = false;
  const pages = doc.pages.map((p) => {
    // By place, section by section.
    let content = p.data.content.map((b) => {
      const match = sectionFor(b);
      const up = match ? walk(b, match.fresh) : null;
      if (up) changed = true;
      return up ?? b;
    });
    // By look, anywhere.
    content = mapBlocks(content, (b) => {
      const sig = signature(b);
      const twin = sig ? byLook.get(sig) : undefined;
      const merged = twin ? merge(b, twin) : null;
      if (!merged) return b;
      changed = true;
      return { ...b, props: merged };
    });
    return content === p.data.content ? p : { ...p, data: { ...p.data, content } };
  });
  return changed ? { ...doc, pages } : null;
}
