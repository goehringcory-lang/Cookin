import { describe, expect, it } from 'vitest';
import {
  analyzeRecipe, makeableRecipes, missingFor, missingForRecipe, missingForRecipes, makeHas,
  setCustomItems, parseIngredientLine,
} from '../src';

const pasta = {
  id: 'pasta-aglio',
  ingredients: [
    'Kosher salt',
    '1 pound spaghetti',
    '½ cup extra-virgin olive oil',
    '6 garlic cloves, thinly sliced',
    '½ teaspoon red-pepper flakes, or to taste',
    '¼ cup chopped fresh parsley, for serving',
    'Freshly grated Parmesan, for serving (optional)',
  ],
};

describe('analyzeRecipe', () => {
  it('sorts lines into have, missing and optional', () => {
    const a = analyzeRecipe(pasta, new Set(['spaghetti', 'extra-virgin-olive-oil']));
    expect(a.missingIds).toEqual(['garlic']);
    expect(a.canMake).toBe(false);
    expect(a.optionalMissing.flatMap((s) => s.missing).sort()).toEqual(['parmesan', 'parsley', 'red-pepper-flakes']);
    expect(a.have.map((s) => s.line.raw)).toEqual(['1 pound spaghetti', '½ cup extra-virgin olive oil']);
    expect(a.coverage).toBeCloseTo(2 / 3, 2);
  });

  it('can make it once garlic is owned; garnishes never block', () => {
    const a = analyzeRecipe(pasta, ['spaghetti', 'extra-virgin-olive-oil', 'garlic']);
    expect(a.canMake).toBe(true);
    expect(a.coverage).toBe(1);
  });

  it('accepts a predicate for owned', () => {
    expect(analyzeRecipe(pasta, () => true).canMake).toBe(true);
  });

  it('lets a specific item cover a generic recipe term', () => {
    const r = { id: 'r', ingredients: ['1 pound short pasta, such as penne', '2 tablespoons neutral oil'] };
    expect(analyzeRecipe(r, ['penne', 'canola-oil']).canMake).toBe(true);
    expect(missingForRecipe(r, ['spaghetti'])).toEqual(['short-pasta', 'neutral-oil']);
  });

  it('accepts either alternative of an "or" line', () => {
    const r = { id: 'r', ingredients: ['4 cups chicken or vegetable stock'] };
    expect(analyzeRecipe(r, ['vegetable-broth']).canMake).toBe(true);
    expect(missingForRecipe(r, [])).toEqual(['chicken-broth']);
  });

  it('reports unmatched lines as unknown without blocking', () => {
    const r = { id: 'r', ingredients: ['1 teaspoon unobtainium dust', '1 pound spaghetti'] };
    const a = analyzeRecipe(r, ['spaghetti']);
    expect(a.unknown.map((l) => l.raw)).toEqual(['1 teaspoon unobtainium dust']);
    expect(a.canMake).toBe(true);
  });
});

describe('missingFor', () => {
  it('works on plain ids and understands generics and assumed items', () => {
    expect(missingFor(['sandwich-bread', 'peanut-butter', 'jelly', 'salt', 'pasta'], ['peanut-butter', 'rotini'])).toEqual([
      'sandwich-bread', 'jelly',
    ]);
  });

  it('makeHas covers satisfies transitively', () => {
    const has = makeHas(['rigatoni']);
    expect(has('rigatoni')).toBe(true);
    expect(has('short-pasta')).toBe(true);
    expect(has('pasta')).toBe(true);
    expect(has('long-pasta')).toBe(false);
  });
});

describe('makeableRecipes and missingForRecipes', () => {
  const tacos = { id: 'tacos', ingredients: ['1 pound ground beef', '8 corn tortillas', '1 cup salsa', 'Kosher salt'] };
  const eggs = { id: 'eggs', ingredients: ['4 large eggs', '1 tablespoon butter', 'Salt and pepper'] };
  const owned = ['eggs', 'butter', 'black-pepper', 'corn-tortillas', 'salsa'];

  it('ranks fully makeable first and respects maxMissing', () => {
    expect(makeableRecipes([tacos, pasta, eggs], owned).map((a) => a.recipeId)).toEqual(['eggs']);
    expect(makeableRecipes([tacos, pasta, eggs], owned, { maxMissing: 1 }).map((a) => a.recipeId)).toEqual(['eggs', 'tacos']);
  });

  it('aggregates what to buy across a week', () => {
    const needs = missingForRecipes([tacos, pasta, eggs], owned);
    expect(needs.map((n) => n.itemId)).toEqual(['ground-beef', 'spaghetti', 'extra-virgin-olive-oil', 'garlic']);
    expect(needs[0]).toMatchObject({ recipeIds: ['tacos'], lines: ['1 pound ground beef'] });
  });
});

describe('custom items', () => {
  it('joins the matcher when registered', () => {
    expect(parseIngredientLine('2 tablespoons unobtainium dust').unmatched).toBe(true);
    setCustomItems([{ id: 'c-unobtainium', name: 'Unobtainium dust', category: 'spices', location: 'pantry', common: false, aliases: [] }]);
    expect(parseIngredientLine('2 tablespoons unobtainium dust').groups).toEqual([['c-unobtainium']]);
    setCustomItems([]);
    expect(parseIngredientLine('2 tablespoons unobtainium dust').unmatched).toBe(true);
  });
});
