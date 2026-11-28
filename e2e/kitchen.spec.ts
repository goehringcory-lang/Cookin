import type { Page } from "@playwright/test";
import { test, expect, openDemo, expectNoHorizontalScroll, axeViolations } from "./fixtures";

const row = (page: Page, name: string) =>
  page.locator(".inv-row", { has: page.locator(".inv-row__name", { hasText: new RegExp(`^${name}$`) }) }).first();

/** Name of the first item in the current tab with this status. */
async function firstWith(page: Page, status: "have" | "low" | "out") {
  return (await page.locator(`.inv-row--${status} .inv-row__name`).first().textContent())!.trim();
}

test.describe("Kitchen screen", () => {
  test.beforeEach(async ({ page }) => {
    await openDemo(page, "kitchen");
    await expect(page.locator(".inv-row").first()).toBeVisible();
  });

  test("fits the phone, has big tap targets and no serious a11y issues", async ({ page }) => {
    await expectNoHorizontalScroll(page);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".inv button")]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width && r.height && (r.width < 44 || r.height < 44))
        .map(({ el }) => el.getAttribute("aria-label") || el.textContent?.trim()),
    );
    expect(small).toEqual([]);
    expect(await axeViolations(page)).toEqual([]);
  });

  test("tap marks an item out, Undo brings it back", async ({ page }) => {
    const name = await firstWith(page, "have");
    await row(page, name).locator(".inv-row__main").click();
    await expect(row(page, name)).toHaveClass(/inv-row--out/);
    await page.locator(".inv-toast").getByRole("button", { name: "Undo" }).click();
    await expect(row(page, name)).toHaveClass(/inv-row--have/);
  });

  test("out item can be added to the list from the toast", async ({ page }) => {
    const name = await firstWith(page, "have");
    await row(page, name).getByRole("radio", { name: "Out" }).click();
    await page.locator(".inv-toast").getByRole("button", { name: "Add to list", exact: true }).click();
    await expect(row(page, name).locator(".inv-row__status")).toHaveText("Out · on your list");
  });

  test("Low puts an item on the list and counts it", async ({ page }) => {
    const name = await firstWith(page, "have");
    await row(page, name).getByRole("radio", { name: "Low" }).click();
    await expect(row(page, name)).toHaveClass(/inv-row--low/);
    await expect(row(page, name).locator(".inv-row__status")).toHaveText("Running low · on your list");
    await page.getByRole("button", { name: /^Running low/ }).click();
    await expect(row(page, name)).toBeVisible();
    await expect(page.locator(".inv-row--have")).toHaveCount(0);
  });

  test("browse the freezer, pick several items, add them all as Have", async ({ page }) => {
    await page.getByRole("tab", { name: /Freezer/ }).click();
    await page.locator(".inv-fab").click();
    const sheet = page.getByRole("dialog", { name: "Add to your kitchen" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
    await sheet.getByRole("button", { name: "Freezer", exact: true }).click();
    await expectNoHorizontalScroll(page);
    const picks = sheet.locator(".inv-pick:not(:has(.inv-pick__out))");
    const names = [(await picks.nth(0).getAttribute("aria-label"))!, (await picks.nth(1).getAttribute("aria-label"))!];
    await picks.nth(0).click();
    await picks.nth(0).click(); // tap again to unpick
    await picks.nth(0).click();
    await picks.nth(1).click();
    await expect(sheet.locator(".inv-pick.is-on")).toHaveCount(2);
    await sheet.getByRole("button", { name: "I have these 2" }).click();
    for (const n of names) await expect(row(page, n)).toHaveClass(/inv-row--have/);
    await page.locator(".inv-toast").getByRole("button", { name: "Undo" }).click();
    for (const n of names) await expect(row(page, n)).toHaveCount(0);
  });

  test("browse search narrows the list", async ({ page }) => {
    await page.getByRole("tab", { name: /Freezer/ }).click();
    await page.locator(".inv-fab").click();
    const sheet = page.getByRole("dialog", { name: "Add to your kitchen" });
    await sheet.getByRole("searchbox").fill("salmon");
    await expect(sheet.locator(".inv-pick").first()).toContainText(/salmon/i);
    await expect(sheet.locator(".inv-browse__group")).not.toHaveCount(0);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    expect(await axeViolations(page)).toEqual([]);
  });

  test("tabs show items you don't have; one tap marks one Have", async ({ page }) => {
    await page.getByRole("tab", { name: /Freezer/ }).click();
    const chip = page.locator(".inv-pick--missing").first();
    const name = (await chip.getAttribute("aria-label"))!.replace(/^Add (.*), I have it$/, "$1");
    await chip.click();
    await expect(row(page, name)).toHaveClass(/inv-row--have/);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    expect(await axeViolations(page)).toEqual([]);
    await page.getByRole("button", { name: "Only mine" }).click();
    await expect(page.locator(".inv-pick--missing")).toHaveCount(0);
  });

  test("tabs switch between pantry, fridge, freezer and spices", async ({ page }) => {
    for (const tab of ["Fridge", "Freezer", "Spices", "Pantry"]) {
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      await expect(page.getByRole("tab", { name: new RegExp(tab) })).toHaveAttribute("aria-selected", "true");
    }
  });

  test("search adds a catalog item and a custom item", async ({ page }) => {
    const search = page.getByLabel("Search your kitchen");
    await search.fill("gochujang");
    await page.locator(".inv-row--suggest .inv-row__main", { hasText: "Gochujang" }).click();
    await expect(page.locator(".inv-toast")).toContainText("Added Gochujang");
    await expect(row(page, "Gochujang")).toBeVisible();

    await search.fill("Za'atar blend");
    await page.getByText(`Add "Za'atar blend" as a new item`).click();
    await page.getByRole("button", { name: "Add to kitchen" }).click();
    await expect(row(page, "Za'atar blend")).toBeVisible();
  });

  test("Just shopped restocks everything on the list", async ({ page }) => {
    await page.getByRole("button", { name: /Just shopped/ }).click();
    const restock = page.getByRole("button", { name: /^Restock \d+ items?$/ });
    await expect(restock).toBeVisible();
    await restock.click();
    await expect(page.locator(".inv-toast")).toContainText("Restocked");
    for (const tab of ["Pantry", "Fridge", "Freezer", "Spices"]) {
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      await expect(page.locator(".inv-row--low")).toHaveCount(0);
    }
  });

  test("press and hold opens the item sheet, which can remove it", async ({ page }) => {
    const name = await firstWith(page, "have");
    const box = (await row(page, name).locator(".inv-row__main").boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    await expect(page.getByRole("dialog", { name })).toBeVisible();
    await page.getByRole("button", { name: "I don't keep this anymore" }).click();
    await expect(row(page, name)).toHaveCount(0);
    await page.locator(".inv-toast").getByRole("button", { name: "Undo" }).click();
    await expect(row(page, name)).toBeVisible();
  });
});
