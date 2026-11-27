# @cookin/ingredients

The ingredient catalog, recipe-line parser and pantry matcher behind Cookin. Pure TypeScript,
no dependencies. The app uses it through `src/shared/catalog` (`@shared/catalog`), which keeps the
app-facing names stable.

## Catalog

615 selectable items (360 pantry, 221 fridge, 34 freezer) in 30 onboarding categories, plus hidden
helpers:

- **Assumed** items (`salt`, `water`, `ice`) are always on hand. They never show as missing.
- **Generic** recipe terms (`short-pasta`, `neutral-oil`, `stock`, `chicken`, `berries`, `fresh-chile`, ...)
  are covered when you own any item whose `satisfies` lists them: penne covers "short pasta",
  canola oil covers "neutral oil".

Data lives in `src/data/` (`pantry.ts`, `cold.ts` for fridge and freezer, `basics.ts`, `categories.ts`).
**Ids are stored in the inventory, so never rename one.** Add aliases freely. An alias may belong to
only one item; `test/catalog.test.ts` enforces it.

## Parser

`parseIngredientLine("1 (15-ounce) can chickpeas, drained and rinsed")` returns quantity, range,
unit, package size, name, note, the `optional` / `toTaste` / `garnish` flags, and `groups`: catalog ids,
where each inner array lists alternatives ("chicken or vegetable stock") and every group is required.
It handles NYT formatting: unicode fractions, metric after a slash, ranges, "Juice of 1 lime",
"boneless, skinless", "3 garlic cloves" vs. ground cloves, and topping lists on "for serving" lines.

## Matcher

| Function | Use |
|---|---|
| `analyzeRecipe(recipe, owned)` | have / missing / optional-missing / unknown lines, `missingIds`, `coverage`, `canMake` |
| `missingForRecipe(recipe, owned)` | ids to buy for one recipe |
| `makeableRecipes(recipes, owned, { maxMissing })` | "what can I make now", best first |
| `missingForRecipes(recipes, owned)` | a week's plan merged into one list of needs, with the recipes and lines asking for each |
| `missingFor(ids, owned)` | plain id lists (lunch ideas) |
| `makeHas(owned)` | the predicate everything uses (assumed + generics) |

`owned` is a `Set`, an array of ids, or `(id) => boolean`. Optional, to-taste and garnish lines never
block `canMake`. Lines the catalog doesn't know are reported as `unknown` and don't block either.

Custom items: `setCustomItems(items)` adds Cory's own items to the matcher.

## Tests

`npx vitest run packages` covers the fixture lines, matching, generics, the catalog's integrity, and a
40-recipe NYT-style corpus (448 lines, all matched).
