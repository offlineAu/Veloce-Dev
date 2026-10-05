export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function isWellFormedToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}
