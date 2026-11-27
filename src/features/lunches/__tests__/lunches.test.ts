import { describe, expect, it } from "vitest";
import { getItem } from "@shared/catalog";
import type { PlanEntry, Recipe, StockStatus } from "@shared/types";
import {
  LUNCH_LIBRARY,
  addDays,
  autoMakesLeftovers,
  checkIdea,
  dayOfWeek,
  describeLunch,
  getLunchIdea,
  leftoverDinnerFor,
  leftoverScale,
  leftoversHint,
  libraryCatalogIds,
  lunchShoppingNeeds,
  makesLeftovers,
  parseServings,
  planWeekLunches,
  plannedDinners,
  readyNow,
  suggestLunches,
  type PlannedDinner,
} from "../index";

const WEEK = ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"];

const kitchen: Record<string, StockStatus> = {
  "sandwich-bread": "have",
  "peanut-butter": "have",
  jam: "have",
  bananas: "have",
  apples: "low",
  tortillas: "have",
  cheddar: "have",
  butter: "have",
  eggs: "have",
  milk: "have",
};

const entry = (date: string, kind: PlanEntry["kind"], refId?: string, extra: Partial<PlanEntry> = {}): PlanEntry => ({
  id: `${date}:lunch`,
  date,
  meal: "lunch",
  kind,
  refId,
  updatedAt: 0,
  ...extra,
});

describe("library", () => {
  it("has unique l- ids and enough variety", () => {
    const ids = LUNCH_LIBRARY.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("l-"))).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(30);
    expect(LUNCH_LIBRARY.filter((l) => l.style !== "home").length).toBeGreaterThanOrEqual(10);
  });

  it("keeps every lunch quick and fills the shared LunchIdea fields", () => {
    for (const l of LUNCH_LIBRARY) {
      expect(l.minutes).toBeLessThanOrEqual(15);
      expect(l.items.length).toBeGreaterThan(0);
      for (const ing of l.ingredients) expect(ing.anyOf.length).toBeGreaterThan(0);
    }
  });

  it("only uses ids the catalog knows", () => {
    expect(libraryCatalogIds().filter((id) => !getItem(id))).toEqual([]);
  });
});

describe("matching", () => {
  it("PB&J is ready with bread, peanut butter and a banana", () => {
    const r = checkIdea(getLunchIdea("l-pbj")!, kitchen);
    expect(r.readiness).toBe("ready");
  });

  it("uses a swap (tortillas for bread) and flags low items", () => {
    const r = checkIdea(getLunchIdea("l-pbj")!, { tortillas: "have", "peanut-butter": "low", apples: "have" });
    expect(r.readiness).toBe("ready");
    expect(r.low).toEqual(["peanut-butter"]);
  });

  it("works with the shared useOwned() Set", () => {
    expect(checkIdea(getLunchIdea("l-pbj")!, new Set(["pita", "peanut-butter", "grapes"])).readiness).toBe("ready");
  });

  it("lists one id per missing required group and ignores optional ones", () => {
    const r = checkIdea(getLunchIdea("l-turkey-cheese-sandwich")!, { "sandwich-bread": "have" });
    expect(r.missing).toEqual(["deli-turkey", "sliced-cheese"]);
    expect(r.readiness).toBe("short");
  });

  it("counts close catalog items through aliases (yogurt cups <- Greek yogurt)", () => {
    const r = checkIdea(getLunchIdea("l-yogurt-granola")!, { "greek-yogurt": "have", "fig-bars": "have", bananas: "have" });
    expect(r.readiness).toBe("ready");
  });
});

describe("leftovers", () => {
  const dinner = (over: Partial<PlannedDinner> = {}): PlannedDinner => ({ date: "2026-11-30", recipeId: "nyt-1", title: "Turkey chili", ...over });
  const s4 = { householdSize: 4, leftoverPortionsForLunch: 2, includeWeekends: true };

  it("parses NYT yields", () => {
    expect(parseServings("4 servings")).toBe(4);
    expect(parseServings("6 to 8 servings")).toBe(6);
    expect(parseServings("Serves 4-6")).toBe(4);
    expect(parseServings("1 loaf")).toBeUndefined();
    expect(parseServings(undefined)).toBeUndefined();
  });

  it("auto-detects leftovers from a big yield", () => {
    expect(autoMakesLeftovers(dinner({ servings: 6 }), s4)).toBe(true);
    expect(autoMakesLeftovers(dinner({ servings: 4 }), s4)).toBe(false);
    expect(autoMakesLeftovers(dinner(), s4)).toBe(false);
  });

  it("Cory's toggle beats the estimate", () => {
    expect(makesLeftovers(dinner({ servings: 8, makesLeftovers: false }), s4)).toBe(false);
    expect(makesLeftovers(dinner({ servings: 4, makesLeftovers: true }), s4)).toBe(true);
  });

  it("scales a 4-serving recipe 1.5x when flagged", () => {
    expect(leftoverScale(dinner({ servings: 4, makesLeftovers: true }), s4)).toBe(1.5);
    expect(leftoverScale(dinner({ servings: 8 }), s4)).toBe(1);
    expect(leftoversHint(dinner({ servings: 4, makesLeftovers: true }), s4)).toMatch(/1½×/);
    expect(leftoversHint(dinner({ servings: 8 }), s4)).toMatch(/4 portions/);
  });

  it("feeds the NEXT day's lunch", () => {
    const d = [dinner({ servings: 8 })];
    expect(leftoverDinnerFor("2026-12-01", d, s4)?.title).toBe("Turkey chili");
    expect(leftoverDinnerFor("2026-11-30", d, s4)).toBeUndefined();
  });

  it("date helpers cross month and year ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(dayOfWeek("2026-11-29")).toBe(0);
  });
});

describe("suggestions", () => {
  it("ranks ready lunches first", () => {
    const s = suggestLunches(kitchen);
    expect(s[0].readiness).toBe("ready");
    const cut = s.findIndex((m) => m.readiness !== "ready");
    expect(s.slice(cut).every((m) => m.readiness !== "ready")).toBe(true);
  });

  it("readyNow returns only makeable lunches, quickest first", () => {
    const r = readyNow(kitchen);
    expect(r.length).toBeGreaterThan(2);
    expect(r.every((m) => m.readiness === "ready")).toBe(true);
    for (let i = 1; i < r.length; i++) expect(r[i].idea.minutes).toBeGreaterThanOrEqual(r[i - 1].idea.minutes);
  });

  it("prefers lunches whose missing items are already on the list", () => {
    const inv = { "sandwich-bread": "have", "sliced-cheese": "have", bananas: "have" } as const;
    const s = suggestLunches(inv, { alreadyBuying: new Set(["deli-turkey"]) });
    const t = s.find((m) => m.idea.id === "l-turkey-cheese-sandwich")!;
    expect(t.reasons[0]).toMatch(/already on your list/);
    expect(s.indexOf(t)).toBeLessThan(6);
  });

  it("lunchbox filter drops home-only lunches", () => {
    expect(suggestLunches(kitchen, { style: "lunchbox" }).every((m) => m.idea.style !== "home")).toBe(true);
  });
});

describe("planWeekLunches", () => {
  const dinners: PlannedDinner[] = [
    { date: "2026-11-30", recipeId: "nyt-chili", title: "Turkey chili", servings: 8 },
    { date: "2026-12-02", recipeId: "nyt-tacos", title: "Fish tacos", servings: 4 },
  ];

  it("puts leftovers after a big dinner and never repeats a lunch", () => {
    const plan = planWeekLunches({ dates: WEEK, dinners, kitchen });
    expect(plan).toHaveLength(7);
    expect(plan.find((e) => e.date === "2026-12-01")).toMatchObject({ kind: "leftovers", refId: "nyt-chili", fromDate: "2026-11-30" });
    const ids = plan.filter((e) => e.kind === "lunch").map((e) => e.refId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.every((e) => e.meal === "lunch")).toBe(true);
  });

  it("never touches a slot that's already planned, and avoids repeating it", () => {
    const existing = [entry("2026-11-30", "lunch", "l-pbj"), entry("2026-12-03", "none", undefined, { note: "School pizza day" })];
    const plan = planWeekLunches({ dates: WEEK, dinners: [], kitchen, existing });
    expect(plan.map((e) => e.date)).not.toContain("2026-11-30");
    expect(plan.map((e) => e.date)).not.toContain("2026-12-03");
    expect(plan.some((e) => e.refId === "l-pbj")).toBe(false);
  });

  it("doesn't use one dinner's leftovers twice", () => {
    const existing = [entry("2026-12-01", "leftovers", "nyt-chili", { fromDate: "2026-11-30" })];
    const plan = planWeekLunches({ dates: WEEK, dinners, kitchen, existing });
    expect(plan.filter((e) => e.kind === "leftovers")).toHaveLength(0);
  });

  it("spreads same-family lunches (peanut butter) across the week", () => {
    const inv = { ...kitchen, crackers: "have", "string-cheese": "have", "yogurt-cups": "have", "fig-bars": "have", "boxed-mac-and-cheese": "have" } as const;
    const plan = planWeekLunches({ dates: WEEK, dinners: [], kitchen: inv });
    const pb = plan.filter((e) => e.refId && getLunchIdea(e.refId)?.family === "peanut-butter");
    expect(pb.length).toBeLessThanOrEqual(2);
  });

  it("can skip weekends", () => {
    const plan = planWeekLunches({ dates: WEEK, dinners: [], kitchen, settings: { householdSize: 3, leftoverPortionsForLunch: 2, includeWeekends: false } });
    expect(plan.map((e) => e.date)).toEqual(WEEK.slice(0, 5));
  });

  it("Shuffle (a new seed) changes at least one pick", () => {
    const picks = (seed: number) => planWeekLunches({ dates: WEEK, dinners: [], kitchen, seed }).map((e) => e.refId).join();
    const first = picks(1);
    expect([2, 3, 4, 5, 6].some((s) => picks(s) !== first)).toBe(true);
  });

  it("works on an empty first-run kitchen", () => {
    expect(planWeekLunches({ dates: WEEK, dinners: [], kitchen: new Set() })).toHaveLength(7);
  });
});

describe("shared data bridge", () => {
  it("builds dinners from the plan and recipes, reading servings and the leftovers flag", () => {
    const recipes: Record<string, Recipe> = {
      "nyt-1": { id: "nyt-1", source: "nyt", title: "Chili", ingredients: ["1 pound ground turkey", "1 onion"], yield: "6 to 8 servings", addedAt: 0, updatedAt: 0 },
      "nyt-2": { id: "nyt-2", source: "nyt", title: "Tacos", ingredients: ["8 corn tortillas"], servings: 4, makesLeftovers: true, addedAt: 0, updatedAt: 0 },
    };
    const plan: Record<string, PlanEntry> = {
      "2026-11-30:dinner": { id: "2026-11-30:dinner", date: "2026-11-30", meal: "dinner", kind: "recipe", refId: "nyt-1", updatedAt: 0 },
      "2026-12-01:dinner": { id: "2026-12-01:dinner", date: "2026-12-01", meal: "dinner", kind: "recipe", refId: "nyt-2", updatedAt: 0 },
      "2026-12-01:lunch": entry("2026-12-01", "lunch", "l-pbj"),
    };
    const d = plannedDinners(plan, recipes, new Set(["onions"]));
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ servings: 6, title: "Chili" });
    expect(d[0].missingIds).toContain("ground-turkey");
    expect(d[1]).toMatchObject({ servings: 4, makesLeftovers: true });
  });
});

describe("shopping", () => {
  it("adds missing required items once, with every lunch that needs them", () => {
    const plan = [
      entry("2026-11-30", "lunch", "l-turkey-cheese-sandwich"),
      entry("2026-12-01", "lunch", "l-turkey-crackers-stackers"),
      entry("2026-12-02", "leftovers", "nyt-x", { fromDate: "2026-12-01" }),
      { ...entry("2026-12-02", "recipe", "nyt-x"), meal: "dinner" as const },
    ];
    const needs = lunchShoppingNeeds(plan, kitchen);
    const turkey = needs.find((n) => n.itemId === "deli-turkey")!;
    expect(turkey.name).toBe("Deli turkey");
    expect(turkey.reasons.map((r) => r.name)).toEqual(["Turkey and cheese sandwich", "Turkey cracker stackers"]);
    expect(turkey.reasons[0]).toMatchObject({ type: "lunch", ideaId: "l-turkey-cheese-sandwich", date: "2026-11-30" });
    expect(needs.filter((n) => n.itemId === "deli-turkey")).toHaveLength(1);
    expect(needs.map((n) => n.itemId)).not.toContain("lettuce"); // optional
  });

  it("accepts usePlanWeek()'s Record and uses current catalog ids and names", () => {
    const needs = lunchShoppingNeeds({ a: entry("2026-12-03", "lunch", "l-pbj") }, new Set(["sandwich-bread", "bananas"]));
    expect(needs.map((n) => n.itemId)).toEqual(["peanut-butter"]);
    const yog = lunchShoppingNeeds({ a: entry("2026-12-03", "lunch", "l-yogurt-granola") }, new Set());
    expect(yog.find((n) => n.itemId === "yogurt-cups")?.name).toBe(getItem("yogurt-cups")?.name);
  });

  it("treats any pasta shape as pasta (catalog generics)", () => {
    const r = checkIdea(getLunchIdea("l-buttered-noodles")!, new Set(["penne", "butter"]));
    expect(r.readiness).toBe("ready");
  });
});

describe("describeLunch", () => {
  it("uses the design spec wording", () => {
    expect(describeLunch(undefined).empty).toBe(true);
    expect(describeLunch(entry("2026-12-01", "lunch", "l-pbj")).label).toBe("Lunch: PB&J");
    expect(describeLunch(entry("2026-12-01", "lunch", "l-ham-cheese-roll-ups")).label).toBe("Lunch: ham and cheese roll-ups");
    expect(describeLunch(entry("2026-12-01", "leftovers", "nyt-1", { fromDate: "2026-11-30" }), { "nyt-1": { title: "Chili" } }).label).toBe( // recipe titles keep their own casing
      "Lunch: leftovers from Monday's Chili",
    );
    expect(describeLunch(entry("2026-12-01", "none", undefined, { note: "School pizza day" })).label).toBe("Lunch: School pizza day");
  });
});
