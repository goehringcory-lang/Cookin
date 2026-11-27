import type { Recipe, RecipeImportRequest, RecipeImportResponse, WireDoc } from "../../../src/shared/types";
import type { Env } from "../../_lib";
import { json, writeDocs } from "../../_lib";

/**
 * POST /api/import/recipes — used by the NYT bookmark button and the weekly Sunday sync.
 * Owned by the NYT sync module; the lead keeps the contract in src/shared/types.ts.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: RecipeImportRequest;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  if (!body || !Array.isArray(body.recipes)) return json({ error: "missing_recipes" }, 400);
  const now = Date.now();
  const { results } = await env.DB.prepare("SELECT id, data FROM docs WHERE c = 'recipes' AND data IS NOT NULL").all<{ id: string; data: string }>();
  const existing = new Map(results.map(r => [r.id, JSON.parse(r.data) as Recipe]));
  const out: WireDoc[] = [];
  let added = 0, updated = 0, unchanged = 0, archived = 0;
  const seen = new Set<string>();
  for (const r of body.recipes.slice(0, 2000)) {
    if (!r || typeof r.id !== "string" || !/^nyt-\d+$/.test(r.id) || typeof r.title !== "string") continue;
    seen.add(r.id);
    const prev = existing.get(r.id);
    const next: Recipe = {
      ...(prev || {}),
      id: r.id, source: "nyt", title: r.title.slice(0, 200),
      url: typeof r.url === "string" && r.url.startsWith("https://") ? r.url : undefined,
      ingredients: (Array.isArray(r.ingredients) ? r.ingredients : []).map(String).slice(0, 100),
      steps: Array.isArray(r.steps) ? r.steps.map(String).slice(0, 60) : prev?.steps,
      totalMinutes: Number.isFinite(r.totalMinutes) ? r.totalMinutes : prev?.totalMinutes,
      yield: typeof r.yield === "string" ? r.yield.slice(0, 80) : prev?.yield,
      tags: Array.isArray(r.tags) ? r.tags.map(String).slice(0, 20) : prev?.tags,
      imageUrl: typeof r.imageUrl === "string" && r.imageUrl.startsWith("https://") ? r.imageUrl : prev?.imageUrl,
      archived: false,
      addedAt: prev?.addedAt ?? now, updatedAt: now,
    };
    const same = prev && JSON.stringify({ ...prev, updatedAt: 0 }) === JSON.stringify({ ...next, updatedAt: 0 });
    if (same) { unchanged++; continue; }
    prev ? updated++ : added++;
    out.push({ c: "recipes", id: r.id, data: next, updatedAt: now });
  }
  if (body.complete) {
    for (const [id, prev] of existing) if (prev.source === "nyt" && !seen.has(id) && !prev.archived) {
      archived++;
      out.push({ c: "recipes", id, data: { ...prev, archived: true, updatedAt: now }, updatedAt: now });
    }
  }
  for (let i = 0; i < out.length; i += 200) await writeDocs(env.DB, out.slice(i, i + 200));
  // record the run in settings
  const s = await env.DB.prepare("SELECT data FROM docs WHERE c = 'settings' AND id = 'app'").first<{ data: string | null }>();
  const settings = s?.data ? JSON.parse(s.data) : { onboardingComplete: false, dinnersPerWeek: 7, householdSize: 3, weekStartsOn: 1 };
  settings.lastNytSync = { at: now, total: body.total ?? body.recipes.length, added, via: body.via === "weekly" ? "weekly" : "button" };
  settings.updatedAt = now;
  await writeDocs(env.DB, [{ c: "settings", id: "app", data: settings, updatedAt: now }]);
  return json({ added, updated, unchanged, archived } satisfies RecipeImportResponse);
};
