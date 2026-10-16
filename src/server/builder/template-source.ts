import "server-only";
import path from "node:path";
import { parse, serialize, type DefaultTreeAdapterMap } from "parse5";
import type { FetchLike } from "@/lib/builder/import/assets";

export interface TemplateSource {
  pages: { fileName: string; html: string }[];
  designMd?: string;
}
export const SOURCE_PATH = "source/design.json";
const ORIGIN = "https://template-assets.invalid/";

/** Resolve local references before importing, so images pass through the same encoding as remote photos. */
export function prepareTemplateHtml(html: string, fileName: string, assets: Map<string, Buffer>, remote: FetchLike) {
  const local = new Map<string, Buffer>();
  const labels = new Map<string, string>();
  function image(value: string): string {
    const url = value.trim();
    if (!url || url.startsWith("#") || /^(https?:)?\/\//i.test(url)) return url.startsWith("//") ? `https:${url}` : url;
    let bytes: Buffer | undefined;
    if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)(;[^,]*)?,/i.test(url)) {
      const comma = url.indexOf(",");
      bytes = /;base64$/i.test(url.slice(0, comma))
        ? Buffer.from(url.slice(comma + 1), "base64")
        : Buffer.from(decodeURIComponent(url.slice(comma + 1)));
    } else if (/^[a-z][\w+.-]*:/i.test(url)) {
      throw new Error(`Unsupported image address: ${url.slice(0, 80)}. Upload the image file instead.`);
    } else {
      const clean = decodeURIComponent(url.split(/[?#]/)[0]!);
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(fileName), clean)).replace(/^\/+/, "");
      bytes = assets.get(target) ?? assets.get(clean.replace(/^\.\//, "").replace(/^\/+/, ""));
      if (!bytes) {
        const matches = [...assets].filter(([key]) => key.endsWith(`/${target}`) || key.endsWith(`/${clean.replace(/^\.\//, "")}`));
        if (matches.length === 1) bytes = matches[0]![1];
        else if (!matches.length) {
          const byName = [...assets].filter(([key]) => path.posix.basename(key) === path.posix.basename(target));
          if (byName.length === 1) bytes = byName[0]![1];
        }
      }
      if (!bytes) throw new Error(`Missing image “${url}” in ${fileName}. Add its image folder and upload again.`);
    }
    const key = `${ORIGIN}${local.size}`;
    local.set(key, bytes);
    labels.set(key, url.startsWith("data:") ? `embedded image in ${fileName}` : `${url} in ${fileName}`);
    return key;
  }
  const css = (value: string) => value.replace(/url\(\s*(["']?)(.*?)\1\s*\)/gi, (_, _quote: string, url: string) => `url("${/^data:font\//i.test(url) ? url : image(url)}")`);
  function walk(node: DefaultTreeAdapterMap["node"]) {
    if ("attrs" in node) {
      for (const attr of node.attrs) {
        if (node.tagName === "img" && attr.name === "src") attr.value = image(attr.value);
        if (attr.name === "style") attr.value = css(attr.value);
      }
      if (node.tagName === "style") for (const child of node.childNodes) if (child.nodeName === "#text") (child as DefaultTreeAdapterMap["textNode"]).value = css((child as DefaultTreeAdapterMap["textNode"]).value);
    }
    if ("childNodes" in node) node.childNodes.forEach(walk);
  }
  const doc = parse(html);
  walk(doc);
  const fetcher: FetchLike = async (url, init) => {
    const bytes = local.get(url);
    if (bytes) return { ok: true, status: 200, text: async () => bytes.toString(), arrayBuffer: async () => Uint8Array.from(bytes).buffer };
    if (url.startsWith(ORIGIN)) throw new Error("Unknown local image.");
    return remote(url, init);
  };
  return { html: serialize(doc), fetcher, labels };
}
