import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resetFixtures, query, TOKENS, uniqueEmail } from './helpers';
const enabled = process.env.E2E_BOOKING_ENABLED === 'true';
test.beforeAll(resetFixtures);

test('sample choices never book and meeting entry restores the example', async ({ page }) => {
  const external: string[] = [];
  page.on('request', r => { if (/cal\.com/.test(r.url())) external.push(r.url()); });
  await page.goto('/');
  const workbench = page.locator('[data-approach-workbench]');
  await workbench.getByRole('button', { name: 'See a working example' }).click();
  await workbench.getByRole('button', { name: '11:30', exact: true }).click();
  await expect(workbench.getByRole('status')).toContainText('Selected time: 11:30');
  expect(external).toEqual([]);
  await workbench.locator('[data-workbench-meeting]').click();
  await expect(page.locator('#veloce-meeting-title')).toBeFocused();
  await workbench.getByRole('tab', { name: 'Make it work.' }).click();
  await expect(page.locator('[data-meeting-panel]')).toBeVisible();
  await page.getByRole('button', { name: 'Back to example' }).click();
  await workbench.getByRole('tab', { name: 'Build it.' }).click();
  await expect(workbench.getByRole('button', { name: '11:30', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(external).toEqual([]);
});

test('direct meeting entry needs no demo and has no overflow or axe violations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('[data-contact-cta]').getByRole('button', { name: enabled ? 'Book a meeting with Veloce' : 'Request a meeting with Veloce', exact: true }).click();
  await expect(page.locator('#veloce-meeting-title')).toBeFocused();
  await expect(page.locator('[data-meeting-panel]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  expect((await new AxeBuilder({ page }).include('[data-meeting-panel]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

test('meeting request validates and persists a request, never an appointment', async ({ page }) => {
  test.skip(enabled, 'This checks the unconfigured-calendar fallback');
  const email = uniqueEmail('meeting-request');
  await page.goto(`/?ref=${TOKENS.active}`);
  await page.locator('[data-workbench-meeting]').click();
  const panel = page.locator('[data-meeting-panel]');
  await panel.getByRole('button', { name: 'Send meeting request' }).click();
  await expect(panel.getByText('Please add your name.')).toBeVisible();
  await panel.getByLabel(/^Name/).fill('Meeting Visitor');
  await panel.getByLabel(/^Email/).fill(email);
  await panel.getByLabel(/I agree that Veloce/).check();
  await page.waitForTimeout(1600);
  await panel.getByRole('button', { name: 'Send meeting request' }).click();
  await expect(panel.getByRole('heading', { name: 'Meeting request received' })).toBeVisible();
  await expect(panel).toContainText('No appointment time has been reserved.');
  const rows = await query<{ intent: string; status: string; source: string; appointments: string }>('SELECT l.intent, l.status, l.source, (SELECT count(*) FROM "Appointment" a WHERE a."leadId"=l.id)::text AS appointments FROM "Lead" l WHERE l.email=$1', [email]);
  expect(rows[0]).toMatchObject({ intent: 'MEETING', status: 'NEW', source: 'REFERRAL_VERIFIED', appointments: '0' });
});

for (const status of ['CONFIRMED', 'REQUESTED'] as const) {
  test(`enabled scheduler verifies ${status} and preserves a single embed`, async ({ page }) => {
    test.skip(!enabled, 'Run against the explicit Cal fixture server');
    await page.route('https://app.cal.com/embed/embed.js', route => route.fulfill({ contentType: 'application/javascript', body: readFileSync('tests/fixtures/cal-embed.js', 'utf8') }));
    await page.goto(`/?ref=${TOKENS.active}`);
    const workbench = page.locator('[data-approach-workbench]');
    await workbench.locator('[data-workbench-meeting]').click();
    const panel = page.locator('[data-meeting-panel]');
    await expect(panel.getByRole('button', { name: 'Choose a real meeting time' })).toBeDisabled();
    await panel.getByLabel(/I agree that Veloce/).check();
    await panel.getByRole('button', { name: 'Choose a real meeting time' }).click();
    await expect(page.locator('[data-calendar-fixture]')).toHaveCount(1);
    await workbench.getByRole('tab', { name: 'Build it.' }).click();
    await panel.getByRole('button', { name: 'Back to example' }).click();
    await workbench.locator('[data-workbench-meeting]').click();
    await expect(page.locator('[data-calendar-fixture]')).toHaveCount(1);
    await panel.getByRole('button', { name: status === 'CONFIRMED' ? 'Confirm fixture meeting' : 'Request fixture approval' }).click();
    await expect(panel.getByRole('heading', { name: status === 'CONFIRMED' ? 'Your meeting with Veloce is booked.' : 'Meeting requested—awaiting confirmation.' })).toBeVisible();
    const rows = await query<{ status: string; source: string }>('SELECT a.status, l.source FROM "Appointment" a JOIN "Lead" l ON l.id=a."leadId" WHERE l.email=$1 ORDER BY a."createdAt" DESC LIMIT 1', ['calendar-fixture@example.com']);
    expect(rows[0]).toMatchObject({ status, source: 'REFERRAL_VERIFIED' });
  });
}

test('webhook and maintenance reject unauthenticated requests', async ({ request }) => {
  const webhook = await request.post('/api/booking/webhook', { data: { payload: { uid: 'forged' } } });
  expect([401, 503]).toContain(webhook.status());
  expect((await request.post('/api/booking/maintenance')).status()).toBe(401);
});
