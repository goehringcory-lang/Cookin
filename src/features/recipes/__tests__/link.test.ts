import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findUrl, ingredientLines, isGiftLink, pageHints, readRecipePage, recipeFromText, savedUrl, webRecipeId } from "../../nyt-sync/core/link";
import { mergeImport } from "../../nyt-sync/core/merge";
import type { Recipe } from "@shared/types";

// A real NYT Cooking page (JSON-LD and og tags only), fetched 2026-11-27 without a subscription.
const NYT = readFileSync(new URL("./fixtures/nyt-panzanella.html", import.meta.url), "utf8");
const GIFT = "https://cooking.nytimes.com/recipes/1017518-panzanella?unlocked_article_code=1.abc-XYZ&smid=share-url";

describe("recipe links", () => {
  it("finds the link inside shared text", () => {
    expect(findUrl("Panzanella from NYT Cooking https://nyti.ms/3xYz.")).toBe("https://nyti.ms/3xYz");
    expect(findUrl(`  ${GIFT}  `)).toBe(GIFT);
    expect(findUrl("no link here")).toBeUndefined();
  });

  it("keeps the gift code on the saved URL and drops tracking", () => {
    expect(isGiftLink(GIFT)).toBe(true);
    expect(savedUrl(GIFT)).toBe("https://cooking.nytimes.com/recipes/1017518-panzanella?unlocked_article_code=1.abc-XYZ");
    expect(savedUrl("https://cooking.nytimes.com/recipes/1017518-panzanella?smid=x#y")).toBe("https://cooking.nytimes.com/recipes/1017518-panzanella");
  });

  it("reads every ingredient, steps, time and photo from an NYT gift link page", () => {
    const r = readRecipePage(NYT, GIFT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe("nyt");
    expect(r.recipe.id).toBe("nyt-1017518");
    expect(r.recipe.title).toBe("Panzanella");
    expect(r.recipe.ingredients).toHaveLength(16);
    expect(r.recipe.ingredients[0]).toMatch(/^4 ounces ciabatta/);
    expect(r.recipe.steps!.length).toBeGreaterThan(2);
    expect(r.recipe.imageUrl).toMatch(/^https:\/\//);
    expect(r.recipe.url).toContain("unlocked_article_code=");
  });

  it("reads recipes from other sites under a my- id", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Recipe","name":"Dal","recipeIngredient":["1 cup red lentils","1 onion"],"totalTime":"PT35M","recipeYield":"4"}]}</script>`;
    const r = readRecipePage(html, "https://www.example.com/dal/");
    expect(r.ok && r.recipe).toMatchObject({ id: webRecipeId("https://example.com/dal"), title: "Dal", totalMinutes: 35, servings: 4, url: "https://www.example.com/dal/" });
    expect(r.ok && r.source).toBe("manual");
  });

  it("falls back to page hints when there is no recipe data", () => {
    const html = `<meta property="og:title" content="Panzanella Recipe • 5★"><meta property="og:image" content="https://static01.nyt.com/x.jpg">`;
    expect(readRecipePage(html, GIFT)).toEqual({ ok: false, reason: "no_recipe", title: "Panzanella", imageUrl: "https://static01.nyt.com/x.jpg" });
    expect(pageHints("<title>Pasta Recipe - NYT Cooking</title>").title).toBe("Pasta");
  });
});

describe("pasted ingredients fallback", () => {
  it("splits lines and drops bullets and headings", () => {
    expect(ingredientLines("Ingredients\n• 2 pounds tomatoes\n\n- 1 onion\nFor the dressing:\n▢ 2 tablespoons vinegar\nYield: 4 servings")).toEqual(["2 pounds tomatoes", "1 onion", "2 tablespoons vinegar"]);
  });

  it("builds a recipe, using the NYT id when a link is given", () => {
    const r = recipeFromText({ title: "Panzanella", ingredients: "2 pounds tomatoes\n1 onion", minutes: "30", servings: "4", url: GIFT });
    expect(r).toMatchObject({ id: "nyt-1017518", title: "Panzanella", ingredients: ["2 pounds tomatoes", "1 onion"], totalMinutes: 30, servings: 4 });
    expect(recipeFromText({ title: "", ingredients: "x" })).toBeUndefined();
    expect(recipeFromText({ title: "Toast", ingredients: "" })).toBeUndefined();
    expect(recipeFromText({ title: "Toast", ingredients: "bread" })!.id).toMatch(/^my-/);
  });
});

describe("old Recipe Box sync respects the library", () => {
  const base = { source: "nyt" as const, ingredients: ["1 egg"], addedAt: 1, updatedAt: 1 };
  it("never archives link-added recipes and never revives removed ones", () => {
    const existing: Record<string, Recipe> = {
      "nyt-1": { ...base, id: "nyt-1", title: "Linked", addedVia: "link" },
      "nyt-2": { ...base, id: "nyt-2", title: "Removed", archived: true, removed: true },
    };
    const m = mergeImport(existing, { via: "button", complete: true, boxIds: ["nyt-2"], recipes: [{ id: "nyt-2", title: "Removed", ingredients: ["1 egg"] }] });
    expect(m.writes).toEqual([]);
    expect(m.archived).toBe(0);
  });
});
