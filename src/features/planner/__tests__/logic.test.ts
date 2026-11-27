import { describe, expect, it } from "vitest";
import type { Recipe } from "@shared/types";
import { formatQty, match, nextOpenDinner, parseYield, rankForPlanning, scaleLine, servingFactor, swapOptions, lineStatuses } from "../logic";
import { parseParams, parseSlot, href } from "../routes";

const r = (id: string, minutes: number, ingredients: string[], extra: Partial<Recipe> = {}): Recipe => ({
  id, source: "nyt", title: id, ingredients, totalMinutes: minutes, addedAt: 0, updatedAt: 0, ...extra,
});

const chicken = r("chicken", 50, ["2 pounds chicken thighs", "1 lemon", "3 garlic cloves", "Kosher salt"]);
const pasta = r("pasta", 20, ["1 pound spaghetti", "6 tablespoons butter", "4 garlic cloves", "1 cup grated Parmesan"]);
const tacos = r("tacos", 25, ["1 pound ground turkey", "8 flour tortillas", "1 cup shredded Cheddar"]);
const chili = r("chili", 75, ["2 pounds ground beef", "2 onions", "1 can kidney beans"]);
const friedRice = r("fried-rice", 15, ["4 cups cooked white rice", "4 eggs", "1 cup frozen peas", "2 tablespoons soy sauce"]);
const all = [chicken, pasta, tacos, chili, friedRice];

const status = {
  "chicken-thighs": "have", lemons: "low", garlic: "have",
  spaghetti: "have", butter: "have", parmesan: "have",
  "ground-turkey": "have", tortillas: "have",
  "white-rice": "have", eggs: "have", "frozen-peas": "have", "soy-sauce": "have",
} as const;

describe("matching", () => {
  it("treats running-low items as owned but flags them", () => {
    const m = match(chicken, status);
    expect(m.a.canMake).toBe(true);
    expect(m.low).toEqual(["lemons"]);
    expect(lineStatuses(m, status).map((l) => l.status)).toEqual(["have", "low", "have", "have"]);
  });
});

describe("swapOptions", () => {
  it("lists dinners in stock first, then one short, quickest first", () => {
    const ids = swapOptions(chicken, all, status).map((m) => m.recipe.id);
    expect(ids).toEqual(["fried-rice", "pasta", "tacos"]); // tacos needs cheddar
    expect(ids).not.toContain("chicken");
    expect(ids).not.toContain("chili"); // needs 3
  });
  it("quicker = at least 10 minutes faster than the planned dish", () => {
    expect(swapOptions(chicken, all, status, "quicker").map((m) => m.recipe.id)).toEqual(["fried-rice", "pasta", "tacos"]);
    expect(swapOptions(pasta, all, status, "quicker")).toEqual([]); // 15 min fried rice is only 5 faster
  });
  it("under30 caps at 30 minutes", () => {
    const ids = swapOptions(chicken, all, status, "under30").map((m) => m.recipe.id);
    expect(ids.every((id) => all.find((x) => x.id === id)!.totalMinutes! <= 30)).toBe(true);
  });
  it("skips archived recipes", () => {
    const ids = swapOptions(chicken, [...all, r("old", 10, ["4 eggs"], { archived: true })], status).map((m) => m.recipe.id);
    expect(ids).not.toContain("old");
  });
});

describe("rankForPlanning", () => {
  it("ranks by what's in stock and pushes already-planned recipes down", () => {
    const ranked = rankForPlanning(all, status, { planned: new Set(["fried-rice"]) }).map((m) => m.recipe.id);
    expect(ranked.indexOf("fried-rice")).toBeGreaterThan(ranked.indexOf("tacos"));
    expect(ranked.slice(0, 2).sort()).toEqual(["chicken", "pasta"]);
    expect(ranked.indexOf("chili")).toBeGreaterThan(ranked.indexOf("tacos"));
  });
});

describe("plan helpers", () => {
  it("finds the next open dinner", () => {
    const plan = { "2026-11-30:dinner": {} as never, "2026-12-01:dinner": {} as never };
    const dates = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03"];
    expect(nextOpenDinner(plan, dates)).toBe("2026-12-02");
    expect(nextOpenDinner(plan, dates, "2026-12-03")).toBe("2026-12-03");
  });
});

describe("servings", () => {
  it("parses yields", () => {
    expect(parseYield("4 servings")).toBe(4);
    expect(parseYield("6 to 8 servings")).toBe(6);
    expect(parseYield("Serves 2")).toBe(2);
    expect(parseYield(undefined)).toBeUndefined();
  });
  it("prefers numeric servings", () => {
    expect(servingFactor(r("x", 1, [], { servings: 6, yield: "4 servings" }), 3)).toBe(0.5);
    expect(servingFactor(r("x", 1, []), 3)).toBe(1);
  });
  it("scales leading quantities", () => {
    expect(scaleLine("1 1/2 cups rice", 2)).toBe("3 cups rice");
    expect(scaleLine("2 tablespoons butter", 0.75)).toBe("1 ½ tablespoons butter");
    expect(scaleLine("½ cup Parmesan", 2)).toBe("1 cup Parmesan");
    expect(scaleLine("2 to 3 cloves garlic", 2)).toBe("4 to 6 cloves garlic");
    expect(scaleLine("Kosher salt", 2)).toBe("Kosher salt");
    expect(scaleLine("4 eggs", 0.75)).toBe("3 eggs");
  });
  it("formats fractions", () => {
    expect(formatQty(0.333)).toBe("⅓");
    expect(formatQty(2.5)).toBe("2 ½");
    expect(formatQty(12.4)).toBe("12");
  });
});

describe("routes", () => {
  it("round-trips params", () => {
    const h = href.recipe("nyt-123", { swap: "2026-11-27:dinner" });
    expect(h).toBe("recipe/nyt-123/swap=2026-11-27:dinner");
    const { head, params } = parseParams(h.slice("recipe/".length));
    expect(head).toBe("nyt-123");
    expect(params.swap).toBe("2026-11-27:dinner");
    expect(parseSlot(params.swap)).toEqual({ date: "2026-11-27", meal: "dinner" });
    expect(href.home(undefined, "2026-11-28:lunch", "menu")).toBe("home/m=2026-11-28:lunch/x=menu");
    expect(parseSlot("garbage")).toBeUndefined();
  });
});
