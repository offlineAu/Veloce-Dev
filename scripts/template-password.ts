/**
 * Prints the values to set in Vercel for developer template uploads.
 *
 *   npm run template:password
 *
 * Prompts for the shared password (not echoed) and prints TEMPLATE_UPLOAD_PASSWORD_HASH, plus a fresh
 * DEV_SESSION_SECRET. Changing the hash changes the password; changing the secret also signs everyone out.
 */
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "../src/server/security/password";

const muted = new Writable({ write: (_chunk, _enc, cb) => cb() });
const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
const owner = process.argv.includes("--analytics-owner");
process.stdout.write(owner ? "Analytics owner password (min 12 characters): " : "Shared developer password (min 12 characters): ");
rl.question("", (password) => {
  rl.close();
  process.stdout.write("\n");
  if (password.length < 12) {
    console.error("✗ Use at least 12 characters.");
    process.exit(1);
  }
  console.log(`${owner ? "ANALYTICS_OWNER_PASSWORD_HASH" : "TEMPLATE_UPLOAD_PASSWORD_HASH"}=${hashPassword(password)}`);
  console.log(`${owner ? "ANALYTICS_OWNER_SESSION_SECRET" : "DEV_SESSION_SECRET"}=${randomBytes(32).toString("base64url")}`);
});
