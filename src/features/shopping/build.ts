/**
 * Builds the shopping list. Pure: everything comes in through `ListInput`, so it
 * is easy to test and the hook only has to gather data from the store.
 *
 * The list is derived, never stored. Sources, merged into one flat list:
 *  1. missing catalog items of planned dinner recipes (and recipe lunches),
 *  2. missing items of planned easy lunches,
 *  3. inventory items marked "low",
 *  4. active staples ("always" every week, "when-low" only if its item is low or out),
 *  5. items typed in by hand.
 * Recipe lines that match nothing in the catalog go into `doubleCheck` instead,
 * because we can't tell if they are already in the kitchen.
 */
import { analyzeRecipe, cleanIngredientName, getItem, listNameOf, matchLine } from "@shared/catalog";
import type { InventoryEntry, ListEntry, ListLine, ListReason, PlanEntry, Recipe, Staple } from "@shared/types";
import { Amount } from "./units";
import { parseLine } from "./parse";
import { normalizeName } from "./normalize";
import { parseServings } from "@features/lunches";

export interface ShoppingLine extends ListLine {
  /** Merged quantity across recipes, e.g. "2½ cups" or "3". Empty when unknown. */
  amount: string;
  /** Short provenance shown under the name: "for Chili · Tue", "running low", "staple". */
  why: string;
  /** Manual list entry ids folded into this line (deleted when bought or removed). */
  manualIds: string[];
  /** Sort bucket: 0 recipe and lunch needs, 1 running low, 2 staples, 3 added by hand. */
  rank: number;
}

export interface ListInput {
  /** Plan entries to shop for (the hook passes today onward through next week). */
  plan: PlanEntry[];
  recipes: Record<string, Recipe>;
  inventory: Record<string, InventoryEntry>;
  staples: Staple[];
  /** List entries for the shopping week (useListEntries): checks, dismissals, manual items. */
  entries: ListEntry[];
  /** People eating; recipes that serve fewer are scaled up. */
  householdSize: number;
  /**
   * Missing items for planned easy lunches, from the lunches feature
   * (lunchShoppingNeeds). Merged into the same lines as recipe needs.
   */
  lunchNeeds?: LunchNeed[];
  /**
   * How much to scale a dinner that's also eaten as leftovers (lunches feature's
   * leftoverScale). Applied when a "leftovers" plan entry points at the recipe.
   */
  leftoverScale?: (recipe: Recipe) => number;
}

export interface LunchNeed { itemId: string; name?: string; reasons: ListReason[] }

export interface ShoppingList {
  lines: ShoppingLine[];
  doubleCheck: ShoppingLine[];
  /** Unchecked lines in both sections. */
  toBuy: number;
  inCart: number;
}

/* ---------- keys ---------- */

export const itemKey = (id: string) => `item:${id}`;
export const textKey = (line: string) => `text:${normalizeName(cleanIngredientName(line)) || line.trim().toLowerCase()}`;

/* ---------- helpers ---------- */

const status = (inv: Record<string, InventoryEntry>, id: string) => inv[id]?.status ?? "out";
const owned = (inv: Record<string, InventoryEntry>, id: string) => {
  const s = status(inv, id);
  return s === "have" || s === "low";
};

/** "4 servings" -> 4, "Serves 4 to 6" -> 4, "2 dozen cookies" -> undefined (not servings). */
export const yieldServings = (y?: string): number | undefined => parseServings(y);

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function weekday(ymd?: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return DAY[new Date(y, m - 1, d).getDay()] ?? "";
}

interface Draft {
  key: string;
  name: string;
  itemId?: string;
  reasons: ListReason[];
  amount: Amount;
  manualIds: string[];
}

/* ---------- build ---------- */

export function buildShoppingList(input: ListInput): ShoppingList {
  const { inventory: inv, entries } = input;
  const isOwned = (id: string) => owned(inv, id);
  const dismissed = new Set(entries.filter((e) => e.type === "dismiss" && e.key).map((e) => e.key!));
  const checked = new Set(entries.filter((e) => e.type === "check" && e.key).map((e) => e.key!));
  const manual = entries.filter((e) => e.type === "manual" && e.name).sort((a, b) => a.updatedAt - b.updatedAt);
  const drafts = new Map<string, Draft>();
  const unmatched = new Map<string, Draft>();

  const draft = (map: Map<string, Draft>, key: string, name: string, itemId?: string): Draft => {
    let d = map.get(key);
    if (!d) map.set(key, (d = { key, name, itemId, reasons: [], amount: new Amount(), manualIds: [] }));
    return d;
  };
  const itemDraft = (id: string) => draft(drafts, itemKey(id), (getItem(id) ? listNameOf(id) : null) ?? cleanIngredientName(id.replace(/-/g, " ")), id);
  const addReason = (d: Draft, r: ListReason) => {
    if (!d.reasons.some((x) => JSON.stringify(x) === JSON.stringify(r))) d.reasons.push(r);
  };

  // 1: planned recipes, in date order so "for X · Tue" reads naturally.
  const plan = [...input.plan].sort((a, b) => a.date.localeCompare(b.date) || a.meal.localeCompare(b.meal));
  const eatenAsLeftovers = new Set(plan.filter((p) => p.kind === "leftovers" && p.refId).map((p) => p.refId!));
  for (const entry of plan) {
    if (entry.cooked) continue;
    if (entry.kind === "recipe" && entry.refId) {
      const recipe = input.recipes[entry.refId];
      if (!recipe) continue;
      const serves = yieldServings(recipe.yield);
      const people = entry.servings ?? input.householdSize;
      // Only scale up: half a recipe still needs a whole can of beans.
      const forPeople = serves && people > serves ? people / serves : 1;
      // Cooking extra for tomorrow's lunch already counts the household, so take the larger.
      const scale = eatenAsLeftovers.has(recipe.id) && input.leftoverScale ? Math.max(forPeople, input.leftoverScale(recipe)) : forPeople;
      const reason: ListReason = { type: "recipe", recipeId: recipe.id, title: recipe.title, date: entry.date };
      const analysis = analyzeRecipe(recipe, isOwned);
      for (const l of analysis.lines) {
        if (l.status === "missing") {
          const parsed = l.ids.length === 1 ? parseLine(l.line) : undefined;
          for (const id of l.ids) {
            if (isOwned(id) || getItem(id)?.assumed) continue;
            const d = itemDraft(id);
            addReason(d, reason);
            d.amount.add(parsed?.quantity === undefined ? undefined : parsed.quantity * scale, parsed?.unit);
          }
        } else if (l.status === "unknown") {
          const parsed = parseLine(l.line);
          const d = draft(unmatched, textKey(l.line), cleanIngredientName(l.line));
          addReason(d, { type: "unmatched", recipeId: recipe.id, line: l.line });
          addReason(d, reason);
          d.amount.add(parsed.quantity === undefined ? undefined : parsed.quantity * scale, parsed.unit);
        }
      }
    }
    // lunch entries come in through lunchNeeds; leftovers and none add nothing.
  }

  // 2: easy lunches.
  for (const need of input.lunchNeeds ?? []) {
    if (isOwned(need.itemId) || getItem(need.itemId)?.assumed) continue;
    const d = itemDraft(need.itemId);
    if (!getItem(need.itemId) && need.name) d.name = need.name;
    for (const r of need.reasons) addReason(d, r);
  }

  // 3: running low.
  for (const e of Object.values(inv)) {
    if (e.status === "low") addReason(itemDraft(e.itemId), { type: "low", itemId: e.itemId });
  }

  // 4: staples.
  for (const s of input.staples) {
    if (!s.active) continue;
    if (s.when === "when-low" && (!s.itemId || status(inv, s.itemId) === "have")) continue;
    const d = s.itemId ? itemDraft(s.itemId) : draft(drafts, `staple:${s.id}`, s.name);
    // Cory's own word for a staple ("Bread") beats the catalog's ("Sandwich bread")
    // unless a recipe already put the item on the list.
    if (!d.reasons.some((r) => r.type === "recipe" || r.type === "lunch")) d.name = s.name;
    addReason(d, { type: "staple", stapleId: s.id });
  }

  // 5: typed in by hand. If it names one catalog item, merge with that line.
  for (const m of manual) {
    // "Add to list" on the Kitchen screen writes manual:inv-<itemId>; it is that exact item.
    const inv = m.id.startsWith("manual:inv-") ? m.id.slice("manual:inv-".length) : undefined;
    const ids = inv ? [inv] : matchLine(m.name!);
    const parsed = parseLine(m.name!);
    // Entry ids already look like "manual:<random>", which is the ListLine key format.
    const d = ids.length === 1 ? itemDraft(ids[0]) : draft(drafts, m.id, m.name!.trim());
    addReason(d, { type: "manual" });
    d.manualIds.push(m.id);
    if (ids.length === 1 && parsed.quantity !== undefined) d.amount.add(parsed.quantity, parsed.unit);
  }

  const finish = (d: Draft): ShoppingLine | undefined => {
    let reasons = d.reasons;
    if (dismissed.has(d.key)) {
      // Dismissed this week ("I have it", or bought on an earlier trip): drop the
      // reasons that would bring it straight back (staple, unmatched recipe line).
      // A recipe need or "running low" still shows, because those come from the kitchen's state.
      reasons = reasons.filter((r) => r.type !== "staple" && r.type !== "unmatched" && !(r.type === "recipe" && d.key.startsWith("text:")));
      if (!reasons.length) return undefined;
    }
    if (!reasons.length) return undefined;
    return {
      key: d.key,
      name: d.name,
      itemId: d.itemId,
      reasons,
      checked: checked.has(d.key),
      amount: d.amount.isEmpty() ? "" : d.amount.format(),
      why: describe(reasons),
      manualIds: d.manualIds,
      rank: rankOf(reasons),
    };
  };

  const lines = sortLines([...drafts.values()].map(finish).filter((x): x is ShoppingLine => !!x));
  const doubleCheck = sortLines(
    [...unmatched.values()]
      // An unmatched line whose text matches a list line (e.g. typed by hand) is already covered.
      .filter((d) => !drafts.has(d.key))
      .map(finish)
      .filter((x): x is ShoppingLine => !!x),
  );
  const all = [...lines, ...doubleCheck];
  return { lines, doubleCheck, toBuy: all.filter((l) => !l.checked).length, inCart: all.filter((l) => l.checked).length };
}

function rankOf(reasons: ListReason[]): number {
  if (reasons.some((r) => r.type === "recipe" || r.type === "lunch" || r.type === "unmatched")) return 0;
  if (reasons.some((r) => r.type === "low")) return 1;
  if (reasons.some((r) => r.type === "staple")) return 2;
  return 3;
}

/** Recipe needs, then running low, then staples, then added by hand; A to Z within each; checked at the bottom. */
export function sortLines<T extends Pick<ShoppingLine, "checked" | "rank" | "name">>(lines: T[]): T[] {
  return [...lines].sort((a, b) => Number(a.checked) - Number(b.checked) || a.rank - b.rank || a.name.localeCompare(b.name));
}

/** "for Chili · Tue, Tacos · Thu · running low". */
export function describe(reasons: ListReason[]): string {
  const meals: string[] = [];
  const extra: string[] = [];
  for (const r of reasons) {
    if (r.type === "recipe" || r.type === "lunch") {
      const name = r.type === "recipe" ? r.title : r.name;
      const day = weekday(r.date);
      const label = day ? `${name} · ${day}` : name;
      if (!meals.includes(label)) meals.push(label);
    } else if (r.type === "low") extra.push("running low");
    else if (r.type === "staple") extra.push("staple");
    else if (r.type === "manual") extra.push("added");
  }
  const parts = [...(meals.length ? [`for ${meals.join(", ")}`] : []), ...new Set(extra)];
  return parts.join(" · ");
}
