import type { CatalogItem, Category, Location } from './types';
import type { RawItem } from './data/raw';
import { CATEGORIES, HIDDEN_CATEGORIES } from './data/categories';
import { BASICS, GENERICS } from './data/basics';
import { PANTRY } from './data/pantry';
import { COLD } from './data/cold';
import { normalizePhrase, normalizeTokens } from './normalize';
import { LEGACY_IDS } from './data/legacy';

export { LEGACY_IDS };

export { CATEGORIES };

const CATEGORY_BY_ID = new Map<string, Category>(CATEGORIES.map((c) => [c.id, c]));

function withLocation(raw: RawItem): CatalogItem {
  const cat = CATEGORY_BY_ID.get(raw.category);
  if (!cat) throw new Error(`Catalog item ${raw.id} has unknown category ${raw.category}`);
  const item: CatalogItem = { ...raw, location: cat.location, aliases: raw.aliases ?? [] };
  // "Rice (any)" -> "Rice", "Chicken (any cut)" -> "Chicken" for the shopping list
  if (!item.listName && /\s*\(any[^)]*\)\s*$/i.test(item.name)) item.listName = item.name.replace(/\s*\(any[^)]*\)\s*$/i, '');
  return item;
}

/** Every catalog item, including hidden assumed and generic ones. Ids are unique and stable. */
export const CATALOG: readonly CatalogItem[] = Object.freeze(
  [...PANTRY, ...COLD, ...BASICS, ...GENERICS].map(withLocation),
);

const BY_ID = new Map<string, CatalogItem>(CATALOG.map((i) => [i.id, i]));
let customItems: CatalogItem[] = [];

/** Catalog item by id, including custom items registered with setCustomItems. */
export function getItem(id: string): CatalogItem | undefined {
  const r = resolveId(id);
  return BY_ID.get(r) ?? customItems.find((i) => i.id === r);
}

/** Display name for the shopping list: `listName` when set, else `name`. Unknown ids come back as-is. */
export function listNameOf(id: string): string {
  const item = getItem(id);
  return item ? item.listName ?? item.name : id;
}

/** Map an id from the old interim catalog to its current id. Current ids pass through. */
export function resolveId(id: string): string {
  return BY_ID.has(id) ? id : LEGACY_IDS[id] ?? id;
}

const LEGACY_BY_TARGET = new Map<string, string[]>();
for (const [old, cur] of Object.entries(LEGACY_IDS)) {
  if (!LEGACY_BY_TARGET.has(cur)) LEGACY_BY_TARGET.set(cur, []);
  LEGACY_BY_TARGET.get(cur)!.push(old);
}
/** Old ids that resolve to this id (so inventory saved under an old id still counts). */
export function legacyIdsFor(id: string): readonly string[] {
  return LEGACY_BY_TARGET.get(id) ?? [];
}

/** Built-in items plus custom items, in catalog order (custom last). */
export function allItems(): CatalogItem[] {
  return [...CATALOG, ...customItems.filter((c) => !BY_ID.has(c.id))];
}

/**
 * Register Cory's own items (the `customItems` collection) so the matcher and getItem know them.
 * A custom item's name and aliases win over built-in aliases. Cheap; call whenever they change.
 */
export function setCustomItems(custom: readonly CatalogItem[]): void {
  customItems = custom.map((c) => ({ ...c, aliases: c.aliases ?? [] }));
  defaultIndex = null;
}

/** True for items shown in onboarding and inventory screens (not assumed, not generic). */
export function isSelectable(item: CatalogItem): boolean {
  return !item.assumed && !item.generic && !HIDDEN_CATEGORIES.has(item.category);
}

/** Items a person can own, in catalog order. */
export const SELECTABLE_ITEMS: readonly CatalogItem[] = CATALOG.filter(isSelectable);

export interface CategoryWithItems extends Category {
  items: CatalogItem[];
}

/** Onboarding walkthrough: categories (in order) with their selectable items. Optionally one location. */
export function catalogByLocation(location?: Location): CategoryWithItems[] {
  return CATEGORIES.filter((c) => !HIDDEN_CATEGORIES.has(c.id) && (!location || c.location === location))
    .map((c) => ({ ...c, items: SELECTABLE_ITEMS.filter((i) => i.category === c.id) }))
    .filter((c) => c.items.length > 0);
}

/** Ids of the "common" items, for "select all common" during onboarding. */
export function commonItemIds(location?: Location): string[] {
  return SELECTABLE_ITEMS.filter((i) => i.common && (!location || i.location === location)).map((i) => i.id);
}

/**
 * Search selectable items by name or alias. Prefix and whole-word matches rank first.
 * Returns at most `limit` items.
 */
export function searchCatalog(query: string, limit = 20): CatalogItem[] {
  const q = normalizePhrase(query);
  if (!q) return [];
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of allItems().filter(isSelectable)) {
    let best = Infinity;
    for (const text of [item.name, ...item.aliases]) {
      const n = normalizePhrase(text);
      let s = Infinity;
      if (n === q) s = 0;
      else if (n.startsWith(q)) s = 1;
      else if (n.split(' ').some((w) => w.startsWith(q))) s = 2;
      else if (n.includes(q)) s = 3;
      if (text !== item.name && s !== Infinity) s += 0.5;
      best = Math.min(best, s);
    }
    if (best !== Infinity) scored.push({ item, score: best });
  }
  scored.sort((a, b) => a.score - b.score || a.item.name.length - b.item.name.length);
  return scored.slice(0, limit).map((s) => s.item);
}

/** Lookup structures the parser uses. Built once from a catalog. */
export interface CatalogIndex {
  /** Normalized phrase -> item id. */
  phrases: Map<string, string>;
  /** Longest phrase length in tokens. */
  maxLen: number;
  assumed: Set<string>;
  generic: Set<string>;
  /** Generic ids whose members can stand in for each other. */
  swappable: Set<string>;
  /** item id -> ids it satisfies, transitively (excluding itself). */
  satisfies: Map<string, Set<string>>;
  /** generic or target id -> ids of items that satisfy it, transitively. */
  satisfiedBy: Map<string, Set<string>>;
}

export function buildIndex(builtIn: readonly CatalogItem[], custom: readonly CatalogItem[] = []): CatalogIndex {
  const items = [...builtIn, ...custom];
  const phrases = new Map<string, string>();
  let maxLen = 1;
  const add = (text: string, id: string, strong: boolean) => {
    const toks = normalizeTokens(text);
    if (toks.length === 0) return;
    const key = toks.join(' ');
    // Names win over aliases; first writer wins otherwise.
    if (!phrases.has(key) || strong) phrases.set(key, id);
    maxLen = Math.max(maxLen, toks.length);
  };
  for (const item of items) for (const a of item.aliases) add(a, item.id, false);
  // Ids and names last so they override any alias collision.
  for (const item of builtIn) {
    add(item.id.replace(/-/g, ' '), item.id, false);
    add(item.name, item.id, true);
  }
  // Custom items override everything: Cory added them on purpose.
  for (const item of custom) for (const a of [item.name, ...item.aliases]) add(a, item.id, true);

  const direct = new Map<string, string[]>(items.map((i) => [i.id, i.satisfies ?? []]));
  const satisfies = new Map<string, Set<string>>();
  for (const item of items) {
    const seen = new Set<string>();
    const stack = [...(direct.get(item.id) ?? [])];
    while (stack.length) {
      const t = stack.pop()!;
      if (t === item.id || seen.has(t)) continue;
      seen.add(t);
      stack.push(...(direct.get(t) ?? []));
    }
    satisfies.set(item.id, seen);
  }
  const satisfiedBy = new Map<string, Set<string>>();
  for (const [id, targets] of satisfies) {
    for (const t of targets) {
      if (!satisfiedBy.has(t)) satisfiedBy.set(t, new Set());
      satisfiedBy.get(t)!.add(id);
    }
  }

  return {
    phrases,
    maxLen,
    assumed: new Set(items.filter((i) => i.assumed).map((i) => i.id)),
    generic: new Set(items.filter((i) => i.generic).map((i) => i.id)),
    swappable: new Set(items.filter((i) => i.swappable).map((i) => i.id)),
    satisfies,
    satisfiedBy,
  };
}

let defaultIndex: CatalogIndex | null = null;

/** The index for the built-in CATALOG (built lazily, once). */
export function getIndex(): CatalogIndex {
  if (!defaultIndex) defaultIndex = buildIndex(CATALOG, customItems);
  return defaultIndex;
}
