import { expect, test } from "@playwright/test";

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`marketing content has no blocking loader with ${reducedMotion} motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    for (const path of ["/", "/about", "/services/business-websites"]) {
      await page.goto(path);
      await expect(page.locator("[data-boot-loader]")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
}
