import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@shared/types";
import { CATALOG, catalogGroups } from "@shared/catalog";
import { makeCustomItem, rankedSearch, toGroups } from "../model";
import { STAPLE_SUGGESTIONS } from "../staples";

const item = (id: string, name: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  id, name, location: "pantry", category: "Pasta", aliases: [], ...extra,
});

describe("onboarding model", () => {
  it("puts common items first and hides assumed and generic items", () => {
    const [g] = toGroups([{ category: "Pasta", items: [
      item("orzo", "Orzo"),
      item("penne", "Penne", { common: true }),
      item("salt", "Salt", { assumed: true }),
      { ...item("short-pasta", "Short pasta"), generic: true } as CatalogItem,
    ] }]);
    expect(g.items.map((i) => i.id)).toEqual(["penne", "orzo"]);
  });

  it("drops categories with nothing to ask", () => {
    expect(toGroups([{ category: "Salt", items: [item("salt", "Salt", { assumed: true })] }])).toEqual([]);
  });

  it("covers every location of the shared catalog", () => {
    for (const loc of ["pantry", "fridge", "freezer"] as const) expect(toGroups(catalogGroups(loc)).length).toBeGreaterThan(0);
  });

  it("ranks exact and prefix name hits above alias hits", () => {
    const items = [item("tahini", "Tahini"), item("sesame-paste", "Sesame paste", { aliases: ["tahini paste"] }), item("tomato", "Tomato paste")];
    expect(rankedSearch(items, "tahini").map((i) => i.id)).toEqual(["tahini", "sesame-paste"]);
    expect(rankedSearch(items, "paste").map((i) => i.id)).toContain("tomato");
    expect(rankedSearch(items, "  ")).toEqual([]);
  });

  it("searches the real catalog by alias", () => {
    expect(rankedSearch(CATALOG, "rigatoni").length).toBeGreaterThan(0);
  });

  it("makes custom items with c- ids", () => {
    expect(makeCustomItem("  smoked   salmon ", "fridge")).toMatchObject({ id: "c-smoked-salmon", name: "Smoked salmon", location: "fridge", custom: true });
  });

  it("offers Cory's staples and kids' snacks with unique ids", () => {
    const ids = STAPLE_SUGGESTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ["milk", "bananas", "fig-bars", "fruit-bars"]) expect(ids).toContain(id);
  });
});
