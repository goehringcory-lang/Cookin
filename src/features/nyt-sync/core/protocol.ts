/**
 * Wire formats between the NYT bookmark button (running on cooking.nytimes.com) and Cookin.
 * Pure TypeScript, shared by the bookmarklet bundle, the app and the import endpoint.
 */
import type { RecipeImportRequest } from "../../../shared/types";

export const NYT_ORIGIN = "https://cooking.nytimes.com";
export const PROTOCOL_VERSION = 1;

/** One recipe as the button sends it (Recipe minus server-managed fields). */
export type ImportRecipe = RecipeImportRequest["recipes"][number];

/**
 * The import request with one optional extension: `boxIds` lists every recipe id currently saved in
 * the Recipe Box. The button only re-reads recipes Cookin doesn't have yet, so `recipes` is usually
 * a small subset; boxIds lets the server un-archive returning recipes and (when `complete`) archive
 * removed ones. Fully backwards compatible with RecipeImportRequest.
 */
export interface NytImportRequest extends RecipeImportRequest {
  boxIds?: string[];
}

/*
 * Hand-off protocol. The bookmark button on cooking.nytimes.com is a thin proxy: it finds the saved
 * recipe ids and fetches recipe pages with Cory's NYT session. Cookin (opened by the button) does the
 * parsing and saving, so parser fixes ship with the app and the bookmark never needs reinstalling.
 *
 *   app -> nyt  hello   (repeated every 500 ms until answered)
 *   nyt -> app  box     every saved recipe id
 *   app -> nyt  fetch   one recipe page            (many)
 *   nyt -> app  page    its JSON-LD blocks          (many)
 *   app -> nyt  status  progress text, final result
 *
 * Every message carries the nonce from the URL the button opened; both sides check origins.
 */
export interface HelloMessage { type: "cookin-hello"; nonce: string }
export interface BoxMessage { type: "cookin-box"; nonce: string; v: number; ids: string[]; via: "button" | "weekly" }
export interface FetchMessage { type: "cookin-fetch"; nonce: string; reqId: number; id: string }
export interface PageMessage { type: "cookin-page"; nonce: string; reqId: number; page: FetchedPage }
export interface StatusMessage {
  type: "cookin-status"; nonce: string;
  state: "reading" | "saving" | "done" | "error";
  text: string; n?: number; of?: number;
  result?: { added: number; updated: number; archived: number; total: number; failed: number };
}
export type SyncMessage = HelloMessage | BoxMessage | FetchMessage | PageMessage | StatusMessage;

/** What the button returns for one recipe page. */
export interface FetchedPage {
  status: number;
  /** Final URL after redirects. */
  url: string;
  /** Raw text of each <script type="application/ld+json"> block. */
  ld: string[];
  /** The page looked like a robot check. */
  blocked?: boolean;
}

/** What the "Copy instead" fallback puts on the clipboard; the app's paste box accepts it. */
export interface ClipboardPayload { cookin: 3; via: "button" | "weekly"; ids: string[]; pages: { id: string; page: FetchedPage }[] }

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
export const NYT_ID_RE = /^nyt-\d{1,12}$/;

/** Validate and clean one recipe from untrusted input. Returns undefined if unusable. */
export function sanitizeRecipe(x: unknown): ImportRecipe | undefined {
  if (!isObj(x) || typeof x.id !== "string" || !NYT_ID_RE.test(x.id) || typeof x.title !== "string") return undefined;
  const strs = (v: unknown, max: number, len: number) => Array.isArray(v) ? v.filter(s => typeof s === "string" || typeof s === "number").map(s => String(s).trim().slice(0, len)).filter(Boolean).slice(0, max) : undefined;
  const https = (v: unknown) => typeof v === "string" && /^https:\/\/[^\s"'<>]+$/.test(v) && v.length < 1000 ? v : undefined;
  const ingredients = strs(x.ingredients, 100, 300) ?? [];
  const minutes = typeof x.totalMinutes === "number" && Number.isFinite(x.totalMinutes) && x.totalMinutes > 0 && x.totalMinutes < 60 * 24 * 7 ? Math.round(x.totalMinutes) : undefined;
  const r: ImportRecipe = {
    id: x.id,
    title: x.title.trim().slice(0, 200) || "Untitled recipe",
    url: https(x.url)?.startsWith(NYT_ORIGIN + "/") ? (x.url as string) : `${NYT_ORIGIN}/recipes/${x.id.slice(4)}`,
    ingredients,
    steps: strs(x.steps, 60, 3000),
    totalMinutes: minutes,
    yield: typeof x.yield === "string" ? x.yield.trim().slice(0, 80) || undefined : undefined,
    tags: strs(x.tags, 20, 40),
    imageUrl: https(x.imageUrl),
  };
  if (typeof x.servings === "number" && Number.isFinite(x.servings) && x.servings > 0 && x.servings < 100) r.servings = Math.round(x.servings);
  return r;
}

/** Validate an import request body from untrusted input. */
export function sanitizeRequest(x: unknown): NytImportRequest | undefined {
  if (!isObj(x) || !Array.isArray(x.recipes)) return undefined;
  const recipes = x.recipes.slice(0, 2000).map(sanitizeRecipe).filter((r): r is ImportRecipe => !!r);
  const boxIds = Array.isArray(x.boxIds) ? [...new Set(x.boxIds.filter((s): s is string => typeof s === "string" && NYT_ID_RE.test(s)))].slice(0, 5000) : undefined;
  return {
    via: x.via === "weekly" ? "weekly" : "button",
    total: typeof x.total === "number" && Number.isFinite(x.total) ? Math.max(0, Math.round(x.total)) : undefined,
    complete: x.complete === true,
    recipes,
    boxIds,
  };
}

const msg = <T>(type: string) => (x: unknown): x is T => isObj(x) && x.type === type && typeof x.nonce === "string";
export const isHello = msg<HelloMessage>("cookin-hello");
export const isBox = (x: unknown): x is BoxMessage => msg<BoxMessage>("cookin-box")(x) && Array.isArray((x as BoxMessage).ids);
export const isFetch = (x: unknown): x is FetchMessage => msg<FetchMessage>("cookin-fetch")(x) && typeof (x as FetchMessage).reqId === "number" && typeof (x as FetchMessage).id === "string";
export const isPage = (x: unknown): x is PageMessage => msg<PageMessage>("cookin-page")(x) && isObj((x as PageMessage).page);
export const isStatus = msg<StatusMessage>("cookin-status");

/** Clean a list of NYT numeric ids ("1017518") from untrusted input. */
export const cleanNumericIds = (x: unknown): string[] =>
  Array.isArray(x) ? [...new Set(x.map(String).filter(s => /^\d{1,12}$/.test(s)))].slice(0, 5000) : [];

/** Split a request into chunks of `size` recipes. Only the last chunk carries `complete` and boxIds. */
export function chunkRequest(req: NytImportRequest, size = 20): NytImportRequest[] {
  const n = Math.max(1, Math.ceil(req.recipes.length / size));
  return Array.from({ length: n }, (_, i) => ({
    ...req,
    recipes: req.recipes.slice(i * size, (i + 1) * size),
    complete: i === n - 1 ? req.complete : false,
    boxIds: i === n - 1 ? req.boxIds : undefined,
  }));
}
