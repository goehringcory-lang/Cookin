import { describe, expect, it } from "vitest";
import type { Recipe } from "@shared/types";
import { knownNytIds, mergeImport } from "../core/merge";
import { chunkRequest, cleanNumericIds, sanitizeRequest } from "../core/protocol";

const rec = (id: string, extra: Partial<Recipe> = {}): Recipe => ({ id, source: "nyt", title: `R ${id}`, ingredients: ["1 egg"], addedAt: 1, updatedAt: 1, ...extra });
const imp = (id: string, extra: object = {}) => ({ id, title: `R ${id}`, ingredients: ["1 egg"], ...extra });

describe("mergeImport", () => {
  it("adds new recipes and records sync info", () => {
    const m = mergeImport({}, { via: "button", total: 1, recipes: [imp("nyt-1", { yield: "6 servings" })] }, 100);
    expect(m).toMatchObject({ added: 1, updated: 0, unchanged: 0, archived: 0 });
    expect(m.writes[0]).toMatchObject({ id: "nyt-1", source: "nyt", servings: 6, makesLeftovers: true, archived: false, addedAt: 100 });
    expect(m.info).toMatchObject({ at: 100, total: 1, added: 1, via: "button" });
  });
  it("leaves unchanged recipes alone and keeps app-owned fields", () => {
    const prev = rec("nyt-1", { makesLeftovers: false, servings: 8, yield: "8 servings" });
    const same = mergeImport({ "nyt-1": prev }, { via: "weekly", recipes: [imp("nyt-1", { yield: "8 servings" })] }, 200);
    expect(same).toMatchObject({ unchanged: 1, writes: [] });
    const changed = mergeImport({ "nyt-1": prev }, { via: "weekly", recipes: [imp("nyt-1", { title: "New title", yield: "8 servings" })] }, 200);
    expect(changed.updated).toBe(1);
    expect(changed.writes[0]).toMatchObject({ title: "New title", makesLeftovers: false, addedAt: 1, updatedAt: 200 });
  });
  it("never wipes ingredients with an empty re-read", () => {
    const m = mergeImport({ "nyt-1": rec("nyt-1", { ingredients: ["2 eggs"] }) }, { via: "button", recipes: [imp("nyt-1", { title: "X", ingredients: [] })] });
    expect(m.writes[0].ingredients).toEqual(["2 eggs"]);
  });
  it("archives recipes no longer in the box, and brings back re-saved ones", () => {
    const existing = { "nyt-1": rec("nyt-1"), "nyt-2": rec("nyt-2"), "nyt-3": rec("nyt-3", { archived: true }), "nyt-4": rec("nyt-4"), "nyt-5": rec("nyt-5"), "my-1": { ...rec("my-1"), source: "manual" as const } };
    const m = mergeImport(existing, { via: "button", complete: true, boxIds: ["nyt-1", "nyt-3", "nyt-4", "nyt-5"], recipes: [] });
    expect(m.archived).toBe(1);
    expect(m.writes.find(w => w.id === "nyt-2")?.archived).toBe(true);
    expect(m.writes.find(w => w.id === "nyt-3")?.archived).toBe(false);
    expect(m.writes.some(w => w.id === "my-1")).toBe(false);
  });
  it("refuses to archive a large share of the library from a half-loaded box", () => {
    const existing = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`nyt-${i}`, rec(`nyt-${i}`)]));
    const m = mergeImport(existing, { via: "button", complete: true, boxIds: ["nyt-0", "nyt-1"], recipes: [] });
    expect(m.archived).toBe(0);
    expect(m.archiveSkipped).toBe(18);
  });
  it("does not archive without complete", () => {
    expect(mergeImport({ "nyt-1": rec("nyt-1") }, { via: "button", recipes: [], boxIds: [] }).archived).toBe(0);
  });
  it("never overwrites manual recipes", () => {
    const m = mergeImport({ "nyt-1": { ...rec("nyt-1"), source: "manual" } }, { via: "button", recipes: [imp("nyt-1", { title: "x" })] });
    expect(m.writes).toEqual([]);
  });
  it("knownNytIds skips recipes without ingredients", () => {
    expect([...knownNytIds([rec("nyt-1"), rec("nyt-2", { ingredients: [] }), { ...rec("my-1"), source: "manual" }])]).toEqual(["nyt-1"]);
  });
});

describe("protocol", () => {
  it("sanitizes untrusted requests", () => {
    const r = sanitizeRequest({
      via: "weird", complete: "yes", total: 3.4, boxIds: ["nyt-1", "nyt-1", "bad", 5],
      recipes: [
        { id: "nyt-1", title: "  Ok  ", ingredients: ["a", 2, null, ""], url: "javascript:alert(1)", imageUrl: "http://insecure", totalMinutes: -5, servings: 4 },
        { id: "evil", title: "x" },
        { id: "nyt-2" },
      ],
    })!;
    expect(r.via).toBe("button");
    expect(r.complete).toBe(false);
    expect(r.total).toBe(3);
    expect(r.boxIds).toEqual(["nyt-1"]);
    expect(r.recipes).toHaveLength(1);
    expect(r.recipes[0]).toMatchObject({ id: "nyt-1", title: "Ok", ingredients: ["a", "2"], url: "https://cooking.nytimes.com/recipes/1", servings: 4 });
    expect(r.recipes[0].imageUrl).toBeUndefined();
    expect(r.recipes[0].totalMinutes).toBeUndefined();
    expect(sanitizeRequest({})).toBeUndefined();
  });
  it("chunks requests, keeping complete and boxIds on the last chunk", () => {
    const parts = chunkRequest({ via: "button", complete: true, boxIds: ["nyt-1"], recipes: Array.from({ length: 45 }, (_, i) => imp(`nyt-${i}`)) }, 20);
    expect(parts.map(p => p.recipes.length)).toEqual([20, 20, 5]);
    expect(parts.map(p => p.complete)).toEqual([false, false, true]);
    expect(parts[2].boxIds).toEqual(["nyt-1"]);
  });
  it("cleans numeric id lists", () => {
    expect(cleanNumericIds(["1", 2, "x", "1", "nyt-3"])).toEqual(["1", "2"]);
    expect(cleanNumericIds("nope")).toEqual([]);
  });
});
