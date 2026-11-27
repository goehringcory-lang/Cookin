/**
 * Kitchen tab (#kitchen): connects the pantry / fridge / freezer screen to the shared store.
 *
 * Reads:  inventory, customItems, plan, recipes, list (checked + manual)
 * Writes: inventory via setStatus, customItems for new items, and a manual list entry for "Add to list"
 *         on an out item (list doc id "manual:inv-<itemId>", deleted again once the item is back in stock).
 */
import { useMemo } from "react";
import type { CatalogItem, ListEntry, StockStatus } from "@shared/types";
import { store, useCollection } from "@shared/store";
import { addDays, setStatus as setInventoryStatus, todayYmd, useCatalogVersion, useOwned, weekStart } from "@shared/domain";
import { CATALOG, allItems, analyzeRecipe, getItem } from "@shared/catalog";
import { InventoryScreen } from "./InventoryScreen";
import type { CatalogEntry, InventoryActions, InventoryItem } from "./types";

const MANUAL_PREFIX = "manual:inv-";
const manualId = (itemId: string) => MANUAL_PREFIX + itemId;

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Catalog section order, as the catalog lists them. */
const CATEGORY_ORDER = [...new Set(CATALOG.map((c) => c.category))];

/** For each catalog id, the title of the first upcoming planned recipe (next 14 days) that needs it. */
function useNeededFor(): Map<string, string> {
  const plan = useCollection("plan");
  const recipes = useCollection("recipes");
  const owned = useOwned();
  const catalogVersion = useCatalogVersion();
  return useMemo(() => {
    const today = todayYmd();
    const end = addDays(today, 14);
    const out = new Map<string, string>();
    const slots = Object.values(plan)
      .filter((p) => p.kind === "recipe" && p.refId && p.date >= today && p.date < end)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.meal === "lunch" ? -1 : 1));
    for (const p of slots) {
      const r = recipes[p.refId!];
      if (!r) continue;
      for (const id of analyzeRecipe(r, owned).missing) if (!out.has(id)) out.set(id, r.title);
    }
    return out;
    // catalogVersion: re-run when custom items change what the matcher knows.
  }, [plan, recipes, owned, catalogVersion]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Delete hand-added list lines for these items (no-op when there are none). */
function dropManual(itemIds: string[]) {
  const ids = itemIds.map(manualId).filter((id) => store.get("list", id));
  if (ids.length) store.putMany(ids.map((id) => ({ c: "list" as const, id, data: null })));
}

/** Store-backed actions. Exported for tests. */
export const kitchenActions: InventoryActions = {
  setStatus(ids, status: StockStatus) {
    setInventoryStatus(ids, status);
    // Back in stock (or low, which lists it anyway): drop any hand-added list line.
    if (status !== "out") dropManual(ids);
  },
  addItems(inputs) {
    const ids: string[] = [];
    for (const n of inputs) {
      let id = n.catalogId;
      if (!id) {
        const base = "c-" + (slug(n.name) || "item");
        id = base;
        for (let i = 2; getItem(id) || store.get("customItems", id); i++) id = `${base}-${i}`;
        const item: CatalogItem = { id, name: n.name, location: n.location, category: n.category || "Added by you", aliases: [], custom: true };
        store.put("customItems", id, item);
      }
      ids.push(id);
    }
    const byStatus = new Map<StockStatus, string[]>();
    inputs.forEach((n, i) => byStatus.set(n.status ?? "have", [...(byStatus.get(n.status ?? "have") ?? []), ids[i]]));
    for (const [s, list] of byStatus) setInventoryStatus(list, s);
    return ids;
  },
  removeItem(id) {
    store.remove("inventory", id);
    dropManual([id]);
  },
  updateItem(id, patch) {
    const cur = store.get("customItems", id);
    if (!cur) return; // catalog items are fixed
    store.put("customItems", id, { ...cur, ...patch });
  },
  setOnList(id, on) {
    if (!on) return dropManual([id]);
    const name = getItem(id)?.name ?? store.get("customItems", id)?.name ?? id;
    const entry: ListEntry = { id: manualId(id), type: "manual", name, weekOf: weekStart(), updatedAt: Date.now() };
    store.put("list", entry.id, entry);
  },
};

export function KitchenScreen() {
  const inventory = useCollection("inventory");
  const custom = useCollection("customItems");
  const list = useCollection("list");
  const neededFor = useNeededFor();
  const catalogVersion = useCatalogVersion();

  const manualIds = useMemo(
    () => new Set(Object.keys(list).filter((k) => k.startsWith(MANUAL_PREFIX)).map((k) => k.slice(MANUAL_PREFIX.length))),
    [list],
  );

  const items = useMemo<InventoryItem[]>(() => {
    const out: InventoryItem[] = [];
    for (const e of Object.values(inventory)) {
      const c = custom[e.itemId] ?? getItem(e.itemId);
      if (!c || c.assumed) continue;
      out.push({
        id: e.itemId,
        name: c.name,
        location: c.location,
        category: c.custom ? c.category || "Added by you" : c.category,
        status: e.status,
        custom: Boolean(c.custom),
        updatedAt: e.updatedAt,
        neededFor: neededFor.get(e.itemId),
        onList: manualIds.has(e.itemId),
      });
    }
    return out;
  }, [inventory, custom, neededFor, manualIds, catalogVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const catalog = useMemo<CatalogEntry[]>(() => {
    const seen = new Set<string>();
    const out: CatalogEntry[] = [];
    for (const c of [...allItems(), ...Object.values(custom)]) {
      if (c.assumed || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ id: c.id, name: c.name, location: c.location, category: c.category, aliases: c.aliases });
    }
    return out;
  }, [custom, catalogVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Item ids checked off on this week's grocery list (pre-selected in "Just shopped"). */
  const checkedOnList = useMemo(() => {
    const week = weekStart();
    const s = new Set<string>();
    for (const e of Object.values(list)) {
      if (e.type !== "check" || e.weekOf !== week || !e.key) continue;
      if (e.key.startsWith("item:")) s.add(e.key.slice(5));
      else if (e.key.startsWith(MANUAL_PREFIX)) s.add(e.key.slice(MANUAL_PREFIX.length));
    }
    return s;
  }, [list]);

  return (
    <InventoryScreen
      items={items}
      catalog={catalog}
      categoryOrder={CATEGORY_ORDER}
      actions={kitchenActions}
      checkedOnList={checkedOnList}
    />
  );
}
