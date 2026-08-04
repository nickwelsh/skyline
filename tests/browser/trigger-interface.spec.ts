import { expect, test } from "@playwright/test";

const retryRun = "run_01J8R4NQX6K3PV4W0A1H2Z7M9C";

test("Runs keeps Trigger's dense shell, URL filters, navigation, and branding boundary", async ({ page }) => {
  await page.goto("/skyline");

  await expect(page.getByText("Skyline", { exact: true })).toBeVisible();
  await expect(page.getByText("Runs", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toBeVisible();
  await expect(page.getByText("Trigger.dev")).toHaveCount(0);
  await expect(page.getByText("PROTOTYPE")).toHaveCount(0);

  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page).toHaveURL(/cursor=25/);
  await page.getByText("BackgroundJob30", { exact: true }).click();
  await expect(page).toHaveURL(/runs\/run_fixture_30.*span=run_fixture_30/);
  await expect(page.getByText("run_fixture_30", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/cursor=25/);
  await page.getByRole("button", { name: /Previous/ }).click();
  await expect(page).not.toHaveURL(/cursor=/);

  const search = page.getByPlaceholder("Search Runs");
  await search.fill("ImportLegacyOrders");
  await expect(page).toHaveURL(/search=ImportLegacyOrders/);
  await expect(page.getByText("ImportLegacyOrders", { exact: true })).toBeVisible();
  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true })).toHaveCount(0);

  await search.fill("");
  await page.getByText("GenerateMonthlyInvoices", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/skyline/runs/${retryRun}.*span=${retryRun}`));
  await expect(page.getByText(retryRun, { exact: true })).toBeVisible();
});

test("trace preserves selection, keyboard controls, filters, panels, and inspector", async ({ page }) => {
  await page.goto(`/skyline/runs/${retryRun}?span=${retryRun}`);

  await expect(page.getByText("GenerateMonthlyInvoices", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await expect(page).toHaveURL(/span=attempt_01J8R4NQX6K3PV4W0A1H2Z7M9C_1/);
  await expect(page.getByText("Illuminate\\Database\\DeadlockException")).toBeVisible();

  const queueTime = page.getByRole("switch", { name: "Queue time" });
  await expect(queueTime).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("q");
  await expect(queueTime).toHaveAttribute("aria-checked", "true");

  await page.getByPlaceholder("Search Trace").fill("insert into");
  await expect(page.locator('[data-node-id="span_4f24adb545b26d31"]')).toBeVisible();
  await page.locator('[data-node-id="span_4f24adb545b26d31"]').click();
  await page.getByRole("tab", { name: "Detail" }).click();
  await expect(page.getByText("Parameterized SQL")).toBeVisible();

  const menu = page.getByTestId("side-menu");
  await expect(menu).toHaveCSS("width", "224px");
  await page.getByTestId("side-menu-resizer").click();
  await expect(menu).toHaveCSS("width", "44px");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
});

test("fixed fixtures retain reviewed Runs and trace visuals", async ({ page }) => {
  await page.goto("/skyline");
  await expect(page).toHaveScreenshot("runs.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });

  await page.goto(`/skyline/runs/${retryRun}?span=${retryRun}`);
  await expect(page).toHaveScreenshot("retry-trace.png", { animations: "disabled", maxDiffPixelRatio: 0.01 });
});
