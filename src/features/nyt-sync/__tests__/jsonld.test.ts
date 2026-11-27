import { describe, expect, it } from "vitest";
import { cleanText, isoMinutes, nytIdFromUrl, recipeFromHtml, recipeFromLdTexts, servingsFromYield, findRecipeNode } from "../core/jsonld";
import { panzanella, pageHtml } from "./fixtures/pages";

describe("jsonld helpers", () => {
  it("decodes entities and strips tags", () => {
    expect(cleanText("Mac &amp; Cheese &#39;n&#x27; <b>more</b>&nbsp;")).toBe("Mac & Cheese 'n' more");
    expect(cleanText("&amp;frac12; cup")).toBe("½ cup"); // double-encoded
    expect(cleanText(undefined)).toBe("");
  });
  it("parses ISO 8601 durations", () => {
    expect(isoMinutes("PT1H30M")).toBe(90);
    expect(isoMinutes("PT45M")).toBe(45);
    expect(isoMinutes("P0DT2H")).toBe(120);
    expect(isoMinutes("P1DT1H")).toBe(1500);
    expect(isoMinutes("PT0S")).toBeUndefined();
    expect(isoMinutes("")).toBeUndefined();
    expect(isoMinutes("45 minutes")).toBeUndefined();
  });
  it("reads NYT ids from URLs", () => {
    expect(nytIdFromUrl("https://cooking.nytimes.com/recipes/1017518-panzanella?action=click")).toBe("1017518");
    expect(nytIdFromUrl("/recipes/42-x")).toBe("42");
    expect(nytIdFromUrl("https://cooking.nytimes.com/guides/1-how-to")).toBeUndefined();
  });
  it("gets servings from yields", () => {
    expect(servingsFromYield("4 to 6 servings")).toBe(6);
    expect(servingsFromYield("4")).toBe(4);
    expect(servingsFromYield("About 2 dozen cookies")).toBeUndefined();
    expect(servingsFromYield("Serves 8")).toBe(8);
  });
  it("finds the Recipe in @graph and type arrays", () => {
    expect(findRecipeNode({ "@graph": [{ "@type": "WebPage" }, { "@type": ["Recipe", "Thing"], name: "x" }] })?.name).toBe("x");
    expect(findRecipeNode([{ "@type": "Organization" }])).toBeUndefined();
  });
});

describe("recipeFromHtml", () => {
  it("maps an NYT recipe page to an import record", () => {
    const r = recipeFromHtml(pageHtml(panzanella), "https://cooking.nytimes.com/recipes/1017518-panzanella-with-mozzarella-and-herbs?smid=x")!;
    expect(r).toMatchObject({
      id: "nyt-1017518",
      title: "Panzanella with Mozzarella & Herbs",
      url: "https://cooking.nytimes.com/recipes/1017518-panzanella-with-mozzarella-and-herbs",
      ingredients: ["1 pound ripe tomatoes", "½ cup extra-virgin olive oil", "4 cups day-old bread, torn", "Kosher salt"],
      steps: ["Heat oven to 400 degrees.", "Toss everything together & serve."],
      totalMinutes: 75,
      yield: "4 to 6 servings",
      servings: 6,
      imageUrl: "https://static01.nyt.com/images/large.jpg",
    });
    expect(r.tags).toEqual(["dinner", "lunch", "salads", "italian", "bread", "tomatoes", "summer"]);
  });
  it("falls back to prep + cook time and string instructions", () => {
    const r = recipeFromLdTexts([JSON.stringify({ "@type": "Recipe", name: "Soup", prepTime: "PT10M", cookTime: "PT20M", recipeIngredient: ["1 onion"], recipeInstructions: "Chop.\nSimmer.", image: "https://x.test/a.jpg", recipeYield: "4" })], "https://cooking.nytimes.com/recipes/9-soup")!;
    expect(r.totalMinutes).toBe(30);
    expect(r.steps).toEqual(["Chop.", "Simmer."]);
    expect(r.yield).toBe("4 servings");
    expect(r.imageUrl).toBe("https://x.test/a.jpg");
  });
  it("returns undefined for pages without a usable recipe", () => {
    expect(recipeFromHtml("<html>Subscribe to read</html>", "https://cooking.nytimes.com/recipes/1")).toBeUndefined();
    expect(recipeFromLdTexts(["{not json", JSON.stringify({ "@type": "Recipe", name: "x", recipeIngredient: [] })], "https://cooking.nytimes.com/recipes/1")).toBeUndefined();
  });
});
