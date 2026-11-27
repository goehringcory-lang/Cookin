/**
 * How the lunch logic reads the kitchen and names things.
 *
 * Ownership goes through the shared catalog's `makeHas`, so generic ids
 * ("short-pasta" = any pasta shape), older ids ("jam" -> "jelly") and
 * `satisfies` links all work the same way they do for dinner recipes. A short
 * alias list covers a few lunch-specific near matches on top of that.
 */
import { getItem, makeHas } from "@shared/catalog";
import type { StockStatus } from "@shared/types";
import type { CatalogId, Kitchen } from "./types";

/** Extra near matches that count for a lunch (not general catalog equivalences). */
export const LUNCH_ID_ALIASES: Readonly<Record<CatalogId, readonly CatalogId[]>> = {
  "yogurt-cups": ["greek-yogurt", "yogurt"],
  "goldfish-crackers": ["crackers"],
  "canned-chicken": ["rotisserie-chicken"],
  "frozen-broccoli": ["broccoli"],
  broccoli: ["frozen-broccoli"],
  "frozen-corn": ["corn-on-the-cob"],
  berries: ["frozen-berries"],
};

type Has = (id: string) => boolean;
interface KitchenView {
  owned: Has;
  stocked: Has;
}

const views = new WeakMap<object, KitchenView>();

function viewOf(kitchen: Kitchen): KitchenView {
  const cached = views.get(kitchen as object);
  if (cached) return cached;
  let view: KitchenView;
  if (typeof kitchen === "function" || kitchen instanceof Set) {
    const owned = makeHas(kitchen as Set<string> | ((id: string) => boolean));
    view = { owned, stocked: owned };
  } else {
    const map = kitchen as Readonly<Record<string, StockStatus>>;
    view = {
      owned: makeHas((id: string) => map[id] === "have" || map[id] === "low"),
      stocked: makeHas((id: string) => map[id] === "have"),
    };
  }
  views.set(kitchen as object, view);
  return view;
}

function directStatus(id: CatalogId, v: KitchenView): StockStatus {
  if (v.stocked(id)) return "have";
  return v.owned(id) ? "low" : "out";
}

/** Status of a lunch ingredient: have, low (owned but running low) or out. */
export function statusOf(id: CatalogId, kitchen: Kitchen): StockStatus {
  const v = viewOf(kitchen);
  let best = directStatus(id, v);
  if (best === "have") return best;
  for (const alt of LUNCH_ID_ALIASES[id] ?? []) {
    const s = directStatus(alt, v);
    if (s === "have") return s;
    if (s === "low") best = s;
  }
  return best;
}

export const isOwned = (id: CatalogId, kitchen: Kitchen) => statusOf(id, kitchen) !== "out";

/** Current catalog id for a lunch ingredient (older ids resolve, e.g. "jam" -> "jelly"). */
export const canonicalId = (id: CatalogId): CatalogId => getItem(id)?.id ?? id;

/** Display name from the catalog, falling back to the id in sentence case. */
export function nameOf(id: CatalogId): string {
  const n = getItem(id)?.name;
  if (n) return n;
  const s = id.replace(/-/g, " ");
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
