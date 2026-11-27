import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openDemoAt, TONIGHT_TITLE } from "./helpers";

const list = (page: Page) => page.getByRole("list", { name: "Shopping list" });
const boxes = (page: Page) => list(page).getByRole("checkbox");
const box = (page: Page, name: string) => list(page).getByRole("checkbox", { name: new RegExp(`^${name}(,|$)`) });
const row = (page: Page, name: string) =>
  list(page).getByRole("listitem").filter({ has: page.getByRole("checkbox", { name: new RegExp(`^${name}(,|$)`) }) });
const POT_ROAST = "Sunday Pot Roast with Carrots and Potatoes";

/** Item names on the list, read from the checkboxes' accessible names ("Name" or "Name, amount"). */
async function names(page: Page): Promise<string[]> {
  const labels = await boxes(page).evaluateAll(els => els.map(e => e.getAttribute("aria-label") ?? ""));
  return labels.map(l => l.split(", ")[0]);
}

async function copyText(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Copy for Keep" }).click();
  await expect(page.getByRole("status")).toContainText(/^Copied \d+ items?/);
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe("shopping list", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openDemoAt(page, "list");
    await expect(list(page)).toBeVisible();
  });

  test("has what the week's recipes need, what is running low, and the staples", async ({ page }) => {
    // Missing for Sunday's pot roast, with the recipe named and an amount.
    for (const [name, amount] of [["All-purpose flour", "2 tbsp"], ["Beef broth", "2 cups"], ["Beef chuck roast", "3 lb"]]) {
      const r = row(page, name);
      await expect(r).toContainText(`for ${POT_ROAST}`);
      await expect(r).toContainText(amount);
    }
    // Running low items from the kitchen.
    await expect(row(page, "Olive oil")).toContainText("running low");
    await expect(row(page, "Soy sauce")).toContainText("running low");
    // Staples.
    await expect(row(page, "Milk")).toContainText("staple");
    await expect(row(page, "Bananas")).toContainText("staple");
    await expect(row(page, "Cereal")).toContainText("staple");
    // Header counts what is left to buy.
    const n = await boxes(page).count();
    await expect(page.getByText(`${n} to buy`)).toBeVisible();
    // Things the kitchen already has are not listed.
    await expect(box(page, "Paprika")).toHaveCount(0);
  });

  test("an item appears only once", async ({ page }) => {
    const all = (await names(page)).map(n => n.toLowerCase());
    const dupes = all.filter((n, i) => all.indexOf(n) !== i);
    expect(dupes, "names listed more than once").toEqual([]);
  });

  test("Bread is not listed twice (as low and as a staple)", async ({ page }) => {
    const bread = (await names(page)).filter(n => n.toLowerCase() === "bread");
    expect(bread).toHaveLength(1);
  });

  test("checking an item off moves the counts, unchecking all resets them", async ({ page }) => {
    const before = await boxes(page).count();
    await expect(page.getByText(`${before} to buy`)).toBeVisible();
    await box(page, "Milk").click();
    await expect(box(page, "Milk")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(`${before - 1} to buy · 1 in cart`)).toBeVisible();
    await page.getByRole("button", { name: "Uncheck all" }).click();
    await expect(box(page, "Milk")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText(`${before} to buy`)).toBeVisible();
    await expect(page.getByText("in cart")).toHaveCount(0);
  });

  test("tapping the item's name checks it too", async ({ page }) => {
    await row(page, "Bananas").getByText("Bananas", { exact: true }).click();
    await expect(box(page, "Bananas")).toHaveAttribute("aria-checked", "true");
  });

  test("add a manual item and remove it", async ({ page }) => {
    const add = page.getByRole("button", { name: "Add", exact: true });
    await expect(add).toBeDisabled();
    await page.getByLabel("Add an item").fill("Dish soap");
    await add.click();
    await expect(box(page, "Dish soap")).toBeVisible();
    await expect(page.getByLabel("Add an item")).toHaveValue("");

    await page.getByRole("button", { name: "Remove: Dish soap" }).click();
    await expect(box(page, "Dish soap")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("Removed Dish soap.");
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(box(page, "Dish soap")).toBeVisible();
  });

  test("removing a staple or recipe item takes it off the list", async ({ page }) => {
    await page.getByRole("button", { name: "Remove: Fig bars" }).click();
    await expect(box(page, "Fig bars")).toHaveCount(0);
    await page.getByRole("button", { name: "Remove: Beef broth" }).click();
    await expect(box(page, "Beef broth")).toHaveCount(0);
  });

  test("Copy for Keep puts one item per line on the clipboard, without checked items", async ({ page }) => {
    const unchecked = await boxes(page).count();
    const text = await copyText(page);
    const lines = text.split("\n");
    expect(lines).toHaveLength(unchecked);
    for (const l of lines) {
      expect(l.trim(), "no blank lines").not.toBe("");
      expect(l, "no bullets or checkbox marks").not.toMatch(/^[-*•\[☐]/);
    }
    expect(lines).toContain("Beef chuck roast (3 lb)");
    expect(lines).toContain("All-purpose flour (2 tbsp)");
    expect(lines).toContain("Milk");
    expect(lines).toContain("Bananas");

    // A checked item is left out; the count in the toast follows.
    await box(page, "Milk").click();
    await expect(box(page, "Milk")).toHaveAttribute("aria-checked", "true");
    const after = await copyText(page);
    expect(after.split("\n")).toHaveLength(unchecked - 1);
    expect(after.split("\n")).not.toContain("Milk");
    expect(after.split("\n")).toContain("Bananas");
  });

  test("a manual item is included in Copy for Keep", async ({ page }) => {
    await page.getByLabel("Add an item").fill("Dish soap");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(box(page, "Dish soap")).toBeVisible();
    expect((await copyText(page)).split("\n")).toContain("Dish soap");
  });

  test("Done shopping clears checked items", async ({ page }) => {
    const before = await boxes(page).count();
    await box(page, "Bananas").click();
    await expect(box(page, "Bananas")).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Done shopping" }).click();
    await expect(page.getByRole("status")).toContainText(/Cleared 1 item|back in the kitchen/);
    await expect(boxes(page)).toHaveCount(before - 1);
  });

  test("swapping a planned recipe for a makeable one removes its ingredients from the list", async ({ page }) => {
    const tonightsOnly = list(page).getByRole("listitem").filter({ hasText: `for ${TONIGHT_TITLE}` }).filter({ hasNotText: /,\s|\+| and / });
    const gone = await tonightsOnly.evaluateAll(els => els.map(e => e.querySelector("[role=checkbox]")!.getAttribute("aria-label")!.split(", ")[0]));
    expect(gone.length, "tonight's recipe needs items from the store").toBeGreaterThan(0);
    const potRoast = await names(page).then(n => n.includes("Beef chuck roast"));
    expect(potRoast).toBe(true);

    // Swap tonight's dinner for the first "have everything" option.
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "This week" }).click();
    const first = page.getByRole("region", { name: "Swap options" }).getByRole("button").filter({ has: page.getByRole("heading", { level: 4 }) }).first();
    await expect(first).toContainText("Have everything");
    await first.click();
    await page.getByRole("button", { name: "Make this tonight" }).click();
    await expect(page.getByRole("heading", { name: "This week", level: 1, exact: true })).toBeVisible();

    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "List" }).click();
    await expect(list(page)).toBeVisible();
    const now = await names(page);
    for (const g of gone) expect(now, `${g} should have left the list`).not.toContain(g);
    // Other recipes' items and staples stay.
    expect(now).toContain("Beef chuck roast");
    expect(now).toContain("Milk");
    await expect(list(page).getByText(`for ${TONIGHT_TITLE}`)).toHaveCount(0);
  });

  test("an empty week still lists staples and low items, no recipe items", async ({ page }) => {
    await openDemoAt(page, "list", "noplan");
    await expect(box(page, "Milk")).toBeVisible();
    await expect(box(page, "Beef chuck roast")).toHaveCount(0);
  });
});
