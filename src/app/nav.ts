/**
 * Tiny hash router. Routes:
 *   #home  #list  #kitchen  #recipes  #recipe/<id>  #onboarding  #settings
 * Use navigate("recipe/nyt-123") or <a href="#recipe/nyt-123">.
 */
import { useSyncExternalStore } from "react";

export type Route = { name: string; param?: string };
export const parseRoute = (hash: string): Route => {
  const h = hash.replace(/^#\/?/, "");
  const [name, ...rest] = h.split("/");
  return { name: name || "home", param: rest.length ? decodeURIComponent(rest.join("/")) : undefined };
};
export const navigate = (path: string) => { location.hash = path; };
const sub = (fn: () => void) => { window.addEventListener("hashchange", fn); return () => window.removeEventListener("hashchange", fn); };
export const useRoute = (): Route => { const h = useSyncExternalStore(sub, () => location.hash); return parseRoute(h); };
