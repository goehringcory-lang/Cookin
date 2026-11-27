import { describe, expect, it } from 'vitest';
import {
  catalogSuggestions, filterItems, findExisting, formatCategory, groupByCategory, guessLocation,
  matchScore, restockCandidates, nextOnLow, nextOnTap,
} from './logic';
import type { CatalogEntry, InventoryItem } from './types';

const item = (id: string, name: string, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id, name, location: 'pantry', category: 'baking', status: 'have', updatedAt: 0, ...extra,
});

describe('search matching', () => {
  it('matches word prefixes, plurals and accents', () => {
    expect(matchScore('flour', 'All-purpose flour')).toBeGreaterThan(0);
    expect(matchScore('egg', 'Eggs')).toBeGreaterThan(0);
    expect(matchScore('tomatoes', 'Crushed tomato')).toBeGreaterThan(0);
    expect(matchScore('jalapeno', 'Jalapeño')).toBeGreaterThan(0);
    expect(matchScore('ap fl', 'AP flour')).toBeGreaterThan(0);
    expect(matchScore('rice', 'Licorice')).toBe(8);
    expect(matchScore('xyz', 'Flour')).toBe(0);
  });
  it('ranks exact and prefix matches first', () => {
    expect(matchScore('milk', 'Milk')).toBeGreaterThan(matchScore('milk', 'Coconut milk'));
  });
});

describe('tap cycle', () => {
  it('tap toggles have/out and clears low', () => {
    expect(nextOnTap('have')).toBe('out');
    expect(nextOnTap('out')).toBe('have');
    expect(nextOnTap('low')).toBe('have');
  });
  it('low button toggles low', () => {
    expect(nextOnLow('have')).toBe('low');
    expect(nextOnLow('low')).toBe('have');
    expect(nextOnLow('out')).toBe('low');
  });
});

describe('filtering and grouping', () => {
  const items = [
    item('flour', 'Flour', { status: 'out' }),
    item('sugar', 'Sugar'),
    item('milk', 'Milk', { location: 'fridge', category: 'dairy', status: 'low' }),
  ];
  it('filters by location, status and query', () => {
    expect(filterItems(items, { location: 'pantry' }).map((i) => i.id)).toEqual(['flour', 'sugar']);
    expect(filterItems(items, { status: 'low' }).map((i) => i.id)).toEqual(['milk']);
    expect(filterItems(items, { query: 'sug' }).map((i) => i.id)).toEqual(['sugar']);
  });
  it('restockCandidates returns low and out items, list items first', () => {
    expect(restockCandidates(items).map((i) => i.id)).toEqual(['milk', 'flour']);
    const needed = items.map((i) => (i.id === 'flour' ? { ...i, neededFor: 'Tue dinner' } : i));
    expect(restockCandidates(needed).map((i) => i.id)).toEqual(['flour', 'milk']);
  });
  it('groups by category with given order and Other last', () => {
    const g = groupByCategory([...items, item('x', 'Thing', { category: '' })], ['dairy', 'baking']);
    expect(g.map((x) => x.category)).toEqual(['dairy', 'baking', 'Other']);
    expect(g[1].items.map((i) => i.name)).toEqual(['Flour', 'Sugar']);
  });
});

describe('catalog suggestions', () => {
  const catalog: CatalogEntry[] = [
    { id: 'flour', name: 'All-purpose flour', location: 'pantry', category: 'baking', aliases: ['flour'] },
    { id: 'bread-flour', name: 'Bread flour', location: 'pantry', category: 'baking' },
    { id: 'capers', name: 'Capers', location: 'pantry', category: 'condiments' },
  ];
  it('excludes stocked items and matches aliases', () => {
    const s = catalogSuggestions('flour', catalog, [item('flour', 'All-purpose flour')]);
    expect(s.map((c) => c.id)).toEqual(['bread-flour']);
    expect(catalogSuggestions('', catalog, [])).toEqual([]);
  });
});

describe('helpers', () => {
  it('findExisting ignores case and plurals', () => {
    expect(findExisting('egg', [item('eggs', 'Eggs')])?.id).toBe('eggs');
    expect(findExisting('ham', [item('eggs', 'Eggs')])).toBeUndefined();
  });
  it('guessLocation', () => {
    expect(guessLocation('Frozen waffles')).toBe('freezer');
    expect(guessLocation('Oat milk')).toBe('fridge');
    expect(guessLocation('Gochujang')).toBe('pantry');
  });
  it('formatCategory', () => {
    expect(formatCategory('canned-goods')).toBe('Canned goods');
    expect(formatCategory('Dairy & Eggs')).toBe('Dairy & Eggs');
    expect(formatCategory('')).toBe('Other');
  });
});

describe('alias ranking', () => {
  it('ranks name matches above alias matches', () => {
    const catalog: CatalogEntry[] = [
      { id: 'tortillas', name: 'Tortillas', location: 'pantry', category: 'bread', aliases: ['flour tortillas'] },
      { id: 'bread-flour', name: 'Bread flour', location: 'pantry', category: 'baking' },
    ];
    expect(catalogSuggestions('flour', catalog, []).map((c) => c.id)).toEqual(['bread-flour', 'tortillas']);
  });
});
