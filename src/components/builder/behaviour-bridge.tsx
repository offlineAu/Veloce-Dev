"use client";

import { useEffect, useRef } from "react";
import { usePuck } from "./editor-hooks";

/** In the editor: while a block is dragged, interactions hold still (no rescans, marquees paused), so drops land true. */
export function EditorBehaviourBridge() {
  const dragging = usePuck((s) => s.appState.ui.isDragging);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const root = ref.current?.closest("[data-vt]");
    if (!root) return;
    if (dragging) root.setAttribute("data-vt-busy", "");
    else root.removeAttribute("data-vt-busy");
  }, [dragging]);
  return <span ref={ref} hidden />;
}
