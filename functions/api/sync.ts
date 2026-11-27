import type { SyncPullResponse, SyncPushRequest, SyncPushResponse, WireDoc } from "../../src/shared/types";
import type { Env } from "../_lib";
import { isCollection, isId, json, writeDocs } from "../_lib";

/** GET /api/sync?since=<cursor>  -> every doc changed after the cursor (tombstones have data: null). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const since = Math.max(0, Number(new URL(request.url).searchParams.get("since")) || 0);
  const { results } = await env.DB.prepare("SELECT c, id, data, updated_at, v FROM docs WHERE v > ?1 ORDER BY v LIMIT 5000")
    .bind(since).all<{ c: string; id: string; data: string | null; updated_at: number; v: number }>();
  const docs: WireDoc[] = results.map(r => ({ c: r.c as WireDoc["c"], id: r.id, data: r.data == null ? null : JSON.parse(r.data), updatedAt: r.updated_at, v: r.v }));
  const cursor = docs.length ? docs[docs.length - 1].v! : since;
  return json({ docs, cursor } satisfies SyncPullResponse);
};

/** POST /api/sync {changes: WireDoc[]} -> last-writer-wins upsert. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: SyncPushRequest;
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const changes = Array.isArray(body?.changes) ? body.changes : [];
  if (changes.length > 500) return json({ error: "too_many_changes" }, 413);
  const valid = changes.filter(d => isCollection(d.c) && isId(d.id) && Number.isFinite(d.updatedAt) && (d.data === null || typeof d.data === "object"));
  if (valid.length !== changes.length) return json({ error: "invalid_change" }, 400);
  const applied = await writeDocs(env.DB, valid);
  const row = await env.DB.prepare("SELECT n FROM seq WHERE k = 'docs'").first<{ n: number }>();
  return json({ cursor: row?.n ?? 0, applied } satisfies SyncPushResponse);
};
