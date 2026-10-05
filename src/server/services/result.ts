export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; code: "VALIDATION"; fieldErrors: FieldErrors }
  | { ok: false; code: "RATE_LIMITED" | "UNAVAILABLE" };

export const RATE_LIMITED = { ok: false, code: "RATE_LIMITED" } as const;
export const UNAVAILABLE = { ok: false, code: "UNAVAILABLE" } as const;
