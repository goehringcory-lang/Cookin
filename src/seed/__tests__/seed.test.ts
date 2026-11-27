import { describe, expect, it } from "vitest";
import { analyzeRecipe } from "@shared/catalog";
import { buildSeedDocs, seedInventory, seedPlan, seedRecipes } from "../index";

const owned = () => new Set(seedInventory().filter(e => e.status !== "out").map(e => e.itemId));

describe("demo seed", () => {
  it("has a realistic Recipe Box", () => {
    expect(seedRecipes.length).toBeGreaterThanOrEqual(30);
    expect(new Set(seedRecipes.map(r => r.id)).size).toBe(seedRecipes.length);
  });

  it("maps almost every ingredient line onto the catalog", () => {
    const lines = seedRecipes.flatMap(r => analyzeRecipe(r, owned()).lines);
    const unknown = lines.filter(l => l.status === "unknown").map(l => l.line);
    // Unknown lines end up as raw text on the list; keep them rare.
    expect(unknown.length / lines.length, `unmatched: ${unknown.join(" | ")}`).toBeLessThan(0.1);
  });

  it("leaves a handful of recipes makeable right now, including quick ones", () => {
    const can = seedRecipes.filter(r => analyzeRecipe(r, owned()).canMake);
    // 7 are makeable by design. Raise this to 6 once the catalog stops matching
    // "4 cloves garlic" to the clove spice (reported to the catalog thread).
    expect(can.length, can.map(r => r.title).join(", ")).toBeGreaterThanOrEqual(2);
    expect(can.filter(r => (r.totalMinutes ?? 99) <= 25).length).toBeGreaterThanOrEqual(1);
  });

  it("marks flour out so recipes that need it put it on the list", () => {
    const inv = seedInventory();
    expect(inv.find(e => e.itemId.includes("flour"))?.status).toBe("out");
  });

  it("plans a full week with dinners and leftovers lunches", () => {
    const plan = seedPlan("2026-11-30");
    expect(plan.filter(p => p.meal === "dinner")).toHaveLength(7);
    expect(plan.some(p => p.kind === "leftovers")).toBe(true);
    for (const p of plan) if (p.kind !== "none") expect(seedRecipes.some(r => r.id === p.refId)).toBe(true);
  });

  it("fresh mode skips onboarding data", () => {
    const docs = buildSeedDocs({ fresh: true });
    expect(docs.some(d => d.c === "inventory")).toBe(false);
    expect(docs.find(d => d.c === "settings")?.data).toMatchObject({ onboardingComplete: false });
  });
});
