/**
 * How the lunch logic reads the kitchen and names things.
 *
 * Lunch ids follow the shared catalog (src/shared/catalog). A few lunchbox
 * items (string cheese, yogurt cups, fig bars...) are new; they're listed in
 * LUNCH_EXTRA_ITEMS for the catalog to pick up. Until it does, the aliases
 * below let close catalog items count (yogurt cups <- Greek yogurt).
 */
import { getItem } from "@shared/catalog";
import type { StockStatus } from "@shared/types";
import type { CatalogId, Kitchen } from "./types";

/** Other ids that satisfy a lunch ingredient (more specific or older spellings). */
export const LUNCH_ID_ALIASES: Readonly<Record<CatalogId, readonly CatalogId[]>> = {
  "short-pasta": ["long-pasta", "spaghetti", "egg-noodles"],
  "white-rice": ["brown-rice", "instant-rice"],
  "yogurt-cups": ["greek-yogurt", "yogurt"],
  "applesauce-cups": ["applesauce", "applesauce-pouches"],
  "string-cheese": ["cheese-sticks"],
  "rotisserie-chicken": ["cooked-chicken"],
  "canned-chicken": ["rotisserie-chicken", "cooked-chicken"],
  "frozen-broccoli": ["broccoli"],
  broccoli: ["frozen-broccoli"],
  "frozen-corn": ["corn-on-the-cob"],
  berries: ["frozen-berries", "strawberries", "blueberries"],
  oranges: ["clementines", "mandarins"],
  bagels: ["bagel"],
  tortillas: ["flour-tortillas", "corn-tortillas"],
  "goldfish-crackers": ["crackers"],
};

/**
 * Lunch items the interim catalog doesn't have yet, with where they live.
 * The catalog thread merges these; the shape matches CatalogItem.
 */
export const LUNCH_EXTRA_ITEMS = [
  { id: "bagels", name: "Bagels", location: "pantry", category: "Bread & snacks", aliases: ["bagel"] },
  { id: "english-muffins", name: "English muffins", location: "pantry", category: "Bread & snacks", aliases: ["english muffin"] },
  { id: "pretzels", name: "Pretzels", location: "pantry", category: "Bread & snacks", aliases: ["pretzel"] },
  { id: "goldfish-crackers", name: "Goldfish crackers", location: "pantry", category: "Bread & snacks", aliases: ["goldfish"] },
  { id: "granola-bars", name: "Granola bars", location: "pantry", category: "Bread & snacks", aliases: ["granola bar"] },
  { id: "fig-bars", name: "Fig bars", location: "pantry", category: "Bread & snacks", aliases: ["fig newtons", "fig bar"] },
  { id: "fruit-bars", name: "Fruit bars", location: "pantry", category: "Bread & snacks", aliases: ["fruit bar", "fruit snacks"] },
  { id: "applesauce-cups", name: "Applesauce cups", location: "pantry", category: "Bread & snacks", aliases: ["applesauce", "applesauce pouches"] },
  { id: "boxed-mac-and-cheese", name: "Boxed mac and cheese", location: "pantry", category: "Pasta, rice & grains", aliases: ["mac and cheese", "kraft dinner"] },
  { id: "canned-soup", name: "Canned soup", location: "pantry", category: "Canned & jarred", aliases: ["tomato soup", "chicken noodle soup"] },
  { id: "canned-chicken", name: "Canned chicken", location: "pantry", category: "Canned & jarred", aliases: [] },
  { id: "string-cheese", name: "String cheese", location: "fridge", category: "Dairy & eggs", aliases: ["cheese sticks"] },
  { id: "yogurt-cups", name: "Yogurt cups", location: "fridge", category: "Dairy & eggs", aliases: ["yogurt tubes", "go-gurt"] },
  { id: "pepperoni", name: "Pepperoni", location: "fridge", category: "Meat, fish & tofu", aliases: [] },
  { id: "rotisserie-chicken", name: "Rotisserie chicken", location: "fridge", category: "Meat, fish & tofu", aliases: ["cooked chicken", "shredded chicken"] },
] as const;

const EXTRA_NAMES = new Map<string, string>(LUNCH_EXTRA_ITEMS.map((i) => [i.id, i.name]));
const RANK: Record<StockStatus, number> = { have: 2, low: 1, out: 0 };

/** Status of one id in a kitchen. A Set or predicate can't say "low", so owned = "have". */
function rawStatus(id: CatalogId, kitchen: Kitchen): StockStatus {
  if (typeof kitchen === "function") return kitchen(id) ? "have" : "out";
  if (kitchen instanceof Set) return kitchen.has(id) ? "have" : "out";
  return (kitchen as Record<string, StockStatus>)[id] ?? "out";
}

/** Best status across an id and its aliases. Assumed catalog items always count. */
export function statusOf(id: CatalogId, kitchen: Kitchen): StockStatus {
  if (getItem(id)?.assumed) return "have";
  let best = rawStatus(id, kitchen);
  if (best === "have") return best;
  for (const alt of LUNCH_ID_ALIASES[id] ?? []) {
    const s = rawStatus(alt, kitchen);
    if (RANK[s] > RANK[best]) best = s;
    if (best === "have") break;
  }
  return best;
}

export const isOwned = (id: CatalogId, kitchen: Kitchen) => statusOf(id, kitchen) !== "out";

/** Display name: catalog name, then the lunch extras, then the id in sentence case. */
export function nameOf(id: CatalogId): string {
  const n = getItem(id)?.name ?? EXTRA_NAMES.get(id);
  if (n) return n;
  const s = id.replace(/-/g, " ");
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
