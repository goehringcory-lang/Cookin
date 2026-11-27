/**
 * Typed helpers over the store that several features share. Feature-specific logic
 * (list building, lunch suggestions, plan ranking) lives in its feature folder.
 */
import { useMemo } from "react";
import type { AppSettings, InventoryEntry, ListState, PlanEntry, Staple, StockStatus } from "../types";
import { store, useCollection, useDoc } from "../store";
import { setCustomItems } from "../catalog";

/* ---------- settings ---------- */
export const DEFAULT_SETTINGS: AppSettings = { onboardingComplete: false, dinnersPerWeek: 7, householdSize: 3, weekStartsOn: 1, updatedAt: 0 };
export const getSettings = (): AppSettings => ({ ...DEFAULT_SETTINGS, ...store.get("settings", "app") });
export const useSettings = (): AppSettings => { const s = useDoc("settings", "app"); return useMemo(() => ({ ...DEFAULT_SETTINGS, ...s }), [s]); };
export const updateSettings = (fields: Partial<AppSettings>) => store.put("settings", "app", { ...getSettings(), ...fields, updatedAt: Date.now() });

/* ---------- inventory ---------- */
/** Owned = status have or low (low is still in the kitchen, but also goes on the list). */
export const isOwnedStatus = (s?: StockStatus) => s === "have" || s === "low";
export function setStatus(itemIds: string[], status: StockStatus) {
  const now = Date.now();
  store.putMany(itemIds.map(id => ({ c: "inventory" as const, id, data: { itemId: id, status, updatedAt: now } satisfies InventoryEntry })));
}
export const getStatus = (id: string): StockStatus => store.get("inventory", id)?.status ?? "out";
/** Live Set of owned catalog ids; pass to analyzeRecipe(). */
export function useOwned(): Set<string> {
  const inv = useCollection("inventory");
  return useMemo(() => new Set(Object.values(inv).filter(e => isOwnedStatus(e.status)).map(e => e.itemId)), [inv]);
}
/** Keeps the matcher in sync with Cory's custom items. Mounted once in App. */
export function useCustomItemsSync() {
  const custom = useCollection("customItems");
  useMemo(() => setCustomItems(Object.values(custom).map(c => ({ ...c, custom: true }))), [custom]);
}

/* ---------- dates & plan ---------- */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseYmd = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s: string, n: number) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export const todayYmd = () => ymd(new Date());
/** First day (YYYY-MM-DD) of the week containing `date`. */
export function weekStart(date: string = todayYmd(), startsOn: 0 | 1 = getSettings().weekStartsOn): string {
  const d = parseYmd(date); const back = (d.getDay() - startsOn + 7) % 7; d.setDate(d.getDate() - back); return ymd(d);
}
export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));
export const planId = (date: string, meal: PlanEntry["meal"]) => `${date}:${meal}`;
export function setPlan(entry: Omit<PlanEntry, "id" | "updatedAt">) { const id = planId(entry.date, entry.meal); store.put("plan", id, { ...entry, id, updatedAt: Date.now() }); }
export const clearPlan = (date: string, meal: PlanEntry["meal"]) => store.remove("plan", planId(date, meal));
/** Plan entries for the 7 days from `start`, keyed by plan id. */
export function usePlanWeek(start: string): Record<string, PlanEntry> {
  const plan = useCollection("plan");
  return useMemo(() => { const days = new Set(weekDates(start)); return Object.fromEntries(Object.entries(plan).filter(([, p]) => days.has(p.date))); }, [plan, start]);
}

/* ---------- staples ---------- */
export const DEFAULT_STAPLES: Omit<Staple, "updatedAt">[] = [
  { id: "milk", name: "Milk", itemId: "milk", kind: "staple", when: "always", active: true },
  { id: "bananas", name: "Bananas", itemId: "bananas", kind: "staple", when: "always", active: true },
  { id: "eggs", name: "Eggs", itemId: "eggs", kind: "staple", when: "always", active: true },
  { id: "bread", name: "Bread", itemId: "sandwich-bread", kind: "staple", when: "always", active: true },
  { id: "cereal", name: "Cereal", itemId: "cereal", kind: "staple", when: "always", active: true },
  // Kids' snacks Cory mentioned as examples; onboarding asks which ones they actually buy.
  { id: "fig-bars", name: "Fig bars", kind: "kids-snack", when: "always", active: false },
  { id: "fruit-bars", name: "Fruit bars", kind: "kids-snack", when: "always", active: false },
];

/* ---------- list ---------- */
export const EMPTY_LIST: ListState = { checked: {}, manual: [], dismissed: {}, updatedAt: 0 };
export const useListState = (): ListState => { const l = useDoc("list", "current"); return useMemo(() => ({ ...EMPTY_LIST, ...l }), [l]); };
export const updateList = (fields: Partial<ListState>) => store.put("list", "current", { ...EMPTY_LIST, ...store.get("list", "current"), ...fields, updatedAt: Date.now() });
