/** Recipe pages shaped like NYT Cooking's (schema.org JSON-LD), for tests. */
export const ld = (o: object) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;

export const panzanella = {
  "@context": "http://schema.org",
  "@type": "Recipe",
  name: "Panzanella with Mozzarella &amp; Herbs",
  url: "https://cooking.nytimes.com/recipes/1017518-panzanella-with-mozzarella-and-herbs",
  image: [
    { "@type": "ImageObject", url: "https://static01.nyt.com/images/small.jpg", width: 300, height: 200 },
    { "@type": "ImageObject", url: "https://static01.nyt.com/images/large.jpg", width: 1200, height: 800 },
  ],
  recipeYield: ["4", "4 to 6 servings"],
  totalTime: "PT1H15M",
  recipeCategory: "dinner, lunch, salads",
  recipeCuisine: "italian",
  keywords: "bread, tomatoes, summer",
  recipeIngredient: ["1 pound ripe tomatoes", "&frac12; cup extra-virgin olive oil", "4 cups day-old bread, torn", "Kosher salt"],
  recipeInstructions: [
    { "@type": "HowToSection", name: "For the bread", itemListElement: [{ "@type": "HowToStep", text: "Heat oven to 400 degrees." }] },
    { "@type": "HowToStep", text: "Toss everything together &amp; serve.<br/>" },
  ],
};

export const pageHtml = (o: object, extra = "") => `<!doctype html><html><head>
<script type="application/ld+json">{"@context":"http://schema.org","@type":"Organization","name":"NYT"}</script>
${ld(o)}${extra}</head><body><main><h1>Recipe</h1></main></body></html>`;
