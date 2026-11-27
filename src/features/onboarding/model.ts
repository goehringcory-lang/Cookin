import type { CatalogItem, CategoryInfo, Location, OnboardingResult, Staple } from './types';

export const LOCATIONS: { id: Location; title: string; emoji: string; blurb: string }[] = [
  { id: 'pantry', title: 'Pantry', emoji: '🥫', blurb: 'Dry goods, spices, cans and jars.' },
  { id: 'fridge', title: 'Fridge', emoji: '🧀', blurb: 'Dairy, produce and opened condiments.' },
  { id: 'freezer', title: 'Freezer', emoji: '🧊', blurb: 'Frozen vegetables, meat and ready-to-cook.' },
];

const CATEGORY_EMOJI: [RegExp, string][] = [
  [/pasta|noodle/i, '🍝'],
  [/rice|grain/i, '🍚'],
  [/flour|baking/i, '🧁'],
  [/oil|vinegar/i, '🫒'],
  [/spice|herb|season/i, '🌿'],
  [/can|jar/i, '🥫'],
  [/sauce|condiment/i, '🧴'],
  [/nut|seed|dried fruit/i, '🥜'],
  [/bread|tortilla/i, '🍞'],
  [/wine|spirit|alcohol/i, '🍷'],
  [/dairy|egg|cheese/i, '🥚'],
  [/fruit/i, '🍓'],
  [/produce|vegetable|veg/i, '🥕'],
  [/meat|seafood|deli|protein/i, '🍗'],
  [/ready|prepared/i, '🍕'],
];

export const categoryEmoji = (name: string, given?: string) =>
  given ?? CATEGORY_EMOJI.find(([re]) => re.test(name))?.[1] ?? '🛒';

export interface CategoryGroup {
  key: string;
  name: string;
  emoji: string;
  items: CatalogItem[]; // common first, then the rest, stable order
}

/** Items onboarding should ask about. */
export const isAskable = (i: CatalogItem) => !i.assumed && !i.generic;

/** Groups a location's askable items by category, in catalog order. */
export function groupByCategory(
  catalog: CatalogItem[],
  location: Location,
  categories?: CategoryInfo[],
): CategoryGroup[] {
  const groups = new Map<string, CatalogItem[]>();
  for (const item of catalog) {
    if (item.location !== location || !isAskable(item)) continue;
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  const info = (key: string) => categories?.find((c) => c.id === key || c.name === key);
  const order = categories?.filter((c) => c.location === location).map((c) => c.id) ?? [];
  const rank = (key: string) => {
    const c = info(key);
    const i = c ? order.indexOf(c.id) : -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...groups.entries()]
    .map(([key, items], idx) => ({ key, items, idx }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.idx - b.idx)
    .map(({ key, items }) => {
      const c = info(key);
      const name = c?.name ?? key;
      return {
        key,
        name,
        emoji: categoryEmoji(name, c?.emoji),
        items: [...items.filter((i) => i.common), ...items.filter((i) => !i.common)],
      };
    });
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Simple ranked search over names and aliases, across all locations. */
export function search(catalog: CatalogItem[], query: string, limit = 40): CatalogItem[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ');
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of catalog) {
    if (!isAskable(item)) continue;
    const hay = [item.name, ...(item.aliases ?? [])].map(norm);
    let best = 0;
    for (const h of hay) {
      if (h === q) best = Math.max(best, 100);
      else if (h.startsWith(q)) best = Math.max(best, 80);
      else if (h.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 60);
      else if (words.every((w) => h.includes(w))) best = Math.max(best, 40);
    }
    if (best) scored.push({ item, score: best + (item.common ? 5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name)).slice(0, limit).map((s) => s.item);
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function makeCustomItem(name: string, location: Location): CatalogItem {
  const clean = name.trim().replace(/\s+/g, ' ');
  const pretty = clean.charAt(0).toUpperCase() + clean.slice(1);
  return { id: 'custom:' + slugify(clean), name: pretty, category: 'Added by you', location, custom: true };
}

// ---------- Draft (autosave + resume) ----------

export interface Draft {
  v: 1;
  step: number;
  have: string[];
  custom: CatalogItem[];
  staples: Staple[];
  open: Partial<Record<Location, string | null>>;
}

const DRAFT_KEY = 'cookin.onboarding.draft.v1';

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return d && d.v === 1 && Array.isArray(d.have) ? d : null;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode etc. Shared store still gets saved on each step. */
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export const toResult = (have: Set<string>, custom: CatalogItem[], staples: Staple[]): OnboardingResult => ({
  haveIds: [...have],
  customItems: custom.filter((c) => have.has(c.id)),
  staples,
});
