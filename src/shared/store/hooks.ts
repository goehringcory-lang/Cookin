import { useSyncExternalStore } from "react";
import type { CollectionName, Collections } from "../types";
import { store, type SyncStatus } from "./store";

const subscribe = (fn: () => void) => store.subscribe(fn);

/** Re-renders when anything in the store changes; returns the collection as an id->doc map. */
export function useCollection<C extends CollectionName>(c: C): Record<string, Collections[C]> {
  return useSyncExternalStore(subscribe, () => store.all(c));
}
/** One document (undefined if missing). */
export function useDoc<C extends CollectionName>(c: C, id: string): Collections[C] | undefined {
  return useSyncExternalStore(subscribe, () => store.get(c, id));
}
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, () => store.status);
}
/** True when the browser refused to save (storage full). */
export function useStorageError(): boolean {
  return useSyncExternalStore(subscribe, () => store.storageError);
}
