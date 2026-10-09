import { createRequire } from 'node:module';

// Use Next's loader so this checks the same precedence and expansion as a release.
process.env.NODE_ENV = 'production';
const require = createRequire(import.meta.url);
const { loadEnvConfig } = createRequire(require.resolve('next/package.json'))('@next/env');
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const e = process.env;
const problems = [];
const fail = message => problems.push(message);
const local = host => ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(host) || host.endsWith('.localhost');
try {
  const db = new URL(e.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || local(db.hostname)) fail('DATABASE_URL must point to the production PostgreSQL database.');
} catch { fail('DATABASE_URL is missing or invalid.'); }
try {
  const site = new URL(e.NEXT_PUBLIC_SITE_URL);
  if (site.protocol !== 'https:' || local(site.hostname) || site.pathname !== '/' || site.search || site.hash || site.username || site.password) fail('NEXT_PUBLIC_SITE_URL must be the public HTTPS origin.');
} catch { fail('NEXT_PUBLIC_SITE_URL is missing or invalid.'); }
if (!e.HASH_SECRET || e.HASH_SECRET.length < 32 || e.HASH_SECRET === 'change-me') fail('HASH_SECRET needs at least 32 characters; preserve the existing production secret.');
if (e.CAL_LOCAL_MODE === 'true') fail('CAL_LOCAL_MODE must be false in production.');
if (e.BOOKING_ENABLED !== 'true') fail('BOOKING_ENABLED must be true for the appointment release.');
try {
  const cal = new URL(e.CAL_BOOKING_URL);
  if (cal.origin !== 'https://cal.com' || !/^\/[\w-]+\/[\w-]+$/.test(cal.pathname) || cal.search || cal.hash || cal.username || cal.password) fail('CAL_BOOKING_URL must be your hosted Cal.com event URL.');
} catch { fail('CAL_BOOKING_URL is missing or invalid.'); }
if (e.CAL_API_BASE_URL && e.CAL_API_BASE_URL !== 'https://api.cal.com/v2/') fail('CAL_API_BASE_URL must use the hosted Cal.com API.');
for (const key of ['CAL_EVENT_TYPE_ID', 'CAL_HOST_ID', 'BOOKING_DURATION_MINUTES']) {
  if (!Number.isSafeInteger(Number(e[key])) || Number(e[key]) < 1) fail(`${key} must be a positive integer.`);
}
for (const key of ['CAL_API_KEY', 'CAL_WEBHOOK_SECRET', 'BOOKING_FORMAT', 'BOOKING_COST_LABEL']) {
  if (!e[key]?.trim()) fail(`${key} is required.`);
}
if (!e.BOOKING_CRON_SECRET || e.BOOKING_CRON_SECRET.length < 32) fail('BOOKING_CRON_SECRET requires at least 32 characters.');
if (e.BOOKING_CRON_SECRET && e.BOOKING_CRON_SECRET === e.CAL_WEBHOOK_SECRET) fail('Use different webhook and maintenance secrets.');
const emailJs = ['EMAILJS_SERVICE_ID', 'EMAILJS_TEMPLATE_ID', 'EMAILJS_PUBLIC_KEY', 'EMAILJS_PRIVATE_KEY'].every(key => e[key]?.trim());
const resend = Boolean(e.RESEND_API_KEY?.trim() && e.NOTIFY_FROM_EMAIL?.trim());
if (!emailJs && !resend) console.warn('Email provider is unset: Veloce team notifications will be skipped; Cal.com handles its own booking emails.');
if (problems.length) {
  console.error('Production configuration needs attention:\n' + problems.map(p => `- ${p}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Production environment checks passed. Next verify database connectivity, Cal.com event/calendar, webhook delivery and the maintenance schedule.');
}
