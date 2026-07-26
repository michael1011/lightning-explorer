import { expect, test } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders the search UI", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Lightning Explorer" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("routes a pubkey-shaped query to the node page", async ({ page }) => {
    await page.goto("/");
    const pubkey = "a".repeat(66);

    await page.getByRole("textbox").fill(pubkey);
    await page.getByRole("button", { name: "Search" }).click();

    await expect(page).toHaveURL(new RegExp(`/node/${pubkey}$`));
  });

  test("routes free text to the search page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("textbox").fill("some-alias");
    await page.getByRole("textbox").press("Enter");

    await expect(page).toHaveURL(/\/search\/some-alias$/);
  });
});
