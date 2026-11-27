/**
 * Merge an NYT import into the existing recipes. Pure: used by the server endpoint
 * (functions/api/import/recipes.ts) and by the app when it runs without a backend.
 *
 * Only source-owned fields are overwritten. Fields Cory sets in the app (makesLeftovers, ...) are
 * kept, except that makesLeftovers gets a first guess from servings when it was never set.
 */
import type { NytSyncInfo, Recipe, RecipeImportResponse } from "../../../shared/types";
import type { ImportRecipe, NytImportRequest } from "./protocol";
import { servingsFromYield } from "./jsonld";

export const SOURCE_FIELDS = ["title", "url", "ingredients", "steps", "totalMinutes", "yield", "servings", "tags", "imageUrl"] as const;

/** A recipe "makes leftovers" when it serves at least this many (family of 3 plus a lunch). */
export const LEFTOVER_SERVINGS = 5;

export interface MergeResult extends RecipeImportResponse {
  /** Recipes to write (new or changed). */
  writes: Recipe[];
  /** The `meta/nyt` document to write. */
  info: NytSyncInfo;
  /** Set when `complete` would archive an implausible number of recipes, so none were archived. */
  archiveSkipped?: number;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function sourceFields(r: ImportRecipe, prev?: Recipe): Partial<Recipe> {
  const servings = r.servings ?? servingsFromYield(r.yield);
  const f: Partial<Recipe> = {
    title: r.title,
    url: r.url ?? prev?.url,
    // Never wipe good data with an empty re-read (paywall, signed-out page).
    ingredients: r.ingredients?.length ? r.ingredients : prev?.ingredients ?? [],
    steps: r.steps ?? prev?.steps,
    totalMinutes: r.totalMinutes ?? prev?.totalMinutes,
    yield: r.yield ?? prev?.yield,
    servings: servings ?? prev?.servings,
    tags: r.tags ?? prev?.tags,
    imageUrl: r.imageUrl ?? prev?.imageUrl,
  };
  for (const k of SOURCE_FIELDS) if (f[k] === undefined) delete f[k];
  return f;
}

export function mergeImport(existing: Map<string, Recipe> | Record<string, Recipe>, req: NytImportRequest, now = Date.now()): MergeResult {
  const prevById = existing instanceof Map ? existing : new Map(Object.entries(existing));
  const writes: Recipe[] = [];
  let added = 0, updated = 0, unchanged = 0, archived = 0;
  const seen = new Set<string>();

  for (const r of req.recipes) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const prev = prevById.get(r.id);
    if (prev && (prev.source !== "nyt" || prev.removed)) continue;
    const fields = sourceFields(r, prev);
    const next = { ...prev, ...fields, id: r.id, source: "nyt", archived: false, addedAt: prev?.addedAt ?? now, updatedAt: now } as Recipe;
    if (next.makesLeftovers === undefined && next.servings) next.makesLeftovers = next.servings >= LEFTOVER_SERVINGS;
    for (const k of SOURCE_FIELDS) if (!(k in fields)) delete next[k];
    if (prev && !prev.archived && SOURCE_FIELDS.every(k => same(prev[k], next[k])) && prev.makesLeftovers === next.makesLeftovers) { unchanged++; continue; }
    if (prev) updated++; else added++;
    writes.push(next);
  }

  const box = req.boxIds ? new Set(req.boxIds) : undefined;
  // A recipe saved again after being removed comes back without a re-read.
  if (box) for (const id of box) {
    const prev = prevById.get(id);
    if (prev?.archived && prev.source === "nyt" && !prev.removed && !seen.has(id)) { writes.push({ ...prev, archived: false, updatedAt: now }); updated++; }
  }

  let archiveSkipped: number | undefined;
  if (req.complete) {
    const inBox = box ?? seen;
    const active = [...prevById.values()].filter(p => p.source === "nyt" && !p.archived && p.addedVia !== "link");
    const gone = active.filter(p => !inBox.has(p.id));
    // A half-loaded Recipe Box page must not archive half the library.
    if (gone.length > 3 && gone.length > active.length * 0.25) archiveSkipped = gone.length;
    else for (const p of gone) { writes.push({ ...p, archived: true, updatedAt: now }); archived++; }
  }
  const info: NytSyncInfo = {
    at: now, total: req.total ?? box?.size ?? req.recipes.length, added, updated, archived,
    via: req.via === "weekly" ? "weekly" : "button", updatedAt: now,
  };
  return { added, updated, unchanged, archived, writes, info, ...(archiveSkipped ? { archiveSkipped } : {}) };
}

/** Ids the app already has with ingredients; the button skips re-reading these. */
export function knownNytIds(recipes: Iterable<Recipe>): Set<string> {
  const out = new Set<string>();
  for (const r of recipes) if (r.source === "nyt" && r.ingredients?.length) out.add(r.id);
  return out;
}
