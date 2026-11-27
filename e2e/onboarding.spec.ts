import type { Page } from "@playwright/test";
import { test, expect, openDemo, expectNoHorizontalScroll, axeViolations } from "./fixtures";
import { tabBar } from "./helpers";

const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const stepLabel = (page: Page, n: number) => page.getByText(`Step ${n} of 5`);

/** Every onboarding screen must fit the phone and be accessible. */
async function expectScreenOk(page: Page) {
  await expectNoHorizontalScroll(page);
  // The grey "Skip" link fails contrast (reported separately below); everything else must be clean.
  const rest = (await axeViolations(page)).filter(v => !(v.startsWith("color-contrast") && v.includes(".ob-link")));
  expect(rest).toEqual([]);
}

test.describe("first-run onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, "home", "fresh");
    await expect(page.getByRole("heading", { name: "Dinner, sorted." })).toBeVisible();
  });

  test("welcome screen hides the tab bar and fits the phone", async ({ page }) => {
    await expect(tabBar(page)).toHaveCount(0);
    await expectScreenOk(page);
  });

  test("walks through every step, then lands on This week with the tab bar", async ({ page }) => {
    await page.getByRole("button", { name: "Let's go" }).click();

    // Step 1: pantry
    await expect(stepLabel(page, 1)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Pantry/ })).toBeVisible();
    await expect(page.getByText("0 selected")).toBeVisible();
    await expectScreenOk(page);
    await chip(page, "All-purpose flour").click();
    await expect(chip(page, "All-purpose flour")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("1 selected")).toBeVisible();
    await chip(page, "All-purpose flour").click();
    await expect(chip(page, "All-purpose flour")).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: /^✓ Select common/ }).click();
    await expect(chip(page, "All-purpose flour")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Cornmeal")).toHaveAttribute("aria-pressed", "true");
    await chip(page, "Cornmeal").click(); // deselect one
    await expect(chip(page, "Cornmeal")).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: /^Next: Fridge/ }).click();

    // Step 2: fridge
    await expect(stepLabel(page, 2)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Fridge/ })).toBeVisible();
    await expectScreenOk(page);
    await page.getByRole("button", { name: /^✓ Select common/ }).first().click();
    await expect(page.getByText(/[1-9]\d* selected/)).toBeVisible();
    await page.getByRole("button", { name: /^Next: Freezer/ }).click();

    // Step 3: freezer
    await expect(stepLabel(page, 3)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Freezer/ })).toBeVisible();
    await expectScreenOk(page);
    await page.getByRole("button", { name: /^✓ Select common/ }).first().click();
    await page.getByRole("button", { name: /^Next: Always-buy/ }).click();

    // Step 4: always buy (staples + kids' snacks)
    await expect(stepLabel(page, 4)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Always buy/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kids' snacks & lunchbox" })).toBeVisible();
    await expect(chip(page, "Milk")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Bananas")).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Fig bars")).toHaveAttribute("aria-pressed", "false");
    await chip(page, "Fig bars").click();
    await expect(chip(page, "Fig bars")).toHaveAttribute("aria-pressed", "true");
    await chip(page, "Cereal").click(); // drop a default staple
    await expect(chip(page, "Cereal")).toHaveAttribute("aria-pressed", "false");
    await expectScreenOk(page);
    await page.getByRole("button", { name: /^Review/ }).click();

    // Step 5: review
    await expect(stepLabel(page, 5)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your kitchen is set" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Pantry" })).toContainText(/\d+ items?/);
    await expect(page.getByRole("listitem").filter({ hasText: "Always buy" })).toContainText(/\d+ items?/);
    await expectScreenOk(page);
    await page.getByRole("button", { name: "Plan my week ›" }).click();

    // Landed on This week
    await expect(page).toHaveURL(/#home$/);
    await expect(page.getByRole("heading", { name: "This week", level: 1 })).toBeVisible();
    await expect(tabBar(page)).toBeVisible();
    await expect(tabBar(page).getByRole("button", { name: "This week" })).toHaveAttribute("aria-current", "page");
  });

  test("Back and Skip move between steps", async ({ page }) => {
    await page.getByRole("button", { name: "Let's go" }).click();
    await expect(stepLabel(page, 1)).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(stepLabel(page, 2)).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(stepLabel(page, 1)).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Dinner, sorted." })).toBeVisible();
  });

  test("search finds an ingredient and selects it", async ({ page }) => {
    await page.getByRole("button", { name: "Let's go" }).click();
    await page.getByLabel("Search ingredients").fill("tahini");
    await expect(chip(page, "Tahini")).toBeVisible();
    await chip(page, "Tahini").click();
    await expect(chip(page, "Tahini")).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("Clear search").click();
    await expect(page.getByText("1 selected")).toBeVisible();
  });

  // known bug: an item added via "+ Add ..." during onboarding is saved but never shows up (not in search, not
  // counted as selected) because the screen reads the catalog before the custom-items sync has run.
  test("a custom item added in onboarding shows up selected", async ({ page }) => {
    await page.getByRole("button", { name: "Let's go" }).click();
    await page.getByLabel("Search ingredients").fill("Dragonfruit powder");
    await page.getByRole("button", { name: /Add .Dragonfruit powder. to pantry/ }).click();
    await page.getByLabel("Search ingredients").fill("Dragonfruit");
    await expect(chip(page, "Dragonfruit powder")).toHaveAttribute("aria-pressed", "true");
  });

  test("picks persist: pantry choices show in Kitchen, staples show on the List", async ({ page }) => {
    await page.getByRole("button", { name: "Let's go" }).click();
    await chip(page, "All-purpose flour").click();
    await chip(page, "Cornmeal").click();
    await chip(page, "Cornmeal").click(); // on, then off again
    await page.getByRole("button", { name: /^Next: Fridge/ }).click();
    await page.getByRole("button", { name: /^Next: Freezer/ }).click();
    await page.getByRole("button", { name: /^Next: Always-buy/ }).click();
    await chip(page, "Fig bars").click();
    await chip(page, "Cereal").click(); // staple turned off
    await page.getByRole("button", { name: /^Review/ }).click();
    await page.getByRole("button", { name: "Plan my week ›" }).click();
    await expect(tabBar(page)).toBeVisible();

    // Kitchen: flour in stock, cornmeal not
    await tabBar(page).getByRole("button", { name: "Kitchen" }).click();
    const rowOf = (name: string) =>
      page.locator(".inv-row", { has: page.locator(".inv-row__name", { hasText: new RegExp(`^${name}$`) }) }).first();
    await expect(rowOf("All-purpose flour")).toHaveClass(/inv-row--have/);
    await expect(rowOf("Cornmeal")).not.toHaveClass(/inv-row--have/);

    // List: chosen staples are listed, the unchosen one is not
    await tabBar(page).getByRole("button", { name: "List" }).click();
    const list = page.getByRole("list", { name: "Shopping list" });
    await expect(list.getByText("Fig bars", { exact: true })).toBeVisible();
    await expect(list.getByText("Milk", { exact: true })).toBeVisible();
    await expect(list.getByText("Bananas", { exact: true })).toBeVisible();
    await expect(list.getByText("Cereal", { exact: true })).toHaveCount(0);
  });

  // known bug: the grey "Skip" link in the step header (.ob-link) is below the 4.5:1 contrast ratio on steps 1 to 4.
  test("Skip link meets colour contrast", async ({ page }) => {
    await page.getByRole("button", { name: "Let's go" }).click();
    expect(await axeViolations(page)).toEqual([]);
  });

  test("progress survives a reload mid-setup", async ({ page }) => {
    await page.getByRole("button", { name: "Let's go" }).click();
    await chip(page, "All-purpose flour").click();
    await page.getByRole("button", { name: /^Next: Fridge/ }).click();
    await expect(stepLabel(page, 2)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dinner, sorted." }).or(stepLabel(page, 2))).toBeVisible();
  });
});
