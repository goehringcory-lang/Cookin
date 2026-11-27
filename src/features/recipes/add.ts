/** Add, remove and restore recipes in Cory's library (Recipes tab). */
import { store } from "@shared/store";
import type { Recipe } from "@shared/types";
import { LEFTOVER_SERVINGS } from "../nyt-sync/core/merge";
import type { ImportRecipe } from "../nyt-sync/core/protocol";
import type { ReadPage } from "../nyt-sync/core/link";

export type FetchResult =
  | ReadPage
  | { ok: false; reason: "blocked" | "unreachable" | "offline" | "signed_out" | "bad_url"; status?: number; title?: string; imageUrl?: string };

/** Ask the server to read a recipe link. Never throws: failures come back as {ok: false, reason}. */
export async function fetchRecipe(url: string): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetch("/api/recipes/fetch", {
      method: "POST", credentials: "include", redirect: "manual",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (res.type === "opaqueredirect" || res.status === 401 || res.status === 403) return { ok: false, reason: "signed_out" };
  if (res.status === 400) return { ok: false, reason: "bad_url" };
  const ct = res.headers.get("content-type") || "";
  if (!res.ok || !ct.includes("json")) return { ok: false, reason: "unreachable", status: res.status };
  try { return (await res.json()) as FetchResult; } catch { return { ok: false, reason: "unreachable" }; }
}

/**
 * Save a recipe read from a link (or typed in) to the library. An existing copy keeps the fields
 * Cory set in the app (makesLeftovers) and comes back if it had been removed.
 */
export function saveRecipe(r: ImportRecipe, source: Recipe["source"]): Recipe {
  const prev = store.all("recipes")[r.id] as Recipe | undefined;
  const now = Date.now();
  const next: Recipe = {
    ...prev,
    ...stripUndefined(r),
    id: r.id,
    title: r.title || prev?.title || "Untitled recipe",
    source: prev?.source ?? source,
    ingredients: r.ingredients?.length ? r.ingredients : prev?.ingredients ?? [],
    archived: false,
    removed: false,
    addedVia: prev?.addedVia ?? "link",
    addedAt: prev && !prev.archived ? prev.addedAt : now,
    updatedAt: now,
  };
  if (next.makesLeftovers === undefined && next.servings) next.makesLeftovers = next.servings >= LEFTOVER_SERVINGS;
  store.put("recipes", r.id, next);
  return next;
}

/** Hide a recipe from the library, the planner and swaps. Kept so past plans still show its name. */
export function removeRecipe(id: string) {
  const prev = store.all("recipes")[id] as Recipe | undefined;
  if (prev) store.put("recipes", id, { ...prev, archived: true, removed: true, updatedAt: Date.now() });
}

export function restoreRecipe(id: string) {
  const prev = store.all("recipes")[id] as Recipe | undefined;
  if (prev) store.put("recipes", id, { ...prev, archived: false, removed: false, updatedAt: Date.now() });
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}
