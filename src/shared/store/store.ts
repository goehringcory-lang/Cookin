/**
 * Local-first document store with background sync to /api/sync.
 *
 * - Every read is synchronous from memory (persisted to localStorage), so the app works offline
 *   and in `npm run dev` without a backend ("local mode").
 * - Writes apply locally at once, queue, and push to the server; pulls run on start, on focus,
 *   and every 30 s. Conflicts resolve last-writer-wins by updatedAt (per document).
 * - Feature code should use the hooks in ./hooks.ts or the typed helpers in ../domain.
 */
import type { CollectionName, Collections, SyncPullResponse, SyncPushResponse, WireDoc } from "../types";
import { COLLECTIONS } from "../types";

type Docs = { [C in CollectionName]: Record<string, Collections[C]> };
type Meta = Record<string, number>; // `${c}/${id}` -> updatedAt
export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "unauthorized";
/** Network fetch options: Access answers an expired session with a cross-origin redirect. */
const FETCH: RequestInit = { credentials: "include", redirect: "manual" };
const isAuthFail = (r: Response) => r.type === "opaqueredirect" || r.status === 401 || r.status === 403;

const LS_KEY = "cookin:v1";
const DEMO_KEY = "cookin:demo";
const emptyDocs = (): Docs => Object.fromEntries(COLLECTIONS.map(c => [c, {}])) as unknown as Docs;

class Store {
  private docs: Docs = emptyDocs();
  private meta: Meta = {};
  private queue = new Map<string, WireDoc>();
  private cursor = 0;
  private listeners = new Set<() => void>();
  private version = 0;
  status: SyncStatus = "local";
  private pulling = false;
  private pushTimer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  /** False in demo mode/tests: never talks to the server and uses a separate storage key. */
  remote = true;
  /** True after a localStorage write failed (quota). The shell shows a warning. */
  storageError = false;
  private key = LS_KEY;

  constructor() {
    this.load();
    if (typeof window !== "undefined") window.addEventListener("pagehide", () => this.flushSave());
  }
  /** Switch to demo mode before start(): separate storage, no server. */
  useDemo() { this.remote = false; this.key = DEMO_KEY; this.docs = emptyDocs(); this.meta = {}; this.queue.clear(); this.cursor = 0; this.load(); }

  /* ----- reads ----- */
  get<C extends CollectionName>(c: C, id: string): Collections[C] | undefined { return this.docs[c][id]; }
  all<C extends CollectionName>(c: C): Record<string, Collections[C]> { return this.docs[c]; }
  list<C extends CollectionName>(c: C): Collections[C][] { return Object.values(this.docs[c]); }
  getVersion() { return this.version; }

  /* ----- writes ----- */
  put<C extends CollectionName>(c: C, id: string, data: Collections[C]) { this.putMany([{ c, id, data }]); }
  putMany(items: { c: CollectionName; id: string; data: unknown | null }[]) {
    const now = Date.now();
    for (const { c, id, data } of items) {
      const k = c + "/" + id;
      const at = Math.max(now, (this.meta[k] || 0) + 1);
      this.setDoc(c, id, data);
      this.meta[k] = at;
      this.queue.set(k, { c, id, data: data ?? null, updatedAt: at });
    }
    this.changed();
    this.schedulePush();
  }
  /** Shallow-merge fields into an existing doc (creates it if missing). */
  patch<C extends CollectionName>(c: C, id: string, fields: Partial<Collections[C]>) {
    const cur = this.docs[c][id] as object | undefined;
    this.put(c, id, { ...(cur || {}), ...fields, updatedAt: Date.now() } as Collections[C]);
  }
  remove(c: CollectionName, id: string) { this.putMany([{ c, id, data: null }]); }

  /** Immutable update so React snapshots change identity per collection. */
  private setDoc(c: CollectionName, id: string, data: unknown | null) {
    const next = { ...(this.docs[c] as Record<string, unknown>) };
    if (data == null) delete next[id]; else next[id] = data;
    (this.docs as Record<string, unknown>)[c] = next;
  }

  /** Replace all local data (demo/seed/tests). Does not push. */
  replaceAll(docs: { c: CollectionName; id: string; data: unknown }[]) {
    if (this.remote) throw new Error("replaceAll is for demo mode only; call store.useDemo() first");
    this.docs = emptyDocs(); this.meta = {}; this.queue.clear(); this.cursor = 0;
    for (const d of docs) this.setDoc(d.c, d.id, d.data);
    this.changed();
  }

  /* ----- subscriptions ----- */
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private changed() { this.version++; this.save(); this.listeners.forEach(f => f()); }

  /* ----- sync ----- */
  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    if (!this.remote) { this.setStatus("local"); return; }
    this.pull();
    window.addEventListener("focus", () => this.pull());
    window.addEventListener("online", () => { this.pull(); this.schedulePush(0); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") this.pull(); });
    setInterval(() => { if (document.visibilityState === "visible") this.pull(); }, 30_000);
  }
  private setStatus(s: SyncStatus) { if (this.status !== s) { this.status = s; this.listeners.forEach(f => f()); } }
  private schedulePush(delay = 400) {
    if (!this.remote || !this.started) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.push(), delay);
  }
  async push() {
    if (!this.remote || !this.queue.size) return;
    const batch = [...this.queue.values()].slice(0, 400);
    try {
      this.setStatus("syncing");
      const res = await fetch("/api/sync", { ...FETCH, method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changes: batch }) });
      if (isAuthFail(res)) return this.setStatus("unauthorized");
      if (!res.ok) throw new Error(String(res.status));
      const out = (await res.json()) as SyncPushResponse;
      if (out.rejected?.length) console.warn("cookin: server rejected", out.rejected.map(i => batch[i]));
      // Accepted and rejected changes both leave the queue; a rejected change would never succeed.
      for (const d of batch) { const k = d.c + "/" + d.id; if (this.queue.get(k)?.updatedAt === d.updatedAt) this.queue.delete(k); }
      this.save();
      this.setStatus("synced");
      if (this.queue.size) this.schedulePush(0); else this.pull();
    } catch {
      this.setStatus(navigator.onLine ? "local" : "offline");
      this.schedulePush(15_000);
    }
  }
  async pull() {
    if (!this.remote || this.pulling) return;
    this.pulling = true;
    try {
      for (let guard = 0; guard < 20; guard++) {
        const res = await fetch("/api/sync?since=" + this.cursor, FETCH);
        if (isAuthFail(res)) { this.setStatus("unauthorized"); return; }
        const ct = res.headers.get("content-type") || "";
        if (!res.ok || !ct.includes("json")) { this.setStatus("local"); return; } // no backend (vite dev)
        const body = (await res.json()) as SyncPullResponse;
        let touched = false;
        for (const d of body.docs) {
          if (!(COLLECTIONS as string[]).includes(d.c)) continue;
          const k = d.c + "/" + d.id;
          const pending = this.queue.get(k);
          if (pending && pending.updatedAt > d.updatedAt) continue; // our unsent edit is newer
          if ((this.meta[k] || 0) > d.updatedAt) continue;
          this.setDoc(d.c, d.id, d.data);
          this.meta[k] = d.updatedAt; touched = true;
        }
        this.cursor = body.cursor;
        if (touched) this.changed(); else this.save();
        if (!body.more) break;
      }
      this.setStatus(this.queue.size ? "syncing" : "synced");
      if (this.queue.size) this.schedulePush(0);
    } catch {
      this.setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "local");
    } finally { this.pulling = false; }
  }

  /* ----- persistence ----- */
  private load() {
    try {
      const raw = typeof localStorage !== "undefined" && localStorage.getItem(this.key);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.docs = Object.assign(emptyDocs(), s.docs || {});
      this.meta = s.meta || {}; this.cursor = s.cursor || 0;
      for (const d of (s.queue || []) as WireDoc[]) this.queue.set(d.c + "/" + d.id, d);
    } catch { /* start empty */ }
  }
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 150);
  }
  private flushSave() {
    clearTimeout(this.saveTimer);
    try {
      localStorage.setItem(this.key, JSON.stringify({ docs: this.docs, meta: this.meta, cursor: this.cursor, queue: [...this.queue.values()] }));
      if (this.storageError) { this.storageError = false; this.listeners.forEach(f => f()); }
    } catch {
      if (!this.storageError) { this.storageError = true; this.listeners.forEach(f => f()); }
    }
  }
}

export const store = new Store();
