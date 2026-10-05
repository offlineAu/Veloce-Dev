import { z } from "zod";
import { TOKEN_RE } from "@/lib/token";

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const clean = (v: string) => v.replace(CONTROL, "").trim();

/** Required single-line text. */
export const text = (max: number, msg = "This field is required.") =>
  z.preprocess(
    (v) => (typeof v === "string" ? clean(v).replace(/\s+/g, " ") : v),
    z.string({ error: msg }).min(1, msg).max(max, `Please keep this under ${max} characters.`),
  );

/** Optional text; empty becomes undefined. `multiline` keeps line breaks. */
export const optionalText = (max: number, multiline = false) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const c = clean(v);
      const out = multiline ? c : c.replace(/\s+/g, " ");
      return out === "" ? undefined : out;
    },
    z.string().max(max, `Please keep this under ${max} characters.`).optional(),
  );

export const emailField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z
    .string({ error: "Please add an email." })
    .min(1, "Please add an email.")
    .max(254, "That email is too long.")
    .pipe(z.email("That email doesn't look right.")),
);

/** Optional website: accepts "example.com", normalises to an http(s) URL, rejects other schemes. */
export const optionalWebsite = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (t === "") return undefined;
    return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  },
  z
    .string()
    .max(200, "That address is too long.")
    .refine((s) => {
      try {
        const u = new URL(s);
        return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
      } catch {
        return false;
      }
    }, "Please enter a valid website address.")
    .optional(),
);

/** Malformed tokens are dropped rather than rejected: they are treated as "no referral". */
export const refToken = z.preprocess(
  (v) => (typeof v === "string" && TOKEN_RE.test(v) ? v : undefined),
  z.string().optional(),
);

/** Anti-abuse fields shared by public forms. */
export const guardFields = {
  idempotencyKey: z.string().uuid(),
  startedAt: z.number().int(),
};
