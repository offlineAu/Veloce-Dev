"use client";

import { useCallback } from "react";
import { createUsePuck } from "@puckeditor/core";
import { withFreshIds, type BlockItem } from "@/lib/builder/blocks";
import { sanitizeHtml } from "@/lib/builder/sanitize";
import type { builderConfig, BuilderData } from "./config";

/** Typed selector hook for the editor's state; only usable inside <Puck>. */
export const usePuck = createUsePuck<typeof builderConfig>();

/** Appends blocks to the end of the page, with fresh ids so the same section can be added twice. */
export function useAppendBlocks() {
  const dispatch = usePuck((s) => s.dispatch);
  return useCallback(
    (blocks: BlockItem[]) =>
      dispatch({
        type: "setData",
        data: (prev) => ({ ...prev, content: [...prev.content, ...(withFreshIds(blocks) as BuilderData["content"])] }),
      }),
    [dispatch],
  );
}

export const htmlBlock = (html: string): BlockItem => ({ type: "CustomHtml", props: { label: "Imported HTML", html: sanitizeHtml(html) } });

/** Fired by the block toolbar; the save dialog listens for it. */
export const SAVE_SECTION_EVENT = "veloce:save-section";
