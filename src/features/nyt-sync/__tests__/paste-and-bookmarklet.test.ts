import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { parsePaste } from "../paste";
import { jsonLdTexts } from "../core/jsonld";
import { pageHtml, panzanella } from "./fixtures/pages";
import { BOOKMARKLET_CODE, BOOKMARKLET_PLACEHOLDER } from "../bookmarklet.generated";

describe("parsePaste", () => {
  it("parses the button's Copy format", () => {
    const text = JSON.stringify({ cookin: 3, via: "button", ids: ["1017518", "2"], pages: [
      { id: "1017518", page: { status: 200, url: "", ld: jsonLdTexts(pageHtml(panzanella)) } },
      { id: "2", page: { status: 200, url: "", ld: [] } },
    ] });
    const p = parsePaste(text)!;
    expect(p.failed).toBe(1);
    expect(p.request.recipes.map(r => r.id)).toEqual(["nyt-1017518"]);
    expect(p.request.boxIds).toEqual(["nyt-1017518", "nyt-2"]);
    expect(p.request.complete).toBe(true);
  });
  it("parses the first prototype's format", () => {
    const p = parsePaste(JSON.stringify({ cookin: 1, total: 1, recipes: [{ id: "nyt-5", url: "https://cooking.nytimes.com/recipes/5", title: "T", ing: ["1 egg"], cat: "Dinner, Easy" }] }))!;
    expect(p.request.recipes[0]).toMatchObject({ id: "nyt-5", ingredients: ["1 egg"], tags: ["dinner", "easy"] });
  });
  it("rejects junk", () => {
    expect(parsePaste("hello")).toBeUndefined();
    expect(parsePaste("{}")).toBeUndefined();
  });
});

describe("bookmarklet bundle", () => {
  it("is built from the current source", () => {
    execFileSync("node", ["tools/bookmarklet/build.mjs", "--check"], { stdio: "pipe" });
  });
  it("has the app-origin placeholder and stays small", () => {
    expect(BOOKMARKLET_CODE).toContain(BOOKMARKLET_PLACEHOLDER);
    expect(BOOKMARKLET_CODE.length).toBeLessThan(20_000);
  });
});
