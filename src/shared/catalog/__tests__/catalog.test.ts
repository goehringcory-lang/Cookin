import { describe, expect, it } from "vitest";
import { CATALOG, analyzeRecipe, matchLine, cleanIngredientName } from "..";

describe("catalog", () => {
  it("has unique ids", () => {
    const ids = CATALOG.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("matches common NYT lines to catalog ids", () => {
    expect(matchLine("1 pound short pasta, such as rigatoni")).toEqual(["short-pasta"]);
    expect(matchLine("4 tablespoons unsalted butter")).toEqual(["butter"]);
    expect(matchLine("1 cup buttermilk")).toEqual(["buttermilk"]);
    expect(matchLine("2 tablespoons peanut butter")).toEqual(["peanut-butter"]);
    expect(matchLine("Kosher salt and freshly ground black pepper").sort()).toEqual(["black-pepper", "kosher-salt"]);
    expect(matchLine("1 red bell pepper, sliced")).toEqual(["bell-peppers"]);
    expect(matchLine("2 cups low-sodium chicken broth")).toEqual(["chicken-broth"]);
    expect(matchLine("1 jalapeño, seeded")).toEqual(["hot-peppers"]);
  });
  it("analyzes a recipe against owned items", () => {
    const r = analyzeRecipe({ ingredients: ["1 pound spaghetti", "6 garlic cloves", "Salt", "Water", "1 teaspoon sumac"] }, new Set(["spaghetti"]));
    expect(r.have.sort()).toEqual(["kosher-salt", "spaghetti"]);
    expect(r.missing).toEqual(["garlic"]);
    expect(r.unknown).toEqual(["1 teaspoon sumac"]);
    expect(r.canMake).toBe(false);
  });
  it("cleans unmatched names", () => {
    expect(cleanIngredientName("2 tablespoons fresh tarragon, chopped")).toBe("Fresh tarragon");
  });
});
