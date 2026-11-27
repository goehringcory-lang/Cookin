/**
 * Planner URLs on top of the shell's hash router. The shell renders HomeScreen for any route
 * it doesn't know, so "#plan/..." lands here too.
 *   #home                          this week
 *   #home/w=2026-12-07             another week
 *   #home/m=2026-12-03:dinner      meal sheet open (add /x=menu for the options menu)
 *   #plan/w=2026-12-07/s=2026-12-08:lunch   plan picker, slot preselected
 *   #recipe/<id>/plan=<slot>       recipe for a planned meal (servings, cooked)
 *   #recipe/<id>/swap=<slot>       recipe previewed as a swap ("Make this tonight")
 *   #recipe/<id>/add=<slot>        recipe previewed to add to an empty slot
 */
export type Params = Record<string, string>;

export function parseParams(param?: string): { head?: string; params: Params } {
  const params: Params = {};
  let head: string | undefined;
  for (const part of (param ?? "").split("/").filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) params[part.slice(0, i)] = part.slice(i + 1);
    else if (head == null) head = part;
  }
  return { head, params };
}

const join = (base: string, kv: Record<string, string | undefined>) =>
  [base, ...Object.entries(kv).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)].join("/");

export const href = {
  home: (week?: string, meal?: string, extra?: "menu" | "move") => join("home", { w: week, m: meal, x: extra }),
  plan: (week?: string, slot?: string) => join("plan", { w: week, s: slot }),
  recipe: (id: string, ctx: { plan?: string; swap?: string; add?: string } = {}) => join(`recipe/${encodeURIComponent(id)}`, ctx),
};

/** Slot id "YYYY-MM-DD:meal" -> parts. */
export function parseSlot(slot?: string): { date: string; meal: "dinner" | "lunch" } | undefined {
  const m = slot?.match(/^(\d{4}-\d{2}-\d{2}):(dinner|lunch)$/);
  return m ? { date: m[1], meal: m[2] as "dinner" | "lunch" } : undefined;
}
