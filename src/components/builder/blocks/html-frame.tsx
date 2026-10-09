"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { sanitizeHtml } from "@/lib/builder/sanitize";

/*
 * Visitor HTML runs in an iframe with an opaque origin (sandbox without allow-same-origin), so even if something
 * slipped past the sanitiser it could not reach the editor, this site or its cookies. The only script inside is
 * ours: it reports the content height so the frame can grow to fit.
 */
const sizer = (id: string) =>
  `<script>(function(){var s=function(){parent.postMessage({veloceFrame:${JSON.stringify(id)},h:document.documentElement.scrollHeight},"*")};new ResizeObserver(s).observe(document.documentElement);addEventListener("load",s);s()})()</script>`;

const base = `<style>html,body{margin:0}body{font-family:system-ui,sans-serif;line-height:1.5}img,video,iframe{max-width:100%}</style>`;

export function HtmlFrame({ html, title, editing }: { html: string; title: string; editing: boolean }) {
  const id = useId();
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const srcDoc = useMemo(() => `<!doctype html><html><head><meta charset="utf-8">${base}</head><body>${sanitizeHtml(html)}${sizer(id)}</body></html>`, [html, id]);

  useEffect(() => {
    // The editor canvas is itself an iframe, so listen on the window that owns this frame.
    const win = ref.current?.ownerDocument.defaultView;
    if (!win) return;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || e.data?.veloceFrame !== id) return;
      const h = Number(e.data.h);
      if (Number.isFinite(h)) setHeight(Math.min(Math.max(h, 40), 4000));
    };
    win.addEventListener("message", onMessage);
    return () => win.removeEventListener("message", onMessage);
  }, [id]);

  return (
    <div className="relative">
      <iframe ref={ref} title={title} srcDoc={srcDoc} sandbox="allow-scripts allow-popups" loading="lazy" className="block w-full border-0" style={{ height }} />
      {/* While designing, clicks select the block instead of landing inside the frame. */}
      {editing ? <div aria-hidden className="absolute inset-0" /> : null}
    </div>
  );
}
