"use server";

import { htmlToPieces, type HtmlResult } from "@/server/builder/html-pieces";
import { allow } from "@/server/security/rate-limit";
import { clientKey } from "@/server/security/request";

/** "Edit HTML" in the builder: the visitor's HTML as sanitised design pieces. Open to visitors, so limited per address. */
export async function htmlToPiecesAction(html: unknown): Promise<HtmlResult> {
  if (typeof html !== "string") return { ok: false, error: "Something went wrong. Please try again." };
  if (!(await allow(`html:${await clientKey()}`, 60, 3600_000))) return { ok: false, error: "That's a lot of changes in a short time. Try again in a few minutes." };
  try {
    return htmlToPieces(html);
  } catch (e) {
    console.error("[builder-html]", e);
    return { ok: false, error: "That HTML couldn't be read. Check it and try again." };
  }
}
