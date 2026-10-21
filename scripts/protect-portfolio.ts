import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { watermarkedPreview } from "../src/lib/security/watermark";

const apply = process.argv.includes("--apply");
const root = path.resolve("public/images");
const backup = path.resolve(".private-assets/originals");
const ledgerFile = path.resolve(".private-assets/watermarks.json");
const ledger: Record<string, string> = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, "utf8")) : {};
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function walk(dir: string): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
async function main() {
  // Template assets and brand marks stay shareable. Retain stock-photo credits.
  const files = walk(root).filter(file => /\.webp$/i.test(file));
  console.log(`${apply ? "Applying" : "Previewing"} watermarks for ${files.length} portfolio images. Originals stay in ignored .private-assets/.`);
  for (const file of files) {
    const rel = path.relative(root, file);
    const current = readFileSync(file);
    if (ledger[rel] === hash(current)) continue;
    if (!apply) { console.log(rel); continue; }
    const originalPath = path.join(backup, rel);
    mkdirSync(path.dirname(originalPath), { recursive: true });
    if (!existsSync(originalPath)) writeFileSync(originalPath, current, { mode: 0o600 });
    const preview = await watermarkedPreview(readFileSync(originalPath));
    writeFileSync(file, preview);
    ledger[rel] = hash(preview);
    writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + "\n", { mode: 0o600 });
  }
}
main().catch(() => { console.error("Portfolio processing failed. Originals were retained; inspect locally before retrying."); process.exitCode = 1; });
