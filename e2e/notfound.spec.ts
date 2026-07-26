import { expect, test } from "@playwright/test";

test.describe("Not found", () => {
  test("shows a not-found page for unknown routes", async ({ page }) => {
    await page.goto("/this/route/does/not/exist");

    await expect(
      page.getByRole("heading", { name: "Not found" }),
    ).toBeVisible();
    // The header link home is always present.
    await expect(
      page.getByRole("link", { name: "Lightning Explorer" }),
    ).toBeVisible();
  });
});
