import type { CatalogItem, Location } from "@shared/types";

export const LOCATIONS: { id: Location; title: string; emoji: string; blurb: string }[] = [
  { id: "pantry", title: "Pantry", emoji: "🥫", blurb: "Dry goods, spices, cans and jars." },
  { id: "fridge", title: "Fridge", emoji: "🧀", blurb: "Dairy, produce and opened condiments." },
  { id: "freezer", title: "Freezer", emoji: "🧊", blurb: "Frozen vegetables, meat and ready-to-cook." },
];

const CATEGORY_EMOJI: [RegExp, string][] = [
  [/pasta|noodle/i, "🍝"],
  [/rice|grain/i, "🍚"],
  [/flour|baking/i, "🧁"],
  [/oil|vinegar/i, "🫒"],
  [/spice|herb|season/i, "🌿"],
  [/can|jar/i, "🥫"],
  [/sauce|condiment/i, "🧴"],
  [/nut|seed|dried fruit/i, "🥜"],
  [/bread|tortilla|snack/i, "🍞"],
  [/wine|spirit|drink/i, "🍷"],
  [/dairy|egg|cheese/i, "🥚"],
  [/meat|fish|seafood|deli|protein|tofu/i, "🍗"],
  [/vegetable|produce|fruit|veg/i, "🥕"],
  [/meal|ready|prepared/i, "🍕"],
  [/added by you/i, "✏️"],
];

export const categoryEmoji = (name: string) => CATEGORY_EMOJI.find(([re]) => re.test(name))?.[1] ?? "🛒";

export interface CategoryGroup {
  key: string;
  name: string;
  emoji: string;
  /** Common items first, then the rest, otherwise in catalog order. */
  items: CatalogItem[];
}

/** Items onboarding should ask about: not always-assumed (salt) and not generic match targets. */
export const isAskable = (i: CatalogItem) => !i.assumed && !(i as CatalogItem & { generic?: boolean }).generic;

/** Shapes catalogGroups() output for the walkthrough. */
export function toGroups(groups: { category: string; items: CatalogItem[] }[]): CategoryGroup[] {
  return groups
    .map(({ category, items }) => {
      const ask = items.filter(isAskable);
      return {
        key: category,
        name: category,
        emoji: categoryEmoji(category),
        items: [...ask.filter((i) => i.common), ...ask.filter((i) => !i.common)],
      };
    })
    .filter((g) => g.items.length > 0);
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Ranked search over names and aliases, across all locations. */
export function rankedSearch(items: CatalogItem[], query: string, limit = 40): CatalogItem[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(" ");
  const scored: { item: CatalogItem; score: number }[] = [];
  for (const item of items) {
    if (!isAskable(item)) continue;
    let best = 0;
    for (const [i, raw] of [item.name, ...(item.aliases ?? [])].entries()) {
      const h = norm(raw);
      const bonus = i === 0 ? 2 : 0; // prefer name hits over alias hits
      if (h === q) best = Math.max(best, 100 + bonus);
      else if (h.startsWith(q)) best = Math.max(best, 80 + bonus);
      else if (h.split(" ").some((w) => w.startsWith(q))) best = Math.max(best, 60 + bonus);
      else if (words.every((w) => h.includes(w))) best = Math.max(best, 40 + bonus);
    }
    if (best) scored.push({ item, score: best + (item.common ? 5 : 0) });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((s) => s.item);
}

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** A custom item for the `customItems` collection (doc id `c-<slug>`). */
export function makeCustomItem(name: string, location: Location): CatalogItem {
  const clean = name.trim().replace(/\s+/g, " ");
  const pretty = clean.charAt(0).toUpperCase() + clean.slice(1);
  return { id: "c-" + slugify(clean), name: pretty, category: "Added by you", location, aliases: [], custom: true };
}

/* ---------- walkthrough position (per device; the inventory itself syncs) ---------- */

export interface Progress {
  step: number;
  open: Partial<Record<Location, string | null>>;
}
const KEY = "cookin.onboarding.progress.v1";

export function loadProgress(): Progress | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null") as Progress | null;
    return p && typeof p.step === "number" ? p : null;
  } catch {
    return null;
  }
}
export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: fine, inventory still saves */
  }
}
export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
