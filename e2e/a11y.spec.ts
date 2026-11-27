import type { Locator, Page } from "@playwright/test";
import { test, expect, expectNoHorizontalScroll, axeViolations, smallTapTargets } from "./fixtures";
import { openDemoAt } from "./helpers";

/**
 * Tap-target audit. smallTapTargets() lists every control under 44x44; each screen may only contain the known ones
 * below, so a new undersized control (or a known one getting smaller) fails the test.
 *
 * Known undersized controls, all deliberate-looking but under the 44px guideline:
 *   CHIP_40   filter chips, steppers and segmented buttons: 40px high
 *   WEEK_NAV  the "Previous week" / "Next week" chevrons on This week: 36x36
 *   CHECK_28  the round check-off buttons on the shopping list: 28x28 (the item text is also tappable)
 */
const CHIP_40 = /\(\d+x40\)$/;
const WEEK_NAV = /^(Previous|Next) week \(36x36\)$/;
const CHECK_28 = /\(28x28\)$/;
const LIST_LINK = /^Edit always-buy items \(\d+x20\)$/;
const SYNC_BADGE = /^Not synced yet\. Sync options \(\d+x28\)$/;
const SMALL_BTN_36 = /^(Sync|Start|Open) \(\d+x36\)$/;
const SEGMENT_38 = /^(Dinner|Lunch) \(\d+x38\)$/;

async function expectOnlyKnownSmall(page: Page, known: RegExp[]) {
  const unknown = (await smallTapTargets(page)).filter(s => !known.some(re => re.test(s)));
  expect(unknown, "undersized tap targets that are not on the allowlist").toEqual([]);
}

async function audit(page: Page, known: RegExp[]) {
  await expectNoHorizontalScroll(page);
  await expectOnlyKnownSmall(page, known);
  expect(await axeViolations(page)).toEqual([]);
}

/** Wait for a sheet's slide-in animation to finish, so axe does not measure colours mid-fade. */
async function settled(page: Page, el: Locator) {
  await el.evaluate(node => new Promise<void>(resolve => {
    let last = "", stable = 0;
    const tick = () => {
      const r = node.getBoundingClientRect(), now = `${r.top}|${r.height}|${getComputedStyle(node).opacity}`;
      stable = now === last ? stable + 1 : 0;
      last = now;
      stable >= 5 ? resolve() : requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

const swapCard = (page: Page) =>
  page.getByRole("region", { name: "Swap options" }).getByRole("button").filter({ has: page.getByRole("heading", { level: 4 }) }).first();

test.describe("main screens", () => {
  test("This week", async ({ page }) => {
    await openDemoAt(page, "home");
    await expect(page.getByRole("heading", { name: "This week", level: 1, exact: true })).toBeVisible();
    await audit(page, [WEEK_NAV, CHIP_40]);
  });

  test("This week, next week", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Next week", level: 1, exact: true })).toBeVisible();
    await audit(page, [WEEK_NAV]);
  });

  test("This week, empty", async ({ page }) => {
    await openDemoAt(page, "home", "noplan");
    await expect(page.getByRole("heading", { name: "Nothing planned yet" })).toBeVisible();
    await audit(page, [WEEK_NAV, CHIP_40]);
  });

  test("Plan the week", async ({ page }) => {
    await openDemoAt(page, "home", "noplan");
    await page.getByRole("button", { name: "Pick tonight's dinner" }).click();
    await expect(page.getByRole("heading", { name: "Plan this week", level: 1 })).toBeVisible();
    await audit(page, [CHIP_40, SEGMENT_38]);
  });

  test("List", async ({ page }) => {
    await openDemoAt(page, "list");
    await expect(page.getByRole("list", { name: "Shopping list" })).toBeVisible();
    await audit(page, [CHECK_28, LIST_LINK]);
  });

  test("List, always-buy sheet", async ({ page }) => {
    await openDemoAt(page, "list");
    await page.getByRole("button", { name: "Edit always-buy items" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit(page, [CHECK_28, LIST_LINK, CHIP_40]);
  });

  test("Kitchen", async ({ page }) => {
    await openDemoAt(page, "kitchen");
    await expect(page.locator(".inv-row").first()).toBeVisible();
    await audit(page, []);
  });

  test("Recipes", async ({ page }) => {
    await openDemoAt(page, "recipes");
    await expect(page.getByText("32 recipes")).toBeVisible();
    await audit(page, [CHIP_40, SYNC_BADGE, SMALL_BTN_36]);
  });

  test("Recipe", async ({ page }) => {
    await openDemoAt(page, "recipe/nyt-demo-1");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await audit(page, [CHIP_40]);
  });

  test("Settings", async ({ page }) => {
    await openDemoAt(page, "settings");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await audit(page, [CHIP_40, SMALL_BTN_36]);
  });
});

test.describe("swap and meal sheets", () => {
  test("swap bar on tonight's card", async ({ page }) => {
    await openDemoAt(page, "home");
    await expect(swapCard(page)).toBeVisible();
    await page.getByRole("region", { name: "Swap options" }).getByRole("button", { name: "Quicker", exact: true }).click();
    await audit(page, [WEEK_NAV, CHIP_40]);
  });

  test("recipe preview from a swap", async ({ page }) => {
    await openDemoAt(page, "home");
    await swapCard(page).click();
    await expect(page.getByRole("button", { name: "Make this tonight" })).toBeVisible();
    await audit(page, [CHIP_40]);
  });

  test("meal sheet with swaps", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Tomorrow dinner: Beef Tacos with Crunchy Slaw" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("region", { name: "Swap options" })).toBeVisible();
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await settled(page, sheet);
    // The sheet, not the page behind it, is what matters here: measure only inside the dialog.
    const small = await sheet.evaluate(el => [...el.querySelectorAll<HTMLElement>("button")]
      .map(b => ({ b, r: b.getBoundingClientRect() }))
      .filter(({ r }) => r.width && r.height && (r.width < 44 || r.height < 44))
      .map(({ b, r }) => `${b.getAttribute("aria-label") || b.textContent?.trim()} (${Math.round(r.width)}x${Math.round(r.height)})`));
    expect(small.filter(s => !CHIP_40.test(s))).toEqual([]);
    expect(await axeViolations(page)).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test("meal options menu is accessible", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Meal options" }).first().click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Remove from plan" })).toBeVisible();
    await settled(page, page.getByRole("dialog"));
    const items = await menu.getByRole("menuitem").evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)));
    for (const h of items) expect(h, "menu item height").toBeGreaterThanOrEqual(44);
    await expectNoHorizontalScroll(page);
    // Everything but the red "Remove from plan" contrast, which has its own test below.
    expect((await axeViolations(page)).filter(v => !(v.startsWith("color-contrast") && v.includes(".is-danger")))).toEqual([]);
  });

  // known bug: the red "Remove from plan" item in the meal options menu is below the 4.5:1 contrast ratio (.is-danger).
  test("meal options menu text meets colour contrast", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Meal options" }).first().click();
    await expect(page.getByRole("menuitem", { name: "Remove from plan" })).toBeVisible();
    await settled(page, page.getByRole("dialog"));
    expect(await axeViolations(page)).toEqual([]);
  });

  test("Escape closes the meal sheet", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Tomorrow dinner: Beef Tacos with Crunchy Slaw" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
