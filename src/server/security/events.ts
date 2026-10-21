import "server-only";

// Fixed event names and numeric counters only: never serialize request objects,
// user input, URLs, cookies, credentials or upstream errors into security logs.
export type SecurityEvent = "login_failed" | "login_limited" | "quota_exceeded" | "processing_busy" | "import_rejected" | "access_denied" | "csp_violation";
export function securityEvent(event: SecurityEvent, count = 1) {
  console.warn(JSON.stringify({ type: "security", event, count: Math.max(0, Math.min(1_000_000, Math.trunc(count))), at: new Date().toISOString() }));
}
