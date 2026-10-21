import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
// Use the same environment precedence as a release without printing any values.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = createRequire(require.resolve('next/package.json'))('@next/env');
loadEnvConfig(root, false, { info() {}, error() {} });
const privateValues = Object.entries(process.env).filter(([name, value]) =>
  !name.startsWith('NEXT_PUBLIC_') && /(?:_SECRET|_TOKEN|_PASSWORD|_PASSWORD_HASH|_API_KEY|PRIVATE_KEY)$/.test(name) && typeof value === 'string' && value.length >= 16,
).map(([, value]) => value);
const failures = [];
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
// Never print matching values. This scanner is a release guard, not a complete DLP tool.
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{60,255}\b/,
  /\bsk_live_[A-Za-z0-9]{20,}\b/,
  /\bvercel_blob_rw_[A-Za-z0-9_]{20,}\b/,
];
export function containsCredential(text) { return patterns.some(pattern => pattern.test(text)); }
function inspect(file, client = false) {
  if (!existsSync(file) || statSync(file).size > 15_000_000) return;
  const data = readFileSync(file, 'utf8');
  if (containsCredential(data)) failures.push(`Potential credential in ${file}`);
  if (client && privateValues.some(value => data.includes(value))) failures.push(`Private environment value in browser/public artifact ${file}`);
  if (client && /(?:ANALYTICS_OWNER_SESSION_SECRET|DEV_SESSION_SECRET|POSTHOG_PERSONAL_API_KEY|BLOB_READ_WRITE_TOKEN|CAL_API_KEY)\s*[:=]\s*["'][^"']{12,}["']/.test(data)) failures.push(`Private configuration in browser bundle ${file}`);
}
for (const file of new Set(files)) {
  if (/^\.env(?:\.|$)/.test(file) && !/\.example$/.test(file)) failures.push(`Environment file tracked: ${file}`);
  if (file.startsWith('.private-assets/')) failures.push(`Private original or manifest tracked: ${file}`);
  if (/^public\/.*(?:\.map$|\.pem$|\.key$|\.env(?:\.|$)|\/source\/|\/originals\/)/i.test(file)) failures.push(`Private/debug artifact under public/: ${file}`);
  if (/\.(?:[cm]?[jt]sx?|json|ya?ml|md|example|sql)$/.test(file)) inspect(file, file.startsWith('public/'));
}
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
for (const file of walk(path.join(root, '.next/static'))) {
  if (file.endsWith('.map')) failures.push(`Browser source map published: ${path.relative(root, file)}`);
  if (file.endsWith('.js')) inspect(file, true);
}
// Self-check without emitting a realistic credential into the repository or logs.
if (!containsCredential('AKIA' + 'Z'.repeat(16))) failures.push('Credential scanner self-check failed');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('Security file and browser-bundle checks passed.');
