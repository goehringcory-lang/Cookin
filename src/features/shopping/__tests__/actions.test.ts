import { beforeEach, describe, expect, it } from "vitest";
import { store } from "@shared/store";
import { COLLECTIONS } from "@shared/types";
import { matchLine } from "@shared/catalog";

const FLOUR = matchLine("all-purpose flour")[0], BANANAS = matchLine("bananas")[0];
import { addManual, finishShopping, removeLine, toggleChecked } from "../actions";
import { buildShoppingList } from "../build";
import { shoppingWeek } from "../useShoppingList";

const WEEK = "2026-11-30";
const build = () => buildShoppingList({
  plan: [{ id: "p", date: "2026-11-30", meal: "dinner", kind: "recipe", refId: "r", updatedAt: 0 }],
  recipes: { r: { id: "r", source: "nyt", title: "Pancakes", ingredients: ["2 cups all-purpose flour", "1 teaspoon grains of paradise"], addedAt: 0, updatedAt: 0 } },
  inventory: store.all("inventory"),
  staples: [{ id: "bananas", name: "Bananas", itemId: BANANAS, kind: "staple", when: "always", active: true, updatedAt: 0 }],
  entries: Object.values(store.all("list")),
  householdSize: 3,
});
const line = (key: string) => { const l = build(); return [...l.lines, ...l.doubleCheck].find((x) => x.key === key); };

beforeEach(() => {
  store.remote = false;
  store.putMany(COLLECTIONS.flatMap((c) => Object.keys(store.all(c)).map((id) => ({ c, id, data: null }))));
});

describe("shopping actions", () => {
  it("checks off, then Done shopping restocks the kitchen and hides staples for the week", () => {
    toggleChecked(line(`item:${FLOUR}`)!, WEEK);
    toggleChecked(line(`item:${BANANAS}`)!, WEEK);
    const manualId = addManual("  Birthday   candles ", WEEK)!;
    toggleChecked(line(manualId)!, WEEK);
    expect(build().inCart).toBe(3);

    const all = build();
    const res = finishShopping([...all.lines, ...all.doubleCheck], WEEK);
    expect(res).toMatchObject({ restocked: 2, bought: 3 });
    expect(store.get("inventory", FLOUR)?.status).toBe("have");
    const after = build();
    expect(after.lines.map((l) => l.key)).toEqual([]);
    expect(after.doubleCheck.map((l) => l.key)).toEqual(["text:grain paradise"]);
    expect(store.get("list", manualId)).toBeUndefined();

    res.undo();
    expect(store.get("inventory", FLOUR)).toBeUndefined();
    expect(build().inCart).toBe(3);
  });

  it("removing a recipe need marks it in the kitchen; undo brings it back", () => {
    const undo = removeLine(line(`item:${FLOUR}`)!, WEEK);
    expect(store.get("inventory", FLOUR)?.status).toBe("have");
    expect(line(`item:${FLOUR}`)).toBeUndefined();
    undo();
    expect(line(`item:${FLOUR}`)).toBeDefined();
  });

  it("removing an unmatched line hides it for the week", () => {
    removeLine(line("text:grain paradise")!, WEEK);
    expect(line("text:grain paradise")).toBeUndefined();
  });
});

describe("shoppingWeek", () => {
  it("is this week Mon to Fri and next week on Sat and Sun", () => {
    expect(shoppingWeek("2026-11-27", 1)).toBe("2026-11-23"); // Fri
    expect(shoppingWeek("2026-11-28", 1)).toBe("2026-11-30"); // Sat
    expect(shoppingWeek("2026-11-29", 1)).toBe("2026-11-30"); // Sun
    expect(shoppingWeek("2026-11-30", 1)).toBe("2026-11-30"); // Mon
  });
});
