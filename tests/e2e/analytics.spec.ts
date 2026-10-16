import { expect, test, type Page } from "@playwright/test";
import { PRIVACY_NOTICE_VERSION } from "../../src/lib/legal";

test.skip(process.env.E2E_ANALYTICS !== "true", "Requires an isolated production build with analytics enabled");

type Capture = { action: string; event?: string; properties?: { page?: string; form?: string; first_source?: string; first?: { source?: string }; latest?: { source?: string } } };
async function collector(page: Page) {
  const requests: Capture[] = [];
  await page.route("**/api/analytics", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  return requests;
}
// Run with a production build having ANALYTICS_ENABLED=true and a test project key.
// Browser capture requests are intercepted, so these tests never send visitor data to PostHog.
test("declining leaves browsing untracked and sales forms usable", async ({ page }) => {
  const requests = await collector(page);
  await page.goto("/");
  const preferences = page.getByRole("region", { name: "Analytics preferences" });
  await expect(preferences).toBeVisible();
  expect(requests).toHaveLength(0);
  await preferences.getByRole("button", { name: "Decline", exact: true }).click();
  await expect(preferences).not.toBeVisible();
  await page.locator("[data-hero-cta]").click();
  const dialog = page.getByRole("dialog", { name: "Tell us about your project" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Name/).fill("Browser fixture");
  expect(requests.filter(r => r.action === "capture")).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem("veloce.analytics.attribution.v1"))).toBeNull();
});

test("acceptance tracks each route once, retains campaign attribution, and withdrawal stops capture", async ({ page }) => {
  const requests = await collector(page);
  await page.goto("/?utm_source=newsletter&utm_campaign=launch&ref=private-test-token");
  await page.getByRole("button", { name: "Allow analytics", exact: true }).click();
  await expect.poll(() => requests.filter(r => r.event === "page_viewed").length).toBe(1);
  expect(requests.find(r => r.event === "page_viewed")?.properties?.page).toBe("/");
  expect(JSON.stringify(requests)).not.toContain("private-test-token");
  await page.locator('a[href="/about"]:visible').first().click();
  await expect(page).toHaveURL(/\/about$/);
  await expect.poll(() => requests.filter(r => r.event === "page_viewed").length).toBe(2);
  expect(requests.filter(r => r.event === "page_viewed")[1]?.properties?.first?.source).toBe("newsletter");
  await page.reload();
  await expect.poll(() => requests.filter(r => r.event === "page_viewed").length).toBe(3);
  await page.getByRole("button", { name: "Analytics preferences", exact: true }).click();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(requests.filter(r => r.event === "page_viewed")).toHaveLength(3);
});

test("request linking defaults off and form input values are never captured", async ({ page }) => {
  const requests = await collector(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Allow analytics", exact: true }).click();
  await page.locator("[data-hero-cta]").click();
  const dialog = page.getByRole("dialog", { name: "Tell us about your project" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: /Optionally connect/ })).not.toBeChecked();
  await dialog.getByLabel(/^Name/).fill("Private Browser Fixture");
  await dialog.getByLabel(/^Email/).fill("private-fixture@example.com");
  await expect.poll(() => requests.filter(r => r.event === "form_started").length).toBe(1);
  expect(requests.filter(r => r.event === "form_opened")).toHaveLength(1);
  expect(JSON.stringify(requests)).not.toMatch(/Private Browser Fixture|private-fixture@example/);
});

test("real production collector creates and revokes signed consent without sending events", async ({ request, baseURL }) => {
  const endpoint = new URL("/api/analytics", baseURL!).toString();
  const origin = new URL(endpoint).origin;
  const initial = await request.post(endpoint, { headers: { origin }, data: { action: "status" } });
  expect(initial.status()).toBe(403);
  const accepted = await request.post(endpoint, { headers: { origin }, data: { action: "allow", noticeVersion: PRIVACY_NOTICE_VERSION } });
  expect(accepted.status()).toBe(204);
  expect(accepted.headers()["set-cookie"]).toMatch(/veloce_analytics=.*HttpOnly/i);
  expect((await request.post(endpoint, { headers: { origin }, data: { action: "status" } })).status()).toBe(204);
  expect((await request.post(endpoint, { headers: { origin }, data: { action: "withdraw" } })).status()).toBe(204);
  expect((await request.post(endpoint, { headers: { origin }, data: { action: "status" } })).status()).toBe(403);
});
