"use client";

import { createContext } from "react";
import type { SiteDoc } from "@/lib/builder/site-doc";
import type { LoadedTemplate } from "./template-registry";

export type EditorPanel = "templates" | "sections" | "import" | "saveTemplate" | null;

/**
 * What the editor's extras (dialogs, component sync, the Styles and Assets panels) need from the builder: the open
 * dialog, the template, and the whole site, which they can change without reopening the editor.
 */
export type Extras = {
  panel: EditorPanel;
  setPanel: (p: EditorPanel) => void;
  template: LoadedTemplate | undefined;
  getDoc: () => SiteDoc;
  updateDoc: (fn: (doc: SiteDoc) => SiteDoc) => void;
  activePageId: string | undefined;
  navigate: (pageId: string) => void;
  /** Bumped whenever `updateDoc` runs. */
  docTick: number;
};

export const ExtrasContext = createContext<Extras | null>(null);
