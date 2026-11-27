import { describe, expect, it } from "vitest";
import type { InventoryEntry, ListEntry, PlanEntry, Recipe, Staple, StockStatus } from "@shared/types";
import { buildShoppingList, yieldServings, type ListInput } from "../build";

const recipe = (id: string, title: string, ingredients: string[], extra: Partial<Recipe> = {}): Recipe =>
  ({ id, source: "nyt", title, ingredients, addedAt: 0, updatedAt: 0, ...extra });

const recipes: Record<string, Recipe> = Object.fromEntries([
  recipe("nyt-1", "Chicken pot pie", ["2 cups all-purpose flour", "1 large yellow onion, diced", "2 tablespoons olive oil", "1 1/2 pounds boneless chicken thighs", "Kosher salt", "1 teaspoon sumac"], { yield: "4 servings" }),
  recipe("nyt-2", "Chili", ["2 onions, chopped", "1 pound chicken thighs", "2 (15-ounce) cans black beans", "Water", "2 teaspoons sumac"], { yield: "Serves 2" }),
  recipe("nyt-3", "Pasta", ["1 pound spaghetti", "1/4 cup flour"]),
].map((r) => [r.id, r]));

const inv = (o: Record<string, StockStatus>): Record<string, InventoryEntry> =>
  Object.fromEntries(Object.entries(o).map(([itemId, status]) => [itemId, { itemId, status, updatedAt: 0 }]));

const plan = (date: string, meal: "dinner" | "lunch", kind: PlanEntry["kind"], refId?: string, extra: Partial<PlanEntry> = {}): PlanEntry =>
  ({ id: `${date}:${meal}`, date, meal, kind, refId, updatedAt: 0, ...extra });

const staple = (id: string, name: string, itemId?: string, extra: Partial<Staple> = {}): Staple =>
  ({ id, name, itemId, kind: "staple", when: "always", active: true, updatedAt: 0, ...extra });

const base: ListInput = {
  plan: [
    plan("2026-11-30", "dinner", "recipe", "nyt-1"),       // Mon
    plan("2026-12-01", "dinner", "recipe", "nyt-2"),       // Tue
    plan("2026-12-02", "lunch", "leftovers", "nyt-2"),
  ],
  recipes,
  inventory: inv({ "olive-oil": "have", "all-purpose-flour": "out", "spaghetti": "have", "rice": "low", "milk": "low" }),
  staples: [staple("milk", "Milk", "milk"), staple("bananas", "Bananas", "bananas"), staple("fig-bars", "Fig bars"), staple("cereal", "Cereal", "cereal", { active: false })],
  entries: [],
  householdSize: 3,
};
const byKey = (input: ListInput) => {
  const l = buildShoppingList(input);
  return { ...l, k: Object.fromEntries([...l.lines, ...l.doubleCheck].map((x) => [x.key, x])) };
};

describe("buildShoppingList", () => {
  const { k, lines, doubleCheck } = byKey(base);

  it("skips what the kitchen has, assumed items and water", () => {
    expect(k["item:olive-oil"]).toBeUndefined();
    expect(k["item:kosher-salt"]).toBeUndefined();
    expect(Object.keys(k).some((x) => x.includes("water"))).toBe(false);
  });

  it("merges the same item across recipes and adds up quantities", () => {
    // 1½ lb for the pot pie + 1 lb for Chili, which serves 2 and is scaled to 3 people.
    expect(k["item:chicken-thighs"].amount).toBe("3 lb");
    expect(k["item:chicken-thighs"].why).toBe("for Chicken pot pie · Mon, Chili · Tue");
    expect(k["item:onions"].amount).toBe("4");
    expect(k["item:black-beans"].amount).toBe("3 cans");
  });

  it("puts out-of-stock pantry items on the list when a recipe needs them", () => {
    expect(k["item:all-purpose-flour"]).toMatchObject({ name: "All-purpose flour", amount: "2 cups", itemId: "all-purpose-flour" });
  });

  it("adds running-low items and active staples, merging a low staple into one line", () => {
    expect(k["item:rice"].why).toBe("running low");
    expect(k["item:milk"].why).toBe("running low · staple");
    expect(k["item:bananas"].why).toBe("staple");
    expect(k["staple:fig-bars"].name).toBe("Fig bars");
    expect(k["item:cereal"]).toBeUndefined();
  });

  it("puts unmatched recipe lines in double-check, merged", () => {
    expect(doubleCheck.map((d) => [d.key, d.name, d.amount])).toEqual([["text:sumac", "Sumac", "1⅓ tbsp"]]);
    expect(doubleCheck[0].reasons.filter((r) => r.type === "unmatched")).toHaveLength(2);
  });

  it("ignores leftover lunches and cooked meals", () => {
    const cooked = byKey({ ...base, plan: [plan("2026-11-30", "dinner", "recipe", "nyt-1", { cooked: true })] });
    expect(cooked.k["item:chicken-thighs"]).toBeUndefined();
  });

  it("is flat and ordered: recipe needs, running low, staples, each A to Z", () => {
    expect(lines.map((l) => l.name)).toEqual([
      "All-purpose flour", "Black beans", "Chicken thighs", "Onions",
      "Milk", "Rice",
      "Bananas", "Fig bars",
    ]);
  });

  it("scales up recipes that serve fewer people than the household", () => {
    // Chili serves 2, household is 3: 1 lb chicken becomes 1½ lb; pot pie serves 4, unchanged.
    const only = byKey({ ...base, plan: [base.plan[1]] });
    expect(only.k["item:chicken-thighs"].amount).toBe("1½ lb");
    expect(only.k["item:black-beans"].amount).toBe("3 cans");
    const servings = byKey({ ...base, plan: [plan("2026-11-30", "dinner", "recipe", "nyt-1", { servings: 8 })] });
    expect(servings.k["item:all-purpose-flour"].amount).toBe("4 cups");
  });

  it("merges lunch needs from the lunches feature", () => {
    const reason = { type: "lunch" as const, ideaId: "l-grilled-cheese", name: "Grilled cheese", date: "2026-12-03" };
    const withLunch = byKey({
      ...base,
      lunchNeeds: [{ itemId: "cheddar", reasons: [reason] }, { itemId: "all-purpose-flour", reasons: [reason] }, { itemId: "olive-oil", reasons: [reason] }],
    });
    expect(withLunch.k["item:cheddar"].why).toBe("for Grilled cheese · Thu");
    expect(withLunch.k["item:all-purpose-flour"].why).toBe("for Chicken pot pie · Mon, Grilled cheese · Thu");
    expect(withLunch.k["item:olive-oil"]).toBeUndefined();
  });

  it("scales a dinner that's also eaten as leftovers", () => {
    const r = byKey({
      ...base,
      plan: [base.plan[0], plan("2026-12-01", "lunch", "leftovers", "nyt-1", { fromDate: "2026-11-30" })],
      leftoverScale: () => 1.5,
    });
    expect(r.k["item:all-purpose-flour"].amount).toBe("3 cups");
  });

  it("applies checks, dismissals and manual items from list entries", () => {
    const e = (id: string, type: ListEntry["type"], key?: string, name?: string): ListEntry => ({ id, type, key, name, weekOf: "2026-11-30", updatedAt: 1 });
    const r = byKey({
      ...base,
      entries: [
        e("check:item:onions", "check", "item:onions"),
        e("dismiss:item:bananas", "dismiss", "item:bananas"),       // staple-only: hidden
        e("dismiss:item:milk", "dismiss", "item:milk"),             // still running low: stays
        e("dismiss:text:sumac", "dismiss", "text:sumac"),
        e("manual:a", "manual", undefined, "Birthday candles"),
        e("manual:b", "manual", undefined, "2 lb chicken thighs"),  // merges into the recipe line
      ],
    });
    expect(r.k["item:onions"].checked).toBe(true);
    expect(r.lines.at(-1)!.key).toBe("item:onions");
    expect(r.k["item:bananas"]).toBeUndefined();
    expect(r.k["item:milk"].why).toBe("running low");
    expect(r.doubleCheck).toHaveLength(0);
    expect(r.k["manual:a"]).toMatchObject({ name: "Birthday candles", why: "added", manualIds: ["manual:a"] });
    expect(r.k["item:chicken-thighs"]).toMatchObject({ amount: "5 lb", manualIds: ["manual:b"] });
    expect(r.inCart).toBe(1);
  });

  it("parses recipe yields", () => {
    expect(yieldServings("4 servings")).toBe(4);
    expect(yieldServings("Serves 4 to 6")).toBe(4);
    expect(yieldServings("About 2 dozen cookies")).toBe(2);
    expect(yieldServings(undefined)).toBeUndefined();
  });
});
