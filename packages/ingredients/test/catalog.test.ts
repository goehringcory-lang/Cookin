import { describe, expect, it } from 'vitest';
import {
  CATALOG, CATEGORIES, SELECTABLE_ITEMS, catalogByLocation, commonItemIds, getItem, searchCatalog,
  parseIngredientLine,
} from '../src';
import { normalizePhrase } from '../src/normalize';
import recipes from './fixtures/nyt-recipes.json';

describe('catalog integrity', () => {
  it('has unique ids in kebab case', () => {
    const ids = CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('every item has a known category and matching location', () => {
    const cats = new Map(CATEGORIES.map((c) => [c.id, c]));
    for (const i of CATALOG) {
      expect(cats.get(i.category), i.id).toBeDefined();
      expect(i.location).toBe(cats.get(i.category)!.location);
    }
  });

  it('satisfies only points at real ids', () => {
    for (const i of CATALOG) for (const s of i.satisfies ?? []) expect(getItem(s), `${i.id} -> ${s}`).toBeDefined();
  });

  it('no alias is claimed by two items', () => {
    const owner = new Map<string, string>();
    const dupes: string[] = [];
    for (const i of CATALOG) {
      for (const a of new Set([...i.aliases.map(normalizePhrase)])) {
        const prev = owner.get(a);
        if (prev && prev !== i.id) dupes.push(`${a}: ${prev} / ${i.id}`);
        owner.set(a, i.id);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('is comprehensive', () => {
    expect(SELECTABLE_ITEMS.length).toBeGreaterThan(450);
    const pastas = SELECTABLE_ITEMS.filter((i) => i.category === 'pasta');
    expect(pastas.length).toBeGreaterThan(25);
  });

  it('has the ids other modules depend on', () => {
    const needed = [
      'milk', 'bananas', 'eggs', 'sandwich-bread', 'cereal', 'fig-bars', 'fruit-bars', 'granola-bars', 'fruit-snacks',
      'string-cheese', 'tortillas', 'pita', 'bagels', 'english-muffins', 'crackers', 'peanut-butter', 'jelly', 'deli-turkey',
      'deli-ham', 'sliced-cheese', 'cheddar', 'mozzarella', 'cream-cheese', 'butter', 'mayonnaise', 'mustard', 'hummus',
      'lettuce', 'tomatoes', 'cucumbers', 'baby-carrots', 'celery', 'apples', 'grapes', 'clementines', 'berries',
      'applesauce-cups', 'yogurt-cups', 'pasta', 'boxed-mac-and-cheese', 'canned-tuna', 'canned-chicken',
      'canned-black-beans', 'salsa', 'frozen-chicken-nuggets', 'frozen-pizza', 'frozen-dumplings', 'pretzels',
      'goldfish-crackers', 'ramen', 'instant-rice', 'soy-sauce', 'canned-soup', 'pizza-sauce', 'pepperoni', 'hot-dogs',
      'rotisserie-chicken', 'ranch', 'honey', 'rotini', 'farfalle', 'orecchiette', 'fusilli',
    ];
    expect(needed.filter((id) => !getItem(id))).toEqual([]);
  });
});

describe('onboarding helpers', () => {
  it('groups by location in walkthrough order and hides assumed/generic items', () => {
    const pantry = catalogByLocation('pantry');
    expect(pantry[0]!.id).toBe('baking');
    const all = pantry.flatMap((c) => c.items);
    expect(all.some((i) => i.assumed || i.generic)).toBe(false);
    expect(catalogByLocation('freezer').every((c) => c.location === 'freezer')).toBe(true);
  });

  it('common ids are a sensible subset', () => {
    const common = commonItemIds();
    expect(common).toContain('all-purpose-flour');
    expect(common).toContain('milk');
    expect(common.length).toBeLessThan(SELECTABLE_ITEMS.length / 2);
  });

  it('search ranks exact and prefix matches first', () => {
    expect(searchCatalog('rigatoni')[0]!.id).toBe('rigatoni');
    expect(searchCatalog('parm')[0]!.id).toBe('parmesan');
    expect(searchCatalog('flour').map((i) => i.id)).toContain('bread-flour');
  });
});

describe('NYT corpus', () => {
  const lines = (recipes as { ingredients: string[] }[]).flatMap((r) => r.ingredients);
  const parsed = lines.map((l) => parseIngredientLine(l));
  const unmatched = parsed.filter((p) => p.unmatched).map((p) => p.raw);

  it('matches at least 97% of real-world lines', () => {
    const rate = 1 - unmatched.length / lines.length;
    if (rate < 0.97) console.log('Unmatched lines:\n' + unmatched.join('\n'));
    expect(rate).toBeGreaterThanOrEqual(0.97);
  });
});
