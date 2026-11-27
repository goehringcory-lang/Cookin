import { describe, expect, it } from "vitest";
import {
  CATALOG, analyzeRecipe, matchLine, cleanIngredientName, catalogGroups, makeableRecipes, getItem, setCustomItems,
  searchCatalog, allItems,
} from "..";

describe("catalog", () => {
  it("has unique ids and only selectable items", () => {
    const ids = CATALOG.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CATALOG.some(i => i.assumed)).toBe(false);
  });
  it("uses section headings for category", () => {
    expect(getItem("rigatoni")?.category).toBe("Pasta & noodles");
    expect(getItem("rigatoni")?.location).toBe("pantry");
  });
  it("matches common NYT lines to catalog ids", () => {
    expect(matchLine("1 pound short pasta, such as rigatoni")).toEqual(["short-pasta"]);
    expect(matchLine("4 tablespoons unsalted butter")).toEqual(["butter"]);
    expect(matchLine("1 cup buttermilk")).toEqual(["buttermilk"]);
    expect(matchLine("2 tablespoons peanut butter")).toEqual(["peanut-butter"]);
    expect(matchLine("Kosher salt and freshly ground black pepper").sort()).toEqual(["black-pepper", "salt"]);
    expect(matchLine("1 red bell pepper, sliced")).toEqual(["bell-peppers"]);
    expect(matchLine("2 cups low-sodium chicken broth")).toEqual(["chicken-broth"]);
    expect(matchLine("1 jalapeño, seeded")).toEqual(["jalapenos"]);
    expect(matchLine("4 cloves garlic, thinly sliced")).toEqual(["garlic"]);
  });
  it("analyzes a recipe against owned items", () => {
    const r = analyzeRecipe({ ingredients: ["1 pound spaghetti", "6 garlic cloves", "Salt", "Water", "1 teaspoon unobtainium", "Parsley, for serving"] }, new Set(["spaghetti"]));
    expect(r.have).toEqual(["spaghetti"]);
    expect(r.missing).toEqual(["garlic"]);
    expect(r.optionalMissing).toEqual(["parsley"]);
    expect(r.unknown).toEqual(["1 teaspoon unobtainium"]);
    expect(r.lines.map(l => l.status)).toEqual(["have", "missing", "ignored", "ignored", "unknown", "optional"]);
    expect(r.canMake).toBe(false);
  });
  it("generic recipe terms are covered by specific owned items", () => {
    const r = analyzeRecipe({ ingredients: ["1 pound short pasta", "2 tablespoons neutral oil"] }, ["penne", "canola-oil"]);
    expect(r.canMake).toBe(true);
    expect(r.lines[0]!.ids).toEqual(["short-pasta"]);
  });
  it("ranks makeable recipes", () => {
    const a = { id: "a", ingredients: ["1 pound spaghetti", "3 garlic cloves"] };
    const b = { id: "b", ingredients: ["1 pound spaghetti"] };
    expect(makeableRecipes([a, b], ["spaghetti"], { maxMissing: 1 }).map(x => x.recipe.id)).toEqual(["b", "a"]);
  });
  it("groups for onboarding and includes custom items", () => {
    expect(catalogGroups("pantry")[0]!.category).toBe("Flours & baking");
    setCustomItems([{ id: "c-sumac-blend", name: "Sumac blend", location: "pantry", category: "Spices & dried herbs", aliases: [], custom: true }]);
    expect(matchLine("1 teaspoon sumac blend")).toEqual(["c-sumac-blend"]);
    expect(catalogGroups("pantry").at(-1)).toMatchObject({ category: "Added by you" });
    expect(allItems().some(i => i.id === "c-sumac-blend")).toBe(true);
    setCustomItems([]);
  });
  it("searches", () => {
    expect(searchCatalog("orecch")[0]!.id).toBe("orecchiette");
  });
  it("cleans unmatched names", () => {
    expect(cleanIngredientName("2 tablespoons fresh tarragon, chopped")).toBe("Fresh tarragon");
  });
});
