import type { Recipe, RecipeImportResponse, WireDoc } from "../../../src/shared/types";
import { mergeImport } from "../../../src/features/nyt-sync/core/merge";
import { sanitizeRequest } from "../../../src/features/nyt-sync/core/protocol";
import type { Env } from "../../_lib";
import { json, writeDocs } from "../../_lib";

/**
 * POST /api/import/recipes — NYT bookmark button and weekly Sunday sync (owned by the NYT sync thread).
 *
 * Body: RecipeImportRequest, optionally with `boxIds` (every recipe id in the Recipe Box; see
 * NytImportRequest). The button only sends recipes Cookin doesn't have yet plus boxIds, so the server
 * can un-archive re-saved recipes and archive unsaved ones without re-reading every page.
 * Only source-owned fields are overwritten (src/features/nyt-sync/core/merge.ts); app-owned fields
 * such as makesLeftovers are kept. Writes recipes plus `meta/nyt` (NytSyncInfo).
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ error: "json_required" }, 415);
  let raw: unknown;
  try { raw = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const body = sanitizeRequest(raw);
  if (!body) return json({ error: "missing_recipes" }, 400);
  const { results } = await env.DB.prepare("SELECT id, data FROM docs WHERE c = 'recipes' AND data IS NOT NULL").all<{ id: string; data: string }>();
  const existing = new Map<string, Recipe>();
  for (const r of results) { try { existing.set(r.id, JSON.parse(r.data) as Recipe); } catch { /* skip corrupt row */ } }
  const now = Date.now();
  const m = mergeImport(existing, body, now);
  const out: WireDoc[] = m.writes.map(r => ({ c: "recipes", id: r.id, data: r, updatedAt: now }));
  out.push({ c: "meta", id: "nyt", data: m.info, updatedAt: now });
  await writeDocs(env.DB, out);
  const res: RecipeImportResponse & { archiveSkipped?: number } = { added: m.added, updated: m.updated, unchanged: m.unchanged, archived: m.archived };
  if (m.archiveSkipped) res.archiveSkipped = m.archiveSkipped;
  return json(res);
};
