import { describe, expect, it } from "vitest";
import type { Recipe } from "@shared/types";
import { filterRecipes, type Row } from "./filter";

const now = 10 * 86_400_000;
const row = (id: string, missing: number, extra: Partial<Recipe> = {}): Row => ({ missing, recipe: { id, source: "nyt", title: id, ingredients: ["x"], addedAt: 0, updatedAt: 0, ...extra } });
const rows = [
  row("Pasta", 0, { totalMinutes: 20, tags: ["dinner"] }),
  row("Soup", 2, { totalMinutes: 60, tags: ["soups"], makesLeftovers: true }),
  row("Cake", 5, { tags: ["dessert"], addedAt: now - 86_400_000 }),
  row("Gone", 0, { archived: true }),
];
const ids = (r: Row[]) => r.map(x => x.recipe.id);

describe("filterRecipes", () => {
  it("hides archived unless asked", () => {
    expect(ids(filterRecipes(rows, "", null, now))).not.toContain("Gone");
    expect(ids(filterRecipes(rows, "", "archived", now))).toEqual(["Gone"]);
  });
  it("filters", () => {
    expect(ids(filterRecipes(rows, "", "can-make", now))).toEqual(["Pasta"]);
    expect(ids(filterRecipes(rows, "", "need-2", now))).toEqual(["Pasta", "Soup"]);
    expect(ids(filterRecipes(rows, "", "quick", now))).toEqual(["Pasta"]);
    expect(ids(filterRecipes(rows, "", "new", now))).toEqual(["Cake"]);
    expect(ids(filterRecipes(rows, "", "leftovers", now))).toEqual(["Soup"]);
    expect(ids(filterRecipes(rows, "", "dinner", now))).toEqual(["Pasta"]);
  });
  it("searches title, tags and ingredients, accent-insensitive", () => {
    expect(ids(filterRecipes(rows, "SOUPS", null, now))).toEqual(["Soup"]);
    expect(ids(filterRecipes([row("Crème brûlée", 0)], "creme", null, now))).toEqual(["Crème brûlée"]);
  });
});
