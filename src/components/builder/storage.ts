import type { BlockItem } from "@/lib/builder/blocks";
import { migrateDoc, type SiteDoc } from "@/lib/builder/site-doc";

/*
 * Visitors have no account, so work in progress lives in this browser only. Every access is guarded: storage can
 * be missing or throw (private windows, blocked site data), and the editor must still work without it.
 */

const KEYS = {
  draft: "veloce.builder.draft.v2",
  /** Single-page drafts from before sites had pages; read once and upgraded. */
  legacyDraft: "veloce.builder.draft.v1",
  templates: "veloce.builder.templates.v1",
  sections: "veloce.builder.sections.v1",
} as const;

export interface StoredDraft {
  doc: SiteDoc;
  templateId?: string;
  updatedAt: number;
}

export interface SavedTemplate {
  id: string;
  name: string;
  doc: SiteDoc;
  createdAt: number;
}

export interface SavedSection {
  id: string;
  name: string;
  block: BlockItem;
  createdAt: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the browser refused to store it (full or blocked). */
function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

type Raw = { doc?: unknown; data?: unknown; templateId?: unknown; updatedAt?: unknown } | null;

export const loadDraft = (): StoredDraft | null => {
  const v = read<Raw>(KEYS.draft, null) ?? read<Raw>(KEYS.legacyDraft, null);
  const doc = migrateDoc(v?.doc ?? v?.data);
  if (!v || !doc || typeof v.updatedAt !== "number") return null;
  return { doc, templateId: typeof v.templateId === "string" ? v.templateId : undefined, updatedAt: v.updatedAt };
};
export const saveDraft = (d: Omit<StoredDraft, "updatedAt">) => write(KEYS.draft, { ...d, updatedAt: Date.now() });
export const clearDraft = () => {
  try {
    window.localStorage.removeItem(KEYS.draft);
    window.localStorage.removeItem(KEYS.legacyDraft);
  } catch {
    /* nothing to clear */
  }
};

const list = <T>(key: string): T[] => {
  const v = read<unknown>(key, []);
  return Array.isArray(v) ? (v as T[]) : [];
};

/** Templates saved before sites had pages stored a single page as `data`. */
export const loadTemplates = (): SavedTemplate[] =>
  list<SavedTemplate & { data?: unknown }>(KEYS.templates).flatMap(({ data, ...t }) => {
    const doc = migrateDoc(t.doc ?? data);
    return doc ? [{ ...t, doc }] : [];
  });
export const saveTemplates = (t: SavedTemplate[]) => write(KEYS.templates, t);

export const loadSections = () => list<SavedSection>(KEYS.sections);
export const saveSections = (s: SavedSection[]) => write(KEYS.sections, s);
