import type { CollectionName, WireDoc } from "../src/shared/types";
import { COLLECTIONS } from "../src/shared/types";

export interface Env {
  DB: D1Database;
  /** Comma-separated emails allowed in (Cory's). */
  ALLOWED_EMAILS?: string;
  /** Cloudflare Access team domain, e.g. "cory.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** Cloudflare Access application audience (AUD) tag. */
  ACCESS_AUD?: string;
  /** Bearer token for automation (weekly NYT sync). */
  API_TOKEN?: string;
  /** "1" only in local dev: skip auth. */
  DEV_ALLOW_ANON?: string;
}

export const json = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const isCollection = (c: unknown): c is CollectionName => typeof c === "string" && (COLLECTIONS as string[]).includes(c);
const ID_RE = /^[A-Za-z0-9_\-.:~@+]{1,200}$/;
export const isId = (id: unknown): id is string => typeof id === "string" && ID_RE.test(id);

/** Max docs per writeDocs call (one D1 batch). */
export const WRITE_CHUNK = 100;

/**
 * Upsert docs with last-writer-wins on updated_at, in ONE D1 batch (a transaction): the sequence
 * bump and the inserts commit together, so a reader can never see a cursor past rows that
 * haven't landed yet. updatedAt is clamped to server time + 60 s so a fast clock can't win forever.
 * Returns how many docs changed.
 */
export async function writeDocs(db: D1Database, docs: WireDoc[]): Promise<number> {
  let changed = 0;
  for (let i = 0; i < docs.length; i += WRITE_CHUNK) {
    const chunk = docs.slice(i, i + WRITE_CHUNK);
    const n = chunk.length;
    const maxAt = Date.now() + 60_000;
    const bump = db.prepare("UPDATE seq SET n = n + ?1 WHERE k = 'docs'").bind(n);
    const ins = db.prepare(
      `INSERT INTO docs (c, id, data, updated_at, v)
       VALUES (?1, ?2, ?3, ?4, (SELECT n FROM seq WHERE k = 'docs') - ?5)
       ON CONFLICT (c, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, v = excluded.v
       WHERE excluded.updated_at >= docs.updated_at`
    );
    const res = await db.batch([bump, ...chunk.map((d, j) =>
      ins.bind(d.c, d.id, d.data == null ? null : JSON.stringify(d.data), Math.min(Math.floor(d.updatedAt), maxAt), n - 1 - j))]);
    changed += res.slice(1).reduce((s, r) => s + (r.meta.changes || 0), 0);
  }
  return changed;
}

export const currentCursor = async (db: D1Database) =>
  (await db.prepare("SELECT n FROM seq WHERE k = 'docs'").first<{ n: number }>())?.n ?? 0;
