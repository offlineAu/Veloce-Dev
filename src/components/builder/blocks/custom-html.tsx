import type { ComponentConfig } from "@puckeditor/core";
import { MAX_HTML_BYTES } from "@/lib/builder/sanitize-limits";
import { HtmlFrame } from "./html-frame";

export type CustomHtmlProps = { label: string; html: string };

export const CustomHtml: ComponentConfig<CustomHtmlProps> = {
  label: "Custom HTML",
  fields: {
    label: { type: "text", label: "Name (shown to screen readers)" },
    html: { type: "textarea", label: `HTML & CSS (up to ${MAX_HTML_BYTES / 1000} KB, scripts are removed)` },
  },
  defaultProps: {
    label: "Custom section",
    html: `<style>.box{padding:32px;border-radius:16px;background:#f4f1ec;text-align:center}</style>\n<div class="box">\n  <h2>Your own HTML</h2>\n  <p>Paste a snippet, an embed or a whole section here.</p>\n</div>`,
  },
  render: ({ label, html, puck }) =>
    html.trim() ? (
      <HtmlFrame html={html} title={label || "Custom section"} editing={puck.isEditing} />
    ) : (
      <div className="grid min-h-24 place-items-center rounded-xl border-2 border-dashed border-(--site-line) text-sm text-(--site-muted)">Paste HTML in the panel on the right</div>
    ),
};
