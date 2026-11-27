import { describe, expect, it } from "vitest";
import { readRecipes } from "../core/read";
import type { FetchedPage } from "../core/protocol";
import { jsonLdTexts } from "../core/jsonld";
import { pageHtml, panzanella } from "./fixtures/pages";

const ok = (id: string): FetchedPage => ({ status: 200, url: `https://cooking.nytimes.com/recipes/${id}-x`, ld: jsonLdTexts(pageHtml({ ...panzanella, name: `R${id}` })) });
const empty = (id: string): FetchedPage => ({ status: 200, url: `https://cooking.nytimes.com/recipes/${id}`, ld: [] });

describe("readRecipes", () => {
  it("reads pages and reports progress", async () => {
    const seen: number[] = [];
    const r = await readRecipes(["1", "2", "3"], async id => (id === "2" ? empty(id) : ok(id)), n => seen.push(n), { delayMs: 0 });
    expect(r.recipes.map(x => x.id).sort()).toEqual(["nyt-1", "nyt-3"]);
    expect(r.failed).toEqual(["2"]);
    expect(r.stopped).toBeUndefined();
    expect(seen.sort()).toEqual([1, 2, 3]);
  });
  it("stops when signed out (many empty pages before any success)", async () => {
    const r = await readRecipes(Array.from({ length: 20 }, (_, i) => String(i + 1)), async id => empty(id), undefined, { delayMs: 0, concurrency: 1 });
    expect(r.stopped).toMatch(/signed in/);
    expect(r.failed.length).toBe(5);
  });
  it("stops on rate limiting and robot checks", async () => {
    const limited = await readRecipes(["1", "2", "3"], async id => (id === "1" ? ok(id) : { status: 429, url: "", ld: [] }), undefined, { delayMs: 0, concurrency: 1 });
    expect(limited.recipes).toHaveLength(1);
    expect(limited.stopped).toMatch(/slow down/);
    const blocked = await readRecipes(["1"], async () => ({ status: 200, url: "", ld: [], blocked: true }), undefined, { delayMs: 0 });
    expect(blocked.stopped).toMatch(/robot/);
  });
  it("survives fetch errors", async () => {
    const r = await readRecipes(["1", "2"], async id => { if (id === "1") throw new Error("x"); return ok(id); }, undefined, { delayMs: 0, concurrency: 1 });
    expect(r.failed).toEqual(["1"]);
    expect(r.recipes).toHaveLength(1);
  });
});
