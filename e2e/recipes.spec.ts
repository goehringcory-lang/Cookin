import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openDemoAt } from "./helpers";

const SPAGHETTI = "Garlic Butter Spaghetti with Peas";
const count = (page: Page) => page.getByText(/^\d+ recipes$|^\d+ of \d+$/);
const tiles = (page: Page) => page.getByRole("link").filter({ has: page.getByText(/\d+ (min|hr)/) });
const filter = (page: Page, name: string) => page.getByRole("group", { name: "Filter recipes" }).getByRole("button", { name, exact: true });

interface Tile { title: string; minutes: number; badge: string }
/** Reads every visible tile: title, total minutes, and the have/need badge. */
async function readTiles(page: Page): Promise<Tile[]> {
  const raw = await tiles(page).evaluateAll(els => els.map(e => (e as HTMLElement).innerText.split("\n").map(s => s.replace(/^,\s*/, "").trim()).filter(Boolean)));
  return raw.map(([title, time, badge]) => {
    const h = /(\d+) hr/.exec(time)?.[1], m = /(\d+) min/.exec(time)?.[1];
    return { title, minutes: Number(h ?? 0) * 60 + Number(m ?? 0), badge };
  });
}

test.describe("Recipes list", () => {
  test.beforeEach(async ({ page }) => {
    await openDemoAt(page, "recipes");
    await expect(page.getByRole("heading", { name: "Recipes", level: 1 })).toBeVisible();
    await expect(count(page)).toHaveText("32 recipes");
  });

  test("lists every recipe with its time and what you are missing", async ({ page }) => {
    const all = await readTiles(page);
    expect(all).toHaveLength(32);
    for (const t of all) {
      expect(t.minutes, t.title).toBeGreaterThan(0);
      expect(t.badge, t.title).toMatch(/^(Have everything|Need \d+)$/);
    }
  });

  test("Can make now shows exactly the recipes with everything in stock", async ({ page }) => {
    const all = await readTiles(page);
    const expected = all.filter(t => t.badge === "Have everything").map(t => t.title).sort();
    expect(expected.length).toBeGreaterThan(3);
    expect(expected.length).toBeLessThan(all.length);

    await filter(page, "Can make now").click();
    await expect(filter(page, "Can make now")).toHaveAttribute("aria-pressed", "true");
    await expect(count(page)).toHaveText(`${expected.length} of 32`);
    const shown = await readTiles(page);
    expect(shown.map(t => t.title).sort()).toEqual(expected);
    for (const t of shown) expect(t.badge).toBe("Have everything");

    // Tap again to clear.
    await filter(page, "Can make now").click();
    await expect(count(page)).toHaveText("32 recipes");
  });

  test("Need ≤ 2 includes everything that is ready plus the nearly ready", async ({ page }) => {
    const all = await readTiles(page);
    const expected = all.filter(t => t.badge === "Have everything" || /^Need [12]$/.test(t.badge)).map(t => t.title).sort();
    await filter(page, "Need ≤ 2").click();
    await expect(count(page)).toHaveText(`${expected.length} of 32`);
    expect((await readTiles(page)).map(t => t.title).sort()).toEqual(expected);
  });

  test("Under 30 min shows only recipes of 30 minutes or less, quickest first", async ({ page }) => {
    const all = await readTiles(page);
    const expected = all.filter(t => t.minutes <= 30).map(t => t.title).sort();
    expect(expected.length).toBeGreaterThan(3);
    expect(expected.length).toBeLessThan(all.length);

    await filter(page, "Under 30 min").click();
    await expect(count(page)).toHaveText(`${expected.length} of 32`);
    const shown = await readTiles(page);
    expect(shown.map(t => t.title).sort()).toEqual(expected);
    const mins = shown.map(t => t.minutes);
    for (const m of mins) expect(m).toBeLessThanOrEqual(30);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });

  test("filters are one at a time", async ({ page }) => {
    await filter(page, "Can make now").click();
    await filter(page, "Under 30 min").click();
    await expect(filter(page, "Under 30 min")).toHaveAttribute("aria-pressed", "true");
    await expect(filter(page, "Can make now")).toHaveAttribute("aria-pressed", "false");
  });

  test("search narrows by title and by ingredient, and combines with a filter", async ({ page }) => {
    const search = page.getByLabel("Search recipes");
    await search.fill("sunday pot roast");
    await expect(count(page)).toHaveText("1 of 32");
    await expect(tiles(page).first()).toContainText("Sunday Pot Roast with Carrots and Potatoes");

    await search.fill("chuck"); // an ingredient, not in the title
    await expect(tiles(page).first()).toContainText("Sunday Pot Roast");

    await search.fill("SPINACH"); // case-insensitive
    const hits = await readTiles(page);
    expect(hits.length).toBeGreaterThan(1);
    expect(hits.map(t => t.title)).toContain("Spinach and Mushroom Frittata");

    await filter(page, "Under 30 min").click();
    for (const t of await readTiles(page)) expect(t.minutes).toBeLessThanOrEqual(30);

    await search.fill("zzzzqx");
    await expect(page.getByText("No recipes match “zzzzqx”.")).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(count(page)).toHaveText("32 recipes");
    await expect(search).toHaveValue("");
  });

  test("tapping a recipe opens it", async ({ page }) => {
    await page.getByLabel("Search recipes").fill("Garlic Butter");
    await tiles(page).filter({ hasText: SPAGHETTI }).click();
    await expect(page).toHaveURL(/#recipe\/nyt-demo-/);
    await expect(page.getByRole("heading", { name: SPAGHETTI, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Steps" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open on NYT Cooking/ })).toHaveAttribute("href", /nytimes\.com/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Recipes", level: 1 })).toBeVisible();
  });
});

test.describe("Recipe page", () => {
  const open = async (page: Page, ...flags: string[]) => {
    await openDemoAt(page, "recipes", ...flags);
    await page.getByLabel("Search recipes").fill(SPAGHETTI);
    await tiles(page).filter({ hasText: SPAGHETTI }).click();
    await expect(page.getByRole("heading", { name: SPAGHETTI, level: 1 })).toBeVisible();
  };
  const servings = (page: Page) => page.getByRole("group", { name: "Servings" });
  const ingredient = (page: Page, word: string) => page.locator("li.ck-ingredient").filter({ hasText: word });

  test("shows ingredients with stock marks", async ({ page }) => {
    await open(page);
    await expect(page.getByText("You have 7 of 7")).toBeVisible();
    await expect(page.getByText("Have everything").first()).toBeVisible();
    await expect(ingredient(page, "spaghetti").first()).toContainText("In stock");
  });

  test("servings + and - scale the amounts", async ({ page }) => {
    await open(page); // recipe written for 4: shown as written by default
    const out = servings(page).locator("output");
    await expect(out).toHaveText("4");
    await expect(page.getByText(/scaled from/)).toHaveCount(0);
    await expect(ingredient(page, "spaghetti")).toContainText("12 ounces spaghetti");

    await servings(page).getByRole("button", { name: "Fewer servings" }).click();
    await expect(out).toHaveText("3");
    await expect(page.getByText("scaled from 4")).toBeVisible();
    await expect(ingredient(page, "spaghetti")).toContainText("9 ounces spaghetti");
    await expect(ingredient(page, "butter")).toContainText("3 tablespoons butter");

    await servings(page).getByRole("button", { name: "More servings" }).click();
    await servings(page).getByRole("button", { name: "More servings" }).click();
    await expect(out).toHaveText("5");
    await expect(ingredient(page, "spaghetti")).toContainText("15 ounces spaghetti");
    await expect(ingredient(page, "butter")).toContainText("5 tablespoons butter");

    for (let i = 0; i < 4; i++) await servings(page).getByRole("button", { name: "Fewer servings" }).click();
    await expect(out).toHaveText("1");
    await expect(servings(page).getByRole("button", { name: "Fewer servings" })).toBeDisabled();
    await expect(ingredient(page, "spaghetti")).toContainText("3 ounces spaghetti");
  });

  test("Add to plan puts it on the chosen day", async ({ page }) => {
    await open(page, "noplan");
    await page.getByRole("button", { name: "Add to plan" }).click();
    const sheet = page.getByRole("dialog", { name: "Add to plan" });
    await expect(sheet.getByRole("menuitem")).toHaveCount(14);
    await sheet.getByRole("menuitem", { name: /^Tomorrow Nov 26/ }).click();
    await expect(page.getByText("Added to Thursday.")).toBeVisible();

    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "This week" }).click();
    await expect(page.getByRole("button", { name: `Tomorrow dinner: ${SPAGHETTI}` })).toBeVisible();
    await expect(page.getByText("1 of 7 dinners")).toBeVisible();
  });

  test("Add to plan keeps the chosen servings and replaces a planned night", async ({ page }) => {
    await open(page);
    await servings(page).getByRole("button", { name: "More servings" }).click(); // 5 (written for 4)
    await page.getByRole("button", { name: "Add to plan" }).click();
    await page.getByRole("dialog", { name: "Add to plan" }).getByRole("menuitem", { name: /^Tonight Nov 25/ }).click();
    await expect(page.getByText("Added to tonight.")).toBeVisible();

    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "This week" }).click();
    const hero = page.getByRole("article").filter({ hasText: /Tonight/ });
    await expect(hero.getByRole("heading", { name: SPAGHETTI })).toBeVisible();
    await expect(hero).toContainText("serves 5");
    await expect(page.getByRole("button", { name: /dinner: Sheet-Pan Lemon Chicken/ })).toHaveCount(0);
  });

  test("Have it marks a missing ingredient as in stock", async ({ page }) => {
    await openDemoAt(page, "recipes");
    await page.getByLabel("Search recipes").fill("Sunday Pot Roast");
    await tiles(page).first().click();
    await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
    const missing = page.locator("li.ck-ingredient").filter({ has: page.getByRole("button", { name: "Have it" }) });
    await expect(missing.first()).toBeVisible();
    const before = await missing.count();
    await missing.first().getByRole("button", { name: "Have it" }).click();
    await expect(missing).toHaveCount(before - 1);
  });
});
