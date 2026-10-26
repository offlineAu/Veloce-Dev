import { expect, test, type Page } from "@playwright/test";
import { PRIVACY_NOTICE_VERSION } from "../../src/lib/legal";

test.skip(process.env.E2E_ANALYTICS !== "true", "Requires an isolated production build with analytics enabled");

test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36" });

// The SDK filters automation using both userAgentData brands and webdriver.
// Emulate a normal browser for collection tests; production keeps bot filtering enabled.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined });
  });
});

type Capture = { action: string; event?: string; properties?: { page?: string; form?: string; first_source?: string; first?: { source?: string }; latest?: { source?: string } } };
async function collector(page: Page) {
  const requests: Capture[] = [];
  await page.route("**/api/analytics", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.route(/\/api\/analytics\/e\/?(?:\?.*)?$/, async route => {
    const raw = route.request().postData() ?? "";
    const encoded = route.request().headers()["content-type"]?.includes("application/x-www-form-urlencoded");
    const data = JSON.parse(encoded ? Buffer.from(new URLSearchParams(raw).get("data")!, "base64").toString() : raw);
    requests.push(...(data.batch ?? [data]));
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":1}' });
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
  await page.goto("/about");
  await page.getByRole("button", { name: "Start a conversation", exact: true }).click();
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
  await expect.poll(() => requests.filter(r => r.event === "$pageview").length).toBe(1);
  expect(requests.find(r => r.event === "$pageview")?.properties?.page).toBe("/");
  expect(JSON.stringify(requests)).not.toContain("private-test-token");
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page.getByRole("navigation", { name: "Mobile", exact: true }).getByRole("link", { name: "About" }).click();
  } else await page.locator('a[href="/about"]:visible').first().click();
  await expect(page).toHaveURL(/\/about$/);
  await expect.poll(() => requests.filter(r => r.event === "$pageview").length).toBe(2);
  expect(requests.filter(r => r.event === "$pageview")[1]?.properties?.first?.source).toBe("newsletter");
  await expect.poll(() => requests.filter(r => r.event === "$pageleave").length).toBe(1);
  expect(requests.find(r => r.event === "$pageleave")?.properties?.page).toBe("/");
  await page.reload();
  await expect.poll(() => requests.filter(r => r.event === "$pageview").length).toBe(3);
  await page.getByRole("button", { name: "Analytics preferences", exact: true }).click();
  await page.getByRole("button", { name: "Decline", exact: true }).click();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(requests.filter(r => r.event === "$pageview")).toHaveLength(3);
});

test("request linking defaults off and form input values are never captured", async ({ page }) => {
  const requests = await collector(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Allow analytics", exact: true }).click();
  await page.goto("/about");
  await page.getByRole("button", { name: "Start a conversation", exact: true }).click();
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
