import { expect, test } from "@playwright/test";

test("renders the Relay Studio desktop shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Relay Studio desktop shell")).toBeVisible();
  await expect(page.getByLabel("Project explorer")).toBeVisible();
  await expect(page.getByLabel("Workbench")).toBeVisible();
  await expect(page.getByLabel("Response and console dock")).toBeVisible();
  await expect(page.getByLabel("Primary navigation")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Inspector" })).toHaveCount(0);

  await page.getByRole("button", { name: "Show inspector" }).click();
  await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
});

test("opens command palette and import placeholder", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Search commands/i }).click();
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Import API Docs" }).click();
  await expect(page.getByRole("tab", { name: /Import API Docs/i })).toBeVisible();
});
