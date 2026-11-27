import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { openDemoAt, TONIGHT_TITLE } from "./helpers";

// The clock is pinned to Wednesday 25 Nov 2026, so tonight is the seeded Sheet-Pan Lemon Chicken (45 min).
const PLANNED_MIN = 45;
const swapBar = (page: Page) => page.getByRole("region", { name: "Swap options" });
const swapCards = (page: Page) => swapBar(page).getByRole("button").filter({ has: page.getByRole("heading", { level: 4 }) });
const minutesOf = async (card: ReturnType<typeof swapCards>) =>
  Promise.all((await card.all()).map(async c => Number(((await c.innerText()).match(/(\d+) min\n/) ?? [])[1])));

test.describe("This week", () => {
  test("shows tonight's dinner and the whole week", async ({ page }) => {
    await openDemoAt(page, "home");
    await expect(page.getByRole("heading", { name: "This week", level: 1, exact: true })).toBeVisible();
    await expect(page.getByText("7 of 7 dinners")).toBeVisible();
    const hero = page.getByRole("article").filter({ hasText: /Tonight/ });
    await expect(hero.getByRole("heading", { name: TONIGHT_TITLE })).toBeVisible();
    await expect(hero.getByRole("button", { name: "Cook this" })).toBeVisible();
    await expect(hero.getByRole("button", { name: "Swap" })).toBeVisible();
    // The week list: tonight, then the rest of the week with the night out.
    const week = page.getByRole("list").filter({ has: page.getByRole("button", { name: /dinner:/ }) });
    await expect(week.getByRole("button", { name: `Today dinner: ${TONIGHT_TITLE}` })).toBeVisible();
    await expect(week.getByRole("button", { name: "Tomorrow dinner: Beef Tacos with Crunchy Slaw" })).toBeVisible();
    await expect(week.getByRole("button", { name: "Saturday dinner: Pizza night out" })).toBeVisible();
    await expect(week.getByRole("button", { name: /^Sunday dinner: Sunday Pot Roast/ })).toBeVisible();
    // Leftover lunches are in the week too.
    await expect(week.getByText(/leftovers from Thursday/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "List" }).or(page.getByRole("button", { name: /ingredients to buy/ }))).toBeVisible();
  });

  test("Earlier this week holds the days that have passed", async ({ page }) => {
    await openDemoAt(page, "home");
    const earlier = page.getByText("Earlier this week");
    await earlier.click();
    await expect(page.getByText("Monday", { exact: false }).first()).toBeAttached();
    await expect(page.getByText("Paprika Chicken Thighs with Rice").first()).toBeVisible();
  });
});

test.describe("swap alternatives", () => {
  test("tonight shows what you can make now, each ready or one short", async ({ page }) => {
    await openDemoAt(page, "home");
    await expect(swapBar(page).getByRole("heading", { name: "Or make instead, with what you have" })).toBeVisible();
    const cards = swapCards(page);
    expect(await cards.count()).toBeGreaterThan(2);
    for (const c of await cards.all()) await expect(c).toContainText(/Have everything|Need 1$/m);
    await expect(swapBar(page).getByText(TONIGHT_TITLE)).toHaveCount(0);
  });

  test("Quicker only lists recipes at least 10 minutes faster than the planned one", async ({ page }) => {
    await openDemoAt(page, "home");
    const all = await swapCards(page).count();
    await swapBar(page).getByRole("button", { name: "Quicker", exact: true }).click();
    await expect(swapBar(page).getByRole("button", { name: "Quicker" })).toHaveAttribute("aria-pressed", "true");
    const cards = swapCards(page);
    await expect(cards.first()).toBeVisible();
    const mins = await minutesOf(cards);
    expect(mins.length).toBeGreaterThan(0);
    expect(mins.length).toBeLessThan(all);
    for (const m of mins) expect(m, "quicker option").toBeLessThanOrEqual(PLANNED_MIN - 10);
    await expect(cards.first()).toContainText("min faster");
  });

  test("Under 30 min only lists quick recipes", async ({ page }) => {
    await openDemoAt(page, "home");
    await swapBar(page).getByRole("button", { name: "Under 30 min" }).click();
    const mins = await minutesOf(swapCards(page));
    expect(mins.length).toBeGreaterThan(0);
    for (const m of mins) expect(m).toBeLessThanOrEqual(30);
  });

  test("the Quicker filter is not offered when tonight's dinner is already quick", async ({ page }) => {
    await openDemoAt(page, "home");
    await swapBar(page).getByRole("button", { name: "Under 30 min" }).click();
    const quick = swapCards(page).first();
    const title = (await quick.getByRole("heading").innerText()).trim();
    await quick.click();
    await page.getByRole("button", { name: /^Make this tonight/ }).click();
    await expect(page.getByRole("article").filter({ hasText: /Tonight/ }).getByRole("heading", { name: title })).toBeVisible();
    await expect(swapBar(page).getByRole("button", { name: "Quicker", exact: true })).toHaveCount(0);
    await expect(swapBar(page).getByRole("button", { name: "Under 30 min" })).toBeVisible();
  });

  test("choosing a swap replaces tonight's dinner, and Undo restores it", async ({ page }) => {
    await openDemoAt(page, "home");
    const first = swapCards(page).first();
    const title = (await first.getByRole("heading").innerText()).trim();
    await first.click();
    // Recipe preview: header says it's a swap and the action names the night.
    await expect(page.getByText("Swap for tonight")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await page.getByRole("button", { name: "Make this tonight" }).click();

    await expect(page).toHaveURL(/#home$/);
    const hero = page.getByRole("article").filter({ hasText: /Tonight/ });
    await expect(hero.getByRole("heading", { name: title })).toBeVisible();
    await expect(hero.getByRole("heading", { name: TONIGHT_TITLE })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Today dinner: ${title}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Today dinner: ${TONIGHT_TITLE}` })).toHaveCount(0);

    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(hero.getByRole("heading", { name: TONIGHT_TITLE })).toBeVisible();
  });

  test("tapping a planned meal opens the meal sheet with swaps pinned on top", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Tomorrow dinner: Beef Tacos with Crunchy Slaw" }).click();
    const sheet = page.getByRole("dialog", { name: /Beef Tacos with Crunchy Slaw/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Want something else Thursday?" })).toBeVisible();
    const cards = sheet.getByRole("region", { name: "Swap options" }).getByRole("button").filter({ has: page.getByRole("heading", { level: 4 }) });
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(sheet.getByText(/You have \d+ of \d+ ingredients/)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Open recipe", exact: true }).last()).toBeVisible();

    // Quicker is relative to Thursday's 30 minute tacos: nothing is 10 minutes faster than 30 min except <= 20.
    await sheet.getByRole("button", { name: "Quicker", exact: true }).click();
    for (const c of await cards.all()) expect(Number(((await c.innerText()).match(/(\d+) min\n/) ?? [])[1])).toBeLessThanOrEqual(20);

    // Swap tomorrow's dinner from the sheet.
    await sheet.getByRole("button", { name: "All", exact: true }).click();
    const title = (await cards.first().getByRole("heading").innerText()).trim();
    await cards.first().click();
    await expect(page.getByText("Swap for tomorrow")).toBeVisible();
    await page.getByRole("button", { name: "Make this tomorrow" }).click();
    await expect(page.getByRole("button", { name: `Tomorrow dinner: ${title}` })).toBeVisible();
    await expect(page.getByRole("button", { name: /dinner: Beef Tacos/ })).toHaveCount(0);
  });

  test("a swap recipe lists its ingredients with in-stock marks", async ({ page }) => {
    await openDemoAt(page, "home");
    const first = swapCards(page).first();
    await first.click();
    const ingredients = page.getByRole("heading", { name: "Ingredients" });
    await expect(ingredients).toBeVisible();
    const items = page.locator("li.ck-ingredient");
    expect(await items.count()).toBeGreaterThan(3);
    await expect(items.filter({ hasText: "In stock" }).first()).toBeVisible();
    await expect(page.getByText(/You have \d+ of \d+/)).toBeVisible();
    // A "ready" swap has nothing marked Need.
    if (/Have everything/.test(await page.locator(".ck-pl-recipe__meta").innerText())) {
      await expect(items.filter({ hasText: /Need$/ })).toHaveCount(0);
    }
  });
});

test.describe("planning into an empty week", () => {
  test("plan a dinner for a day, then clear it", async ({ page }) => {
    await openDemoAt(page, "home", "noplan");
    await expect(page.getByText("0 of 7 dinners")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nothing planned yet" })).toBeVisible();
    await expect(swapBar(page).getByRole("heading", { name: "Ready to make tonight" })).toBeVisible();

    // Thursday has an "Add dinner" slot.
    await page.getByRole("listitem").filter({ hasText: "THU" }).getByRole("button", { name: "Add dinner" }).click();
    await expect(page.getByRole("heading", { name: "Plan this week", level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: /THU/i })).toHaveAttribute("aria-selected", "true");
    await page.getByLabel("Search recipes").fill("Quesadillas");
    await page.getByRole("button", { name: "Add to Thursday dinner" }).click();
    await expect(page.getByText("Black Bean and Cheese Quesadillas added to Thursday.")).toBeVisible();
    // Planning jumps on to the next open night; go back to Thursday to see it.
    await expect(page.getByRole("tab", { name: /FRI/i })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: /THU/i }).click();
    await expect(page.getByText(/Thursday dinner:/).locator("..")).toContainText("Black Bean and Cheese Quesadillas");

    // Clear it from the planner.
    await page.getByRole("button", { name: "Clear Thursday dinner" }).click();
    await expect(page.getByText("Cleared.")).toBeVisible();
    await expect(page.getByText(/Pick dinner for Thursday/)).toBeVisible();

    // Add again, finish, see it on the week, remove it from the meal sheet.
    await page.getByRole("button", { name: "Add to Thursday dinner" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name: "This week", level: 1, exact: true })).toBeVisible();
    await expect(page.getByText("1 of 7 dinners")).toBeVisible();
    await page.getByRole("button", { name: /(Tomorrow|Thursday) dinner: Black Bean and Cheese Quesadillas/ }).click();
    await page.getByRole("menuitem", { name: "Remove from plan" }).click();
    await expect(page.getByText("0 of 7 dinners")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "THU" }).getByRole("button", { name: "Add dinner" })).toBeVisible();
  });

  test("a recipe can be picked from the planner and added from its page", async ({ page }) => {
    await openDemoAt(page, "home", "noplan");
    await page.getByRole("button", { name: "Pick tonight's dinner" }).click();
    await page.getByRole("button", { name: /^Garlic Butter Spaghetti with Peas/ }).click();
    await expect(page.getByText("Pick for tonight")).toBeVisible();
    await page.getByRole("button", { name: "Add to tonight" }).click();
    await expect(page.getByText("Garlic Butter Spaghetti with Peas added to").or(page.getByText("Added to tonight."))).toBeVisible();
  });

  test("swap bar on an empty tonight offers ready dinners and adds one", async ({ page }) => {
    await openDemoAt(page, "home", "noplan");
    const first = swapCards(page).first();
    const title = (await first.getByRole("heading").innerText()).trim();
    await first.click();
    await expect(page.getByText("Pick for tonight")).toBeVisible();
    await page.getByRole("button", { name: "Add to tonight" }).click();
    await expect(page).toHaveURL(/#home$/);
    await expect(page.getByRole("article").filter({ hasText: /Tonight/ }).getByRole("heading", { name: title })).toBeVisible();
  });
});

test.describe("next week", () => {
  test("the chevrons and 'Look ahead' move to next week and back", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Next week", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Next week", level: 1, exact: true })).toBeVisible();
    await expect(page.getByText("Nov 30 – Dec 6")).toBeVisible();
    await expect(page.getByText("0 of 7 dinners")).toBeVisible();
    // No "tonight" hero on another week.
    await expect(page.getByRole("button", { name: "Cook this" })).toHaveCount(0);
    await page.getByRole("button", { name: "Previous week", exact: true }).click();
    await expect(page.getByRole("heading", { name: "This week", level: 1, exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Look ahead to next week" }).click();
    await expect(page.getByRole("heading", { name: "Next week", level: 1, exact: true })).toBeVisible();
  });

  test("plan next week's first dinner and see it counted", async ({ page }) => {
    await openDemoAt(page, "home");
    await page.getByRole("button", { name: "Look ahead to next week" }).click();
    await page.getByRole("button", { name: "Plan next week" }).click();
    await expect(page.getByRole("heading", { name: "Plan next week", level: 1 })).toBeVisible();
    await page.getByLabel("Search recipes").fill("Quesadillas");
    await page.getByRole("button", { name: /^Add to Monday dinner/ }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name: "Next week", level: 1, exact: true })).toBeVisible();
    await expect(page.getByText("1 of 7 dinners")).toBeVisible();
    await expect(page.getByRole("button", { name: "Monday dinner: Black Bean and Cheese Quesadillas" })).toBeVisible();
  });
});
