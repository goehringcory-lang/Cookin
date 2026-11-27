/**
 * Kitchen tab (#kitchen): connects the pantry / fridge / freezer screen to the shared store.
 *
 * Reads:  inventory, customItems, plan, recipes, list (checked + manual)
 * Writes: inventory via setStatus, customItems for new items, list.manual for "+ List" on out items
 *         (manual ids are "inv-<itemId>", removed again once the item is back in stock).
 */
import { useMemo } from "react";
import type { CatalogItem, ListState, StockStatus } from "@shared/types";
import { store, useCollection } from "@shared/store";
import { addDays, setStatus as setInventoryStatus, todayYmd, updateList, useListState, useOwned } from "@shared/domain";
import { CATALOG, allItems, analyzeRecipe, getItem } from "@shared/catalog";
import { InventoryScreen } from "./InventoryScreen";
import type { CatalogEntry, InventoryActions, InventoryItem } from "./types";

const MANUAL_PREFIX = "inv-";
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
  }, [plan, recipes, owned]);
}

function withoutManual(list: ListState, itemIds: string[]): ListState["manual"] | null {
  const drop = new Set(itemIds.map(manualId));
  const next = list.manual.filter((m) => !drop.has(m.id));
  return next.length === list.manual.length ? null : next;
}

function currentList(): ListState {
  return { checked: {}, manual: [], dismissed: {}, updatedAt: 0, ...store.get("list", "current") };
}

/** Store-backed actions. Exported for tests. */
export const kitchenActions: InventoryActions = {
  setStatus(ids, status: StockStatus) {
    setInventoryStatus(ids, status);
    // Back in stock (or low, which lists it anyway): drop any hand-added list line.
    if (status !== "out") {
      const manual = withoutManual(currentList(), ids);
      if (manual) updateList({ manual });
    }
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
    const manual = withoutManual(currentList(), [id]);
    if (manual) updateList({ manual });
  },
  updateItem(id, patch) {
    const cur = store.get("customItems", id);
    if (!cur) return; // catalog items are fixed
    store.put("customItems", id, { ...cur, ...patch });
  },
  setOnList(id, on) {
    const list = currentList();
    const rest = list.manual.filter((m) => m.id !== manualId(id));
    const name = getItem(id)?.name ?? store.get("customItems", id)?.name ?? id;
    updateList({ manual: on ? [...rest, { id: manualId(id), name, addedAt: Date.now() }] : rest });
  },
};

export function KitchenScreen() {
  const inventory = useCollection("inventory");
  const custom = useCollection("customItems");
  const list = useListState();
  const neededFor = useNeededFor();

  const manualIds = useMemo(
    () => new Set(list.manual.filter((m) => m.id.startsWith(MANUAL_PREFIX)).map((m) => m.id.slice(MANUAL_PREFIX.length))),
    [list.manual],
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
  }, [inventory, custom, neededFor, manualIds]);

  const catalog = useMemo<CatalogEntry[]>(() => {
    const seen = new Set<string>();
    const out: CatalogEntry[] = [];
    for (const c of [...allItems(), ...Object.values(custom)]) {
      if (c.assumed || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ id: c.id, name: c.name, location: c.location, category: c.category, aliases: c.aliases });
    }
    return out;
  }, [custom]);

  const checkedOnList = useMemo(() => {
    const s = new Set<string>();
    for (const k of Object.keys(list.checked)) {
      if (k.startsWith("item:")) s.add(k.slice(5));
      else if (k.startsWith("manual:" + MANUAL_PREFIX)) s.add(k.slice(7 + MANUAL_PREFIX.length));
    }
    return s;
  }, [list.checked]);

  return (
    <InventoryScreen
      items={items}
      catalog={catalog}
      categoryOrder={CATEGORY_ORDER}
      actions={kitchenActions}
      checkedOnList={checkedOnList}
      onOpenList={() => { location.hash = "list"; }}
    />
  );
}
