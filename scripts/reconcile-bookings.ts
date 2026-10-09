import 'dotenv/config';
// Calls the deployed, authenticated maintenance boundary; secrets never appear in command arguments.
const url = new URL('/api/booking/maintenance', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000');
const secret = process.env.BOOKING_CRON_SECRET;
if (!secret || secret.length < 32) throw new Error('BOOKING_CRON_SECRET must be configured');
async function main() {
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(240_000) });
  if (!response.ok) throw new Error(`Maintenance returned ${response.status}`);
  console.log(await response.json());
}
void main().catch(error => { console.error(error.message); process.exitCode = 1; });
