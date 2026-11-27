import type { SyncPushResponse, WireDoc } from "../../src/shared/types";
import type { Env } from "../_lib";
import { currentCursor, isCollection, isId, json, writeDocs } from "../_lib";

const PAGE = 500;

/**
 * GET /api/sync?since=<cursor> -> { docs, cursor, more }. Tombstones have data: null.
 * The stored JSON strings are spliced into the response unparsed to stay inside the free-tier CPU budget.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const since = Math.max(0, Number(new URL(request.url).searchParams.get("since")) || 0);
  const { results } = await env.DB.prepare("SELECT c, id, data, updated_at, v FROM docs WHERE v > ?1 ORDER BY v LIMIT ?2")
    .bind(since, PAGE + 1).all<{ c: string; id: string; data: string | null; updated_at: number; v: number }>();
  const more = results.length > PAGE;
  const rows = more ? results.slice(0, PAGE) : results;
  const parts = rows.map(r => `{"c":${JSON.stringify(r.c)},"id":${JSON.stringify(r.id)},"data":${r.data ?? "null"},"updatedAt":${r.updated_at},"v":${r.v}}`);
  const cursor = rows.length ? rows[rows.length - 1].v : since;
  return json(`{"docs":[${parts.join(",")}],"cursor":${cursor},"more":${more}}`);
};

/** POST /api/sync {changes: WireDoc[]} -> LWW upsert. Invalid changes are skipped and reported, never block the batch. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(request.headers.get("content-type") || "").includes("application/json")) return json({ error: "json_required" }, 415);
  let body: { changes?: unknown };
  try { body = await request.json(); } catch { return json({ error: "bad_json" }, 400); }
  const changes = Array.isArray(body?.changes) ? (body.changes as WireDoc[]) : [];
  if (changes.length > 500) return json({ error: "too_many_changes" }, 413);
  const rejected: number[] = [];
  const valid: WireDoc[] = [];
  changes.forEach((d, i) => {
    const ok = d && isCollection(d.c) && isId(d.id) && Number.isFinite(d.updatedAt) && (d.data === null || (typeof d.data === "object" && !Array.isArray(d.data)));
    if (ok) valid.push(d); else rejected.push(i);
  });
  const applied = await writeDocs(env.DB, valid);
  return json({ cursor: await currentCursor(env.DB), applied, rejected } satisfies SyncPushResponse);
};
