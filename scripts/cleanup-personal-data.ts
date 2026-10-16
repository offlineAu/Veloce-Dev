import "dotenv/config";
import { parseArgs } from "node:util";

// Preview by default. The scheduler must explicitly pass --apply to delete eligible records.
async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean", default: false } }, allowPositionals: false });
  const url = new URL("/api/privacy/maintenance", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
    throw new Error("Privacy cleanup requires HTTPS outside local development");
  }
  url.searchParams.set("dryRun", String(!values.apply));
  const secret = process.env.PRIVACY_CRON_SECRET;
  if (!secret || secret.length < 32) throw new Error("PRIVACY_CRON_SECRET must be configured with at least 32 characters");
  const response = await fetch(url, {
    method: "POST", headers: { Authorization: `Bearer ${secret}` }, redirect: "error", signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Privacy cleanup returned ${response.status}`);
  console.log(await response.json());
}
void main().catch(error => { console.error(error.message); process.exitCode = 1; });
