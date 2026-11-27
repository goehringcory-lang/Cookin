import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { store } from "@shared/store";
import "@styles/base.css";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

/**
 * Demo mode (VITE_DEMO=1 at build time, or ?demo=1 in the URL): never talks to the server and
 * loads src/seed (if present) so e2e tests and screenshots are deterministic.
 * The seed module must export `seedDocs: { c: CollectionName; id: string; data: unknown }[]`.
 */
async function boot() {
  const demo = import.meta.env.VITE_DEMO === "1" || new URLSearchParams(location.search).has("demo");
  if (demo) {
    store.useDemo();
    const mods = import.meta.glob("./seed/index.ts");
    const load = mods["./seed/index.ts"];
    if (load) { const m = (await load()) as { seedDocs?: { c: never; id: string; data: unknown }[] }; if (m.seedDocs) store.replaceAll(m.seedDocs); }
  }
  store.start();
  if (!demo) registerServiceWorker();
  createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
}
boot();
