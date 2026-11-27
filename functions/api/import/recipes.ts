import type { NytSyncInfo, Recipe, RecipeImportRequest, RecipeImportResponse, WireDoc } from "../../../src/shared/types";
import type { Env } from "../../_lib";
import { json, writeDocs } from "../../_lib";

/**
 * POST /api/import/recipes — NYT bookmark button and weekly Sunday sync.
 * Only source-owned fields are overwritten; fields Cory sets in the app (makesLeftovers, ...) are kept.
 * Owned by the NYT sync thread; the contract is in src/shared/types.ts.
 */
const SOURCE_FIELDS = ["title", "url", "ingredients", "steps", "totalMinutes", "yield", "servings", "tags", "imageUrl"] as const;

function clean(r: RecipeImportRequest["recipes"][number]): Partial<Recipe> | null {
  if (!r || typeof r.id !== "string" || !/^nyt-\d+$/.test(r.id) || typeof r.title !== "string" || !r.title.trim()) return null;
  const out: Partial<Recipe> = { title: r.title.trim().slice(0, 200) };
  if (typeof r.url === "string" && r.url.startsWith("https://")) out.url = r.url;
  if (Array.isArray(r.ingredients)) out.ingredients = r.ingredients.map(String).filter(Boolean).slice(0, 100);
  if (Array.isArray(r.steps)) out.steps = r.steps.map(String).filter(Boolean).slice(0, 60);
  if (Number.isFinite(r.totalMinutes) && r.totalMinutes! > 0) out.totalMinutes = Math.round(r.totalMinutes!);
  if (typeof r.yield === "string") out.yield = r.yield.slice(0, 80);
  const sv = Number.isFinite(r.servings) ? r.servings : Number((r.yield || "").match(/\d+/)?.[0]);
  if (sv && sv > 0 && sv < 100) out.servings = sv;
  if (Array.isArray(r.tags)) out.tags = r.tags.map(String).slice(0, 20);
  if (typeof r.imageUrl === "string" && r.imageUrl.startsWith("https://")) out.imageUrl = r.imageUrl;
  return out;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ error: "json_required" }, 415);
  let body: RecipeImportRequest;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!body || !Array.isArray(body.recipes)) return json({ error: "missing_recipes" }, 400);
  const now = Date.now();
  const { results } = await env.DB.prepare("SELECT id, data FROM docs WHERE c = 'recipes' AND data IS NOT NULL").all<{ id: string; data: string }>();
  const existing = new Map(results.map(r => [r.id, r.data]));
  const out: WireDoc[] = [];
  let added = 0, updated = 0, unchanged = 0, archived = 0;
  const seen = new Set<string>();
  for (const r of body.recipes.slice(0, 2000)) {
    const fields = clean(r);
    if (!fields) continue;
    seen.add(r.id);
    const prevRaw = existing.get(r.id);
    const prev = prevRaw ? (JSON.parse(prevRaw) as Recipe) : undefined;
    const next: Recipe = { ingredients: [], ...prev, ...fields, id: r.id, source: "nyt", archived: false, addedAt: prev?.addedAt ?? now, updatedAt: now } as Recipe;
    if (prev && !prev.archived && SOURCE_FIELDS.every(f => JSON.stringify(prev[f]) === JSON.stringify(next[f]))) { unchanged++; continue; }
    prev ? updated++ : added++;
    out.push({ c: "recipes", id: r.id, data: next, updatedAt: now });
  }
  if (body.complete) {
    for (const [id, raw] of existing) {
      if (seen.has(id) || !id.startsWith("nyt-")) continue;
      const prev = JSON.parse(raw) as Recipe;
      if (prev.archived) continue;
      archived++;
      out.push({ c: "recipes", id, data: { ...prev, archived: true, updatedAt: now }, updatedAt: now });
    }
  }
  const info: NytSyncInfo = { at: now, total: body.total ?? body.recipes.length, added, updated, archived, via: body.via === "weekly" ? "weekly" : "button", updatedAt: now };
  out.push({ c: "meta", id: "nyt", data: info, updatedAt: now });
  await writeDocs(env.DB, out);
  return json({ added, updated, unchanged, archived } satisfies RecipeImportResponse);
};
