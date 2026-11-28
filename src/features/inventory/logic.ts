import type { CatalogEntry, InventoryItem, StockStatus, StorageLocation } from './types';

export type StatusFilter = 'all' | 'low' | 'out';

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Naive singular so "eggs" finds "egg" and "tomatoes" finds "tomato". */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith('oes')) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * Score how well `query` matches `text`. 0 = no match. Higher is better.
 * Every query word must prefix-match some word of the text.
 */
export function matchScore(query: string, text: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const t = normalize(text);
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const tWords = t.split(' ').map(singular);
  const qWords = q.split(' ').map(singular);
  let score = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const tw of tWords) {
      if (tw === qw) best = Math.max(best, 30);
      else if (tw.startsWith(qw)) best = Math.max(best, 20);
      else if (qw.length >= 3 && tw.includes(qw)) best = Math.max(best, 8);
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

export function entryScore(query: string, name: string, aliases: string[] = []): number {
  let best = matchScore(query, name);
  // Alias hits rank below real name hits ("flour" -> "Bread flour" before "Tortillas").
  for (const a of aliases) if (matchScore(query, a) > 0) best = Math.max(best, Math.min(matchScore(query, a), 40) / 2);
  return best;
}

export function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export interface CategoryGroup {
  category: string;
  items: InventoryItem[];
}

/** Group items by category. Categories keep catalog order when given, then A–Z. */
export function groupByCategory(items: InventoryItem[], categoryOrder: string[] = []): CategoryGroup[] {
  const map = new Map<string, InventoryItem[]>();
  for (const it of items) {
    const key = it.category || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  const rank = (c: string) => {
    const i = categoryOrder.indexOf(c);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return rank(a) - rank(b) || a.localeCompare(b);
    })
    .map(([category, list]) => ({ category, items: sortByName(list) }));
}

export function filterItems(
  items: InventoryItem[],
  opts: { location?: StorageLocation | 'all'; status?: StatusFilter; query?: string },
): InventoryItem[] {
  const { location = 'all', status = 'all', query = '' } = opts;
  return items.filter((it) => {
    if (location !== 'all' && it.location !== location) return false;
    if (status !== 'all' && it.status !== status) return false;
    if (query && matchScore(query, it.name) === 0) return false;
    return true;
  });
}

export function countByStatus(items: InventoryItem[]): Record<StockStatus, number> {
  const c: Record<StockStatus, number> = { have: 0, low: 0, out: 0 };
  for (const it of items) c[it.status]++;
  return c;
}

/** Items this screen knows are headed to the grocery list: low, or out and needed/added. */
export const isOnList = (it: InventoryItem) =>
  it.status === 'low' || (it.status === 'out' && (Boolean(it.neededFor) || Boolean(it.onList)));

/** Candidates for "Just shopped": everything low or out, list items first. */
export function restockCandidates(items: InventoryItem[]): InventoryItem[] {
  return sortByName(items.filter((it) => it.status !== 'have')).sort(
    (a, b) => Number(isOnList(b)) - Number(isOnList(a)),
  );
}

/**
 * Catalog entries the user does not stock yet that match the query, best first.
 * Used by search so you can add "capers" without leaving the screen.
 */
export function catalogSuggestions(
  query: string,
  catalog: CatalogEntry[],
  items: InventoryItem[],
  limit = 8,
): CatalogEntry[] {
  if (!normalize(query)) return [];
  const stockedIds = new Set(items.map((i) => i.id));
  const stockedNames = new Set(items.map((i) => normalize(i.name)));
  return catalog
    .filter((c) => !stockedIds.has(c.id) && !stockedNames.has(normalize(c.name)))
    .map((c) => ({ c, s: entryScore(query, c.name, c.aliases) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}

/** True if a custom item with this name would duplicate something already stocked. */
export function findExisting(name: string, items: InventoryItem[]): InventoryItem | undefined {
  const n = normalize(name);
  return items.find((i) => normalize(i.name) === n || singular(normalize(i.name)) === singular(n));
}

/** Guess where a typed custom item lives, from a few keywords. */
export function guessLocation(name: string): StorageLocation {
  const n = normalize(name);
  if (/\b(frozen|ice cream|popsicle|freezer)\b/.test(n)) return 'freezer';
  if (
    /\b(milk|cream|cheese|yogurt|yoghurt|butter|egg|eggs|juice|tofu|lettuce|spinach|kale|herb|cilantro|parsley|basil|chicken|beef|pork|turkey|sausage|bacon|ham|fish|salmon|shrimp|hummus|salsa|tortilla|berries|grapes|celery|carrot|carrots|pepper|peppers|cucumber|zucchini|mushroom|mushrooms|deli|leftover)\b/.test(
      n,
    )
  )
    return 'fridge';
  return 'pantry';
}

export function titleCase(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** What tapping a row does: have -> out, low -> have, out -> have. */
export function nextOnTap(status: StockStatus): StockStatus {
  return status === 'have' ? 'out' : 'have';
}

/** What the "Low" button does: toggles low on and off. */
export function nextOnLow(status: StockStatus): StockStatus {
  return status === 'low' ? 'have' : 'low';
}

/** "canned-goods" -> "Canned goods". Leaves already-pretty labels alone. */
export function formatCategory(c: string): string {
  if (!c) return 'Other';
  if (/[A-Z ]/.test(c)) return c;
  const s = c.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Spices and dried herbs get their own tab so the pantry list stays short. */
export function isSpice(it: { location: string; category: string }): boolean {
  return it.location === 'pantry' && /spice|dried herb/i.test(it.category);
}

/** One row in the "browse and add" picker: a catalog item you don't stock, or one you're out of. */
export interface BrowseEntry extends CatalogEntry {
  /** Already in the kitchen but marked out; picking it marks it Have again. */
  out?: boolean;
}

export interface BrowseGroup {
  category: string;
  items: BrowseEntry[];
}

/**
 * Everything in one section you don't have: catalog items not in the kitchen, plus items marked out.
 * `inSection` decides which tab an entry belongs to. Grouped by category (catalog order), A–Z inside.
 * With a query, only matching entries are kept and each group is sorted best match first.
 */
export function browseGroups(
  catalog: CatalogEntry[],
  items: InventoryItem[],
  inSection: (e: { location: StorageLocation; category: string }) => boolean,
  query = '',
  categoryOrder: string[] = [],
): BrowseGroup[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const stockedNames = new Set(items.filter((i) => i.status !== 'out').map((i) => normalize(i.name)));
  const q = normalize(query);
  const rows: { e: BrowseEntry; s: number }[] = [];
  const seen = new Set<string>();
  const consider = (e: BrowseEntry) => {
    if (seen.has(e.id) || !inSection(e)) return;
    seen.add(e.id);
    const s = q ? entryScore(q, e.name, e.aliases) : 1;
    if (s > 0) rows.push({ e, s });
  };
  for (const c of catalog) {
    const have = byId.get(c.id);
    if (have && have.status !== 'out') continue;
    if (!have && stockedNames.has(normalize(c.name))) continue;
    consider(have ? { ...c, out: true } : c);
  }
  // Out custom items that aren't in the catalog list.
  for (const i of items) if (i.status === 'out') consider({ id: i.id, name: i.name, location: i.location, category: i.category, out: true });

  const map = new Map<string, { e: BrowseEntry; s: number }[]>();
  for (const r of rows) {
    const k = r.e.category || 'Other';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  const rank = (c: string) => {
    const i = categoryOrder.indexOf(c);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...map.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, list]) => ({
      category,
      items: list
        .sort((a, b) => (q ? b.s - a.s : 0) || a.e.name.localeCompare(b.e.name, undefined, { sensitivity: 'base' }))
        .map((r) => r.e),
    }));
}
