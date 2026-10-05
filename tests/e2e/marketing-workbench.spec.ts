import { expect, test } from "@playwright/test";

test("services can be explored by need without losing the catalogue or inquiry action", async ({ page }) => {
  await page.goto("/");
  const services = page.locator("[data-services-explorer]");
  await expect(services.getByRole("heading", { level: 3 })).toHaveCount(10); // chooser + nine services
  await services.getByRole("button", { name: /Run the day-to-day/ }).click();
  await expect(services.getByRole("heading", { name: "Internal business systems" })).toBeVisible();
  await expect(services.getByRole("heading", { name: "Business websites" })).toHaveCount(0);
  await services.getByRole("button", { name: "Internal business systems", exact: true }).click();
  await services.getByRole("button", { name: "Ask about Internal business systems" }).click();
  await expect(page.getByRole("dialog", { name: "Tell us about your project" })).toBeVisible();
  await page.keyboard.press("Escape");
  await services.getByRole("button", { name: /Improve what exists/ }).click();
  await expect(services.getByRole("heading", { level: 3 })).toHaveCount(3);
  await services.getByRole("button", { name: /Explore all services/ }).click();
  await expect(services.getByRole("heading", { level: 3 })).toHaveCount(10);
});

test("the delivery stages expose all six steps and keep keyboard navigation usable", async ({ page }) => {
  await page.goto("/");
  const workbench = page.locator("[data-approach-workbench]");
  const think = workbench.getByRole("tab", { name: "Think it." });
  await think.focus();
  await expect(workbench.getByRole("heading", { name: "Understand the problem" })).toBeVisible();
  await expect(workbench.getByRole("heading", { name: "Agree what matters" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(workbench.getByRole("tab", { name: "Build it." })).toHaveAttribute("aria-selected", "true");
  await expect(workbench.getByRole("heading", { name: "Design the key screens" })).toBeVisible();
  await expect(workbench.getByRole("heading", { name: "Build a working version" })).toBeVisible();
  await workbench.getByRole("button", { name: "11:30", exact: true }).click();
  await expect(workbench.getByRole("status")).toContainText("Selected time: 11:30");
  await workbench.getByRole("button", { name: "Choose an improvement" }).click();
  await expect(workbench.getByRole("tab", { name: "Make it work." })).toBeFocused();
  await expect(workbench.getByRole("heading", { name: "Test with real use" })).toBeVisible();
  await expect(workbench.getByRole("heading", { name: "Improve and support" })).toBeVisible();
  await workbench.getByRole("button", { name: "Let customers reschedule", exact: true }).click();
  await expect(workbench.getByRole("status")).toContainText("Let customers reschedule");
  await workbench.getByRole("tab", { name: "Build it." }).click();
  await expect(workbench.getByRole("button", { name: "11:30", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("changing the first scope changes the working example and a new workflow resets its choices", async ({ page }) => {
  await page.goto("/");
  const workbench = page.locator("[data-approach-workbench]");
  await workbench.getByRole("button", { name: "Automated reminders", exact: true }).click();
  await workbench.getByRole("button", { name: "See a working example" }).click();
  await expect(workbench.getByRole("heading", { name: "Try choosing a reminder channel" })).toBeVisible();
  await workbench.getByRole("button", { name: "Email", exact: true }).click();
  await expect(workbench.getByRole("status")).toContainText("Reminder channel: Email");
  await workbench.getByRole("button", { name: "Choose an improvement" }).click();
  await expect(workbench.getByRole("button", { name: "Send reminders", exact: true })).toHaveCount(0);
  await workbench.getByRole("button", { name: "Team approvals", exact: true }).click();
  await expect(workbench.getByRole("tab", { name: "Think it." })).toHaveAttribute("aria-selected", "true");
  await workbench.getByRole("button", { name: "See a working example" }).click();
  await expect(workbench.getByRole("status")).toContainText("Ready for your input");
  await workbench.getByRole("button", { name: "Request changes", exact: true }).click();
  await expect(workbench.getByRole("status")).toContainText("Review action: Request changes");
  await expect(workbench).toContainText("No real booking or request is created.");
});

test("reduced motion keeps the whole interactive journey available without horizontal overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const workbench = page.locator("[data-approach-workbench]");
  await workbench.getByRole("button", { name: "See a working example" }).click();
  await workbench.getByRole("button", { name: "09:00", exact: true }).click();
  await expect(workbench.getByRole("status")).toContainText("Selected time: 09:00");
  await expect(workbench.getByRole("heading", { name: "Build what works." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
