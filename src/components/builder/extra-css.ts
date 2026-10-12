"use client";

import { useEffect, useState } from "react";
import type { ThemeTokens } from "@/lib/builder/theme";

/*
 * CSS for classes a visitor added (Style panel, Edit HTML) that the template's stylesheet doesn't have, compiled by
 * /api/builder/css against the template's theme (or the site theme). Cached per set of classes.
 */

export type ExtraCssTarget = { slug: string; version: number } | { theme: ThemeTokens };

const cache = new Map<string, Promise<string>>();

function fetchCss(target: ExtraCssTarget, classes: string[]): Promise<string> {
  const body = JSON.stringify({ ...target, classes });
  let p = cache.get(body);
  if (!p) {
    p = fetch("/api/builder/css", { method: "POST", headers: { "Content-Type": "application/json" }, body }).then((r) => (r.ok ? r.text() : ""));
    p.catch(() => cache.delete(body));
    cache.set(body, p);
  }
  return p;
}

export function useExtraCss(target: ExtraCssTarget | null, classes: string[]): string {
  const [css, setCss] = useState("");
  const key = target ? JSON.stringify([target, classes]) : "";
  useEffect(() => {
    if (!target || !classes.length) return;
    let live = true;
    const t = window.setTimeout(() => {
      fetchCss(target, classes).then((c) => live && setCss(c), () => undefined);
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
    // `key` identifies target + classes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return classes.length ? css : "";
}
