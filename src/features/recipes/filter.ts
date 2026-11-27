import type { Recipe } from "@shared/types";

export interface Row { recipe: Recipe; missing: number }
export type FilterId = "can-make" | "need-2" | "quick" | "dinner" | "lunch" | "leftovers" | "new" | "archived";

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "can-make", label: "Can make now" },
  { id: "need-2", label: "Need ≤ 2" },
  { id: "quick", label: "Under 30 min" },
  { id: "dinner", label: "Dinner" },
  { id: "lunch", label: "Lunch" },
  { id: "leftovers", label: "Makes leftovers" },
  { id: "new", label: "New this week" },
  { id: "archived", label: "No longer saved" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const hasTag = (r: Recipe, re: RegExp) => (r.tags || []).some(t => re.test(t));
const LUNCH = /lunch|sandwich|salad|soup|snack|appetizer|side/;
const DINNER = /dinner|main|weeknight|entree|entrée/;

export function matches(r: Recipe, f: FilterId, missing: number, now: number): boolean {
  switch (f) {
    case "can-make": return r.ingredients.length > 0 && missing === 0;
    case "need-2": return r.ingredients.length > 0 && missing <= 2;
    case "quick": return !!r.totalMinutes && r.totalMinutes <= 30;
    case "dinner": return hasTag(r, DINNER) || !hasTag(r, /breakfast|brunch|dessert|drink|cocktail|baking/) && !hasTag(r, LUNCH);
    case "lunch": return hasTag(r, LUNCH) || !!r.makesLeftovers;
    case "leftovers": return !!r.makesLeftovers;
    case "new": return now - r.addedAt < 7 * 86_400_000;
    case "archived": return !!r.archived;
  }
}

/** Search (title, tags, ingredient lines) + one filter. Archived recipes only show under their filter. */
export function filterRecipes(rows: Row[], query: string, filter: FilterId | null, now = Date.now()): Row[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const out = rows.filter(({ recipe: r, missing }) => {
    if (!!r.archived !== (filter === "archived")) return false;
    if (filter && filter !== "archived" && !matches(r, filter, missing, now)) return false;
    if (!words.length) return true;
    const hay = norm([r.title, ...(r.tags || []), ...r.ingredients].join(" "));
    return words.every(w => hay.includes(w));
  });
  const sortByMissing = filter === "can-make" || filter === "need-2";
  return out.sort((a, b) =>
    sortByMissing ? a.missing - b.missing || a.recipe.title.localeCompare(b.recipe.title)
      : filter === "quick" ? (a.recipe.totalMinutes ?? 999) - (b.recipe.totalMinutes ?? 999)
      : b.recipe.addedAt - a.recipe.addedAt || a.recipe.title.localeCompare(b.recipe.title));
}
