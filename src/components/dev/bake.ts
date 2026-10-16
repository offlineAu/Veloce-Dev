"use client";

/*
 * Templates whose script builds part of the page (product cards, a job list, a gallery from data in the script) arrive
 * empty: the importer never runs a template's script. So before uploading, the panel lets the page run once in the
 * developer's own browser, inside a locked-down iframe, and uploads what it finished as (the original file is kept as
 * the source, for Edit HTML). What the capture does is in lib/builder/bake-capture.ts.
 *
 * The iframe is /build/bake, served sandboxed with scripts only and its own security policy (next.config.ts): an
 * opaque origin, so the page can't reach this site, its cookies or its storage, while its images, styles and fonts
 * load as designed (a script that swaps failed images for placeholders would otherwise capture placeholders). It
 * takes the page by message and writes it into itself. The capture goes through the same sanitising importer as any
 * upload.
 */

import { BAKE_MESSAGE, withCapture } from "@/lib/builder/bake-capture";

const MAX_WAIT = 15_000;

/** The page as its script leaves it, or null when it couldn't be run (the original is uploaded instead). */
export function bakeHtml(html: string): Promise<string | null> {
  return new Promise((resolve) => {
    const token = crypto.randomUUID();
    const doc = withCapture(html, token);
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    // Laid out at desktop size and in view (so what appears on scroll is built), but invisible and out of the way.
    frame.style.cssText = "position:fixed;left:0;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none;z-index:-1";
    let done = false;
    const finish = (out: string | null) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      frame.remove();
      resolve(out);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      const data = e.data as { type?: string; token?: string; html?: unknown } | null;
      // The capture page is ready: hand it the page to run.
      if (data?.type === "veloce-bake-ready") return frame.contentWindow?.postMessage({ type: "veloce-bake-page", html: doc }, "*");
      if (data?.type !== BAKE_MESSAGE || data.token !== token) return;
      finish(typeof data.html === "string" && data.html.length < 3_000_000 ? data.html : null);
    };
    const timer = setTimeout(() => finish(null), MAX_WAIT);
    window.addEventListener("message", onMessage);
    frame.src = "/build/bake";
    document.body.append(frame);
  });
}
