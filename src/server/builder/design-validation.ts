import "server-only";
import { mapBlocks } from "@/lib/builder/blocks";
import { PAGE_LINK, type SiteDoc } from "@/lib/builder/site-doc";
import { CLASS_PREFIX, findSection, packageBase, type FieldDef, type TemplatePackage } from "@/lib/builder/template-package";
import { readTemplate } from "./template-store";

const MAX_TEXT = 2000;
const SAFE_URL = /^(https?:\/\/|mailto:|tel:|#|\/)/i;
const FRAME_TOKEN = /^[\w:/[\]().%#,!-]{1,120}$/;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A value a visitor typed into one field of an imported section. */
function checkValue(field: FieldDef, value: unknown, pkg: TemplatePackage, pageIds: Set<string>): string | null {
  if (typeof value !== "string") return "bad value";
  if (value.length > MAX_TEXT) return "text too long";
  if (field.kind === "image") {
    const ok = value === "" || value.startsWith(`${packageBase(pkg.slug, pkg.version)}/`) || /^https:\/\//i.test(value);
    return ok && !value.includes("..") ? null : "image address not allowed";
  }
  if (field.kind === "link") {
    if (value.startsWith(PAGE_LINK)) return pageIds.has(value.slice(PAGE_LINK.length)) ? null : "link to a missing page";
    return value === "" || SAFE_URL.test(value) ? null : "link address not allowed";
  }
  return null;
}

function checkValues(fields: FieldDef[], raw: unknown, pkg: TemplatePackage, pageIds: Set<string>): string | null {
  if (raw === undefined) return null;
  if (!isRecord(raw)) return "bad values";
  const byId = new Map(fields.map((f) => [f.id, f]));
  for (const [k, v] of Object.entries(raw)) {
    const f = byId.get(k);
    if (!f) return "unknown field";
    const p = checkValue(f, v, pkg, pageIds);
    if (p) return p;
  }
  return null;
}

/**
 * Sections from an imported template ("DesignSection" blocks) must point at a section of the template version the
 * site is built on, and every value must fit that section's fields. Returns a message for the visitor, or null.
 */
export function checkDesignSections(doc: SiteDoc): string | null {
  const pageIds = new Set(doc.pages.map((p) => p.id));
  const tpl = doc.templateRef ? readTemplate(doc.templateRef.slug, doc.templateRef.version) : null;
  let problem: string | null = null;

  for (const page of doc.pages) {
    const frame = page.data.root.props?.frame;
    if (frame !== undefined) {
      const tokens = typeof frame === "string" ? frame.split(/\s+/).filter(Boolean) : null;
      if (!tokens || tokens.length > 40 || tokens.some((t) => !t.startsWith(CLASS_PREFIX) || !FRAME_TOKEN.test(t))) return "We couldn't read your design.";
    }
    mapBlocks(page.data.content, (b) => {
      if (problem || b.type !== "DesignSection") return b;
      if (!tpl) {
        problem = "This design uses a template that is no longer available.";
        return b;
      }
      const section = typeof b.props.sectionId === "string" ? findSection(tpl.pkg, b.props.sectionId) : undefined;
      if (!section) {
        problem = "This design uses a section that is no longer available.";
        return b;
      }
      const why = checkValues(section.fields, b.props.values, tpl.pkg, pageIds) ?? checkItems(section.repeaters, b.props.items, tpl.pkg, pageIds);
      if (why) problem = `A section on “${page.title}” couldn't be saved (${why}).`;
      return b;
    });
    if (problem) return problem;
  }
  return null;
}

function checkItems(repeaters: TemplatePackage["pages"][number]["sections"][number]["repeaters"], raw: unknown, pkg: TemplatePackage, pageIds: Set<string>): string | null {
  if (raw === undefined) return null;
  if (!isRecord(raw)) return "bad items";
  const byId = new Map(repeaters.map((r) => [r.id, r]));
  for (const [k, list] of Object.entries(raw)) {
    const r = byId.get(k);
    if (!r || !Array.isArray(list)) return "unknown list";
    if (list.length > r.max) return `too many ${r.label.toLowerCase()}`;
    for (const item of list) {
      const p = checkValues(r.fields, item, pkg, pageIds);
      if (p) return p;
    }
  }
  return null;
}
