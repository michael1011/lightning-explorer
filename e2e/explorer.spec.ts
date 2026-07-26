import { expect, test } from "@playwright/test";

// These flows hit the live Boltz API. We search for a large, long-lived node so
// there is reliably something to click through to, and assert on page structure
// rather than specific values.
const STABLE_ALIAS = "ACINQ";

test.describe("Explorer flows against the production API", () => {
  test("search -> node -> channel", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox").fill(STABLE_ALIAS);
    await page.getByRole("button", { name: "Search" }).click();

    // Search results.
    await expect(page).toHaveURL(new RegExp(`/search/${STABLE_ALIAS}$`));
    await expect(
      page.getByRole("heading", { name: "Search result" }),
    ).toBeVisible();
    await expect(page.getByText(/results found for/)).toBeVisible();

    // The first result card links to a node page.
    const nodeLink = page.locator('a[href^="/node/"]').first();
    await expect(nodeLink).toBeVisible();
    await nodeLink.click();

    // Node page.
    await expect(page).toHaveURL(/\/node\/[0-9a-f]{66}$/);
    await expect(page.getByRole("heading", { name: /^Node:/ })).toBeVisible();
    await expect(page.getByText(/^ID:/)).toBeVisible();
    const channelsTable = page.getByRole("table");
    await expect(channelsTable).toBeVisible({ timeout: 30_000 });

    // Follow a channel from the table.
    const channelLink = page.locator('a[href^="/channel/"]').first();
    await expect(channelLink).toBeVisible();
    await channelLink.click();

    // Channel page.
    await expect(page).toHaveURL(/\/channel\//);
    await expect(page.getByRole("heading", { name: "Channel" })).toBeVisible();
    await expect(page.getByText(/^Capacity:/)).toBeVisible();
  });

  test("renders a search result page from a deep link", async ({ page }) => {
    // Deep-linking a sub-route exercises the SPA fallback plus the live API.
    await page.goto(`/search/${STABLE_ALIAS}`);

    await expect(
      page.getByRole("heading", { name: "Search result" }),
    ).toBeVisible();
    await expect(
      page.locator('a[href^="/node/"]').first(),
    ).toBeVisible();
  });
});
