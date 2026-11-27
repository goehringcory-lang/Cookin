/**
 * Pure planner logic: stock matching per line, ranking for next week's picks,
 * swaps for a planned meal, and serving scaling. No React here.
 */
import type { PlanEntry, Recipe, StockStatus } from "@shared/types";
import { analyzeRecipe, getItem, type RecipeAnalysis } from "@shared/catalog";
import { addDays, parseYmd } from "@shared/domain";

export type StatusMap = Record<string, StockStatus | undefined>;

/* ---------------- matching ---------------- */

export interface Match {
  recipe: Recipe;
  a: RecipeAnalysis;
  /** Owned ids that are marked running low. */
  low: string[];
}

export const ownedFrom = (status: StatusMap) => (id: string) => status[id] === "have" || status[id] === "low";

export function match(recipe: Recipe, status: StatusMap): Match {
  const a = analyzeRecipe(recipe, ownedFrom(status));
  return { recipe, a, low: a.have.filter((id) => status[id] === "low") };
}

export type LineStatus = "have" | "low" | "missing" | "unknown" | "ignored" | "optional";

/** Per ingredient line status with "running low" split out of "have". */
export function lineStatuses(m: Match, status: StatusMap): { line: string; ids: string[]; status: LineStatus }[] {
  return m.a.lines.map((l) => ({
    ...l,
    status: l.status === "have" && l.ids.some((id) => status[id] === "low") ? "low" : l.status,
  }));
}

export const itemName = (id: string) => (getItem(id)?.name ?? id.replace(/-/g, " ")).toLowerCase();

export function reasonFor(m: Match): string {
  const miss = m.a.missing;
  if (miss.length === 0) return "You have everything";
  if (miss.length === 1) return `Just need ${itemName(miss[0])}`;
  if (miss.length === 2) return `Need ${itemName(miss[0])} and ${itemName(miss[1])}`;
  return `Need ${miss.length} items`;
}

/* ---------------- ranking for planning ---------------- */

export interface Ranked extends Match {
  score: number;
  reason: string;
}

export interface RankOptions {
  /** Recipe ids already in the week being planned (scored lower for variety). */
  planned?: Set<string>;
  /** Recipe ids cooked in the last two weeks. */
  recent?: Set<string>;
}

export function rankForPlanning(recipes: Recipe[], status: StatusMap, opts: RankOptions = {}): Ranked[] {
  return recipes
    .filter((r) => !r.archived)
    .map((r) => {
      const m = match(r, status);
      let score = m.a.coverage * 100;
      if (m.a.canMake) score += 15;
      score -= m.a.missing.length * 4;
      if (opts.planned?.has(r.id)) score -= 60;
      if (opts.recent?.has(r.id)) score -= 20;
      return { ...m, score, reason: reasonFor(m) };
    })
    .sort((x, y) => y.score - x.score || (x.recipe.totalMinutes ?? 99) - (y.recipe.totalMinutes ?? 99) || x.recipe.title.localeCompare(y.recipe.title));
}

/* ---------------- swaps ---------------- */

export const QUICK_MINUTES = 30;
export type SwapFilter = "all" | "quicker" | "under30";

/**
 * Other dinners for a planned slot: everything in stock or one item short, sorted by
 * missing count then time (design spec §5). "quicker" = at least 10 minutes faster than the
 * planned dish; "under30" = 30 minutes or less.
 */
export function swapOptions(planned: Recipe | undefined, recipes: Recipe[], status: StatusMap, filter: SwapFilter = "all", limit = 12): Match[] {
  const pt = planned?.totalMinutes;
  const t = (m: Match) => m.recipe.totalMinutes ?? 999;
  return recipes
    .filter((r) => r.id !== planned?.id && !r.archived)
    .map((r) => match(r, status))
    .filter((m) => m.a.missing.length <= 1)
    .filter((m) => filter === "all" || (filter === "under30" ? t(m) <= QUICK_MINUTES : pt != null && t(m) <= pt - 10))
    .sort((x, y) => x.a.missing.length - y.a.missing.length || t(x) - t(y) || y.a.have.length - x.a.have.length)
    .slice(0, limit);
}

/* ---------------- plan helpers ---------------- */

export function nextOpenDinner(plan: Record<string, PlanEntry>, dates: string[], from?: string): string | undefined {
  return dates.find((d) => (!from || d >= from) && !plan[`${d}:dinner`]);
}

/** Recipes that usually leave enough for tomorrow's lunch. */
export function makesLeftovers(r: Recipe, householdSize: number): boolean {
  if (r.makesLeftovers != null) return r.makesLeftovers;
  const y = r.servings ?? parseYield(r.yield);
  return y != null && y >= householdSize + 2;
}

/* ---------------- dates ---------------- */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dayName = (d: string, long = false) => (long ? DOW_LONG : DOW)[parseYmd(d).getDay()];
export const shortDate = (d: string) => { const x = parseYmd(d); return `${MON[x.getMonth()]} ${x.getDate()}`; };
export function relDay(d: string, today: string): string {
  if (d === today) return "Today";
  if (d === addDays(today, 1)) return "Tomorrow";
  if (d === addDays(today, -1)) return "Yesterday";
  return dayName(d, true);
}
export function weekRange(dates: string[]): string {
  const a = parseYmd(dates[0]), b = parseYmd(dates[dates.length - 1]);
  return a.getMonth() === b.getMonth() ? `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}` : `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}`;
}

/* ---------------- servings ---------------- */

/** "4 servings", "6 to 8 servings", "Serves 4", "4" -> 4 (first number). */
export function parseYield(y?: string): number | undefined {
  if (!y) return undefined;
  const m = y.match(/(\d+(?:\.\d+)?)/);
  const n = m ? Number(m[1]) : NaN;
  return n > 0 && n < 100 ? n : undefined;
}

const UNI: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875 };
const QTY = /^(\s*)(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])(\s*(?:to|-|–)\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞]))?/;

function parseQty(s: string): number {
  s = s.trim();
  const uni = s.match(/^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (uni) return (uni[1] ? Number(uni[1]) : 0) + UNI[uni[2]];
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return Number(s);
}

const FRACS: [number, string][] = [[0, ""], [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.375, "⅜"], [0.5, "½"], [0.625, "⅝"], [2 / 3, "⅔"], [0.75, "¾"], [0.875, "⅞"], [1, ""]];
export function formatQty(n: number): string {
  if (n >= 10) return String(Math.round(n));
  const whole = Math.floor(n);
  const rest = n - whole;
  let best = FRACS[0];
  for (const f of FRACS) if (Math.abs(f[0] - rest) < Math.abs(best[0] - rest)) best = f;
  const w = best[0] === 1 ? whole + 1 : whole;
  if (!best[1]) return String(w || (n > 0 ? "⅛" : "0"));
  return w ? `${w} ${best[1]}` : best[1];
}

/** Scales the leading quantity of an ingredient line ("1 1/2 cups rice" x2 -> "3 cups rice"). */
export function scaleLine(line: string, factor: number): string {
  if (factor === 1) return line;
  const m = line.match(QTY);
  if (!m) return line;
  const a = formatQty(parseQty(m[2]) * factor);
  const b = m[4] ? formatQty(parseQty(m[4]) * factor) : undefined;
  return m[1] + a + (b ? ` to ${b}` : "") + line.slice(m[0].length);
}

/** Scale factor for a recipe cooked for `servings` people. */
export function servingFactor(r: Recipe, servings: number): number {
  const base = r.servings ?? parseYield(r.yield);
  if (!base || !servings) return 1;
  return servings / base;
}
