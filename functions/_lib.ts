import type { CollectionName, WireDoc } from "../src/shared/types";
import { COLLECTIONS } from "../src/shared/types";

export interface Env {
  DB: D1Database;
  ALLOWED_EMAILS?: string;
  API_TOKEN?: string;
  DEV_ALLOW_ANON?: string;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const isCollection = (c: unknown): c is CollectionName => typeof c === "string" && (COLLECTIONS as string[]).includes(c);
const ID_RE = /^[A-Za-z0-9_\-.:~@+]{1,200}$/;
export const isId = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);

/** Reserve n sequence numbers; returns the first. */
export async function reserveSeq(db: D1Database, n: number): Promise<number> {
  const row = await db.prepare("UPDATE seq SET n = n + ?1 WHERE k = 'docs' RETURNING n").bind(n).first<{ n: number }>();
  if (!row) throw new Error("seq table missing: run migrations");
  return row.n - n + 1;
}

/** Upsert docs with last-writer-wins on updated_at. Returns how many rows changed. */
export async function writeDocs(db: D1Database, docs: WireDoc[]): Promise<number> {
  if (!docs.length) return 0;
  const first = await reserveSeq(db, docs.length);
  const stmt = db.prepare(
    `INSERT INTO docs (c, id, data, updated_at, v) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (c, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, v = excluded.v
     WHERE excluded.updated_at >= docs.updated_at`
  );
  const res = await db.batch(docs.map((d, i) => stmt.bind(d.c, d.id, d.data == null ? null : JSON.stringify(d.data), Math.floor(d.updatedAt), first + i)));
  return res.reduce((n, r) => n + (r.meta.changes || 0), 0);
}
