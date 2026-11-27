/**
 * Writes for the shopping list. Each list change is its own small doc in the
 * `list` collection (see ListEntry), so two phones never overwrite each other.
 * Actions that change a lot return an `undo` for the toast.
 */
import { store } from "@shared/store";
import { addManualItem, setChecked } from "@shared/domain";
import type { InventoryEntry, ListEntry } from "@shared/types";
import type { ShoppingLine } from "./build";

type Change = { c: "list" | "inventory"; id: string; data: unknown | null };

/** Restores the given list and inventory docs to how they are now. */
function snapshot(listIds: string[], itemIds: string[]): () => void {
  const before: Change[] = [
    ...listIds.map((id) => ({ c: "list" as const, id, data: store.get("list", id) ?? null })),
    ...itemIds.map((id) => ({ c: "inventory" as const, id, data: store.get("inventory", id) ?? null })),
  ];
  return () => store.putMany(before.map((b) => (b.data ? { ...b, data: { ...(b.data as object), updatedAt: Date.now() } } : b)));
}

const have = (id: string, now: number): Change => ({ c: "inventory", id, data: { itemId: id, status: "have", updatedAt: now } satisfies InventoryEntry });
const dismiss = (key: string, weekOf: string, now: number): Change => {
  const id = "dismiss:" + key;
  return { c: "list", id, data: { id, type: "dismiss", key, weekOf, updatedAt: now } satisfies ListEntry };
};
const uncheck = (key: string): Change => ({ c: "list", id: "check:" + key, data: null });

export const toggleChecked = (line: ShoppingLine, weekOf: string) => setChecked(line.key, !line.checked, weekOf);

export function addManual(name: string, weekOf: string): string | undefined {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean ? addManualItem(clean, weekOf) : undefined;
}

/** True when removing the line should mark its kitchen item as in stock. */
export const removeRestocks = (line: ShoppingLine) =>
  !!line.itemId && line.reasons.some((r) => r.type === "recipe" || r.type === "lunch" || r.type === "low");

/**
 * Removes a line ("I have it" / swipe left):
 *  - hand-added entries are deleted,
 *  - a catalog item that's needed or running low is marked "have" in the kitchen,
 *    which is what removing it means: it's already there,
 *  - staples and unmatched recipe lines are hidden for this shopping week.
 */
export function removeLine(line: ShoppingLine, weekOf: string): () => void {
  const restock = removeRestocks(line);
  const undo = snapshot(["check:" + line.key, "dismiss:" + line.key, ...line.manualIds], restock ? [line.itemId!] : []);
  const now = Date.now();
  store.putMany([
    uncheck(line.key),
    dismiss(line.key, weekOf, now),
    ...line.manualIds.map((id): Change => ({ c: "list", id, data: null })),
    ...(restock ? [have(line.itemId!, now)] : []),
  ]);
  return undo;
}

/**
 * "Done shopping": every checked line was bought.
 *  - Catalog items go back to "have" in the kitchen (restock), so recipe needs drop off.
 *  - Checked lines are dismissed for this shopping week, so staples don't pop
 *    straight back. A recipe need or "running low" later in the week still shows.
 *  - Hand-added items are deleted and the checks cleared.
 */
export function finishShopping(lines: ShoppingLine[], weekOf: string): { restocked: number; bought: number; undo: () => void } {
  const bought = lines.filter((x) => x.checked);
  const itemIds = [...new Set(bought.map((x) => x.itemId).filter((x): x is string => !!x))];
  const manualIds = bought.flatMap((x) => x.manualIds);
  const undo = snapshot([...bought.flatMap((x) => ["check:" + x.key, "dismiss:" + x.key]), ...manualIds], itemIds);
  const now = Date.now();
  store.putMany([
    ...bought.flatMap((x) => [uncheck(x.key), dismiss(x.key, weekOf, now)]),
    ...manualIds.map((id): Change => ({ c: "list", id, data: null })),
    ...itemIds.map((id) => have(id, now)),
  ]);
  return { restocked: itemIds.length, bought: bought.length, undo };
}

/** Unchecks everything without restocking. */
export function clearChecked(lines: ShoppingLine[]) {
  const keys = lines.filter((l) => l.checked).map((l) => l.key);
  if (keys.length) store.putMany(keys.map(uncheck));
}
