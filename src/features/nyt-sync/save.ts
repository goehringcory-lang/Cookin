import { store } from "@shared/store";
import type { RecipeImportResponse } from "@shared/types";
import { mergeImport } from "./core/merge";
import type { NytImportRequest } from "./core/protocol";

export type SaveResult = RecipeImportResponse & { archiveSkipped?: number };

/**
 * Save an import: POST it to the server with this window's Cloudflare Access session, then pull.
 * Without a backend (plain `npm run dev`, demo mode) the same merge runs locally in the store.
 */
export async function saveImport(req: NytImportRequest): Promise<SaveResult> {
  if (store.remote) {
    const res = await fetch("/api/import/recipes", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (res.status === 401 || res.status === 403) throw new Error("You're signed out of Cookin. Reload this window to sign in, then sync again.");
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("json")) {
      const out = (await res.json()) as SaveResult;
      await store.pull();
      return out;
    }
    if (res.status !== 404 && ct.includes("json")) throw new Error(`Cookin couldn't save the recipes (error ${res.status}).`);
    // No API here (vite dev): fall through to a local merge.
  }
  const r = mergeImport(store.all("recipes"), req);
  store.putMany([...r.writes.map(w => ({ c: "recipes" as const, id: w.id, data: w })), { c: "meta", id: "nyt", data: r.info }]);
  return { added: r.added, updated: r.updated, unchanged: r.unchanged, archived: r.archived, archiveSkipped: r.archiveSkipped };
}
