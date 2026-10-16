/*
 * The page an uploaded template runs in once, for the developer panel's capture (components/dev/bake.ts). It's an
 * empty page that, framed by this site, takes the template's HTML by message and writes it into itself, where its
 * scripts run. Served sandboxed (an opaque origin: no access to this site, its cookies or its storage) and with its own
 * security policy (next.config.ts): images, styles and fonts from anywhere, so the page lays out as designed, and
 * framing only by this site.
 */

const PAGE = `<!doctype html><meta charset="utf-8"><title>Capture</title><script>
addEventListener("message", (e) => {
  if (e.source !== parent || !e.data || e.data.type !== "veloce-bake-page" || typeof e.data.html !== "string") return;
  document.open();
  document.write(e.data.html);
  document.close();
}, { once: true });
parent.postMessage({ type: "veloce-bake-ready" }, "*");
</script>`;

export function GET() {
  return new Response(PAGE, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
