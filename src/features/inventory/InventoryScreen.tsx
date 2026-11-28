import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import "./inventory.css";
import type { CatalogEntry, InventoryActions, InventoryItem, StockStatus, StorageLocation } from "./types";
import { LOCATIONS } from "./types";
import {
  catalogSuggestions,
  countByStatus,
  filterItems,
  formatCategory,
  groupByCategory,
  isOnList,
  isSpice,
  browseGroups,
  type BrowseEntry,
  nextOnTap,
  normalize,
  restockCandidates,
  type StatusFilter,
} from "./logic";
import { ItemRow } from "./ItemRow";
import { AddItemSheet, ItemSheet, RestockSheet } from "./Sheets";
import { BrowseSheet } from "./BrowseSheet";

export interface InventoryScreenProps {
  items: InventoryItem[];
  /** Full ingredient catalog, so search can add things you don't stock yet. */
  catalog?: CatalogEntry[];
  /** Preferred category order (e.g. from the catalog). Unknown categories sort A–Z after. */
  categoryOrder?: string[];
  actions: InventoryActions;
  initialTab?: Tab;
  /** Item ids already checked off on the grocery list; pre-selected in "Just shopped". */
  checkedOnList?: ReadonlySet<string>;
}

/** Pantry, Fridge, Freezer, plus Spices (pantry spices and dried herbs) so the pantry stays short. */
export type Tab = StorageLocation | "spices";
const TABS: { id: Tab; label: string }[] = [
  { id: "pantry", label: "Pantry" },
  { id: "fridge", label: "Fridge" },
  { id: "freezer", label: "Freezer" },
  { id: "spices", label: "Spices" },
];
const inTab = (it: { location: StorageLocation; category: string }, tab: Tab) =>
  tab === "spices" ? isSpice(it) : it.location === tab && !isSpice(it);

interface Toast {
  id: number;
  text: string;
  undo?: () => void;
  action?: { label: string; run: () => void };
}

type SheetState = { kind: "add"; name?: string } | { kind: "browse" } | { kind: "edit"; id: string } | { kind: "restock" } | null;

const TAB_KEY = "cookin.kitchen.tab";
function loadTab(): Tab {
  try {
    const v = localStorage.getItem(TAB_KEY);
    if (TABS.some((t) => t.id === v)) return v as Tab;
  } catch {
    /* storage blocked */
  }
  return "pantry";
}

const STATUS_WORD: Record<StockStatus, string> = { have: "Have", low: "Running low", out: "Out" };

export function InventoryScreen({
  items,
  catalog = [],
  categoryOrder,
  actions,
  initialTab,
  checkedOnList,
}: InventoryScreenProps) {
  const [tab, setTab] = useState<Tab>(() => initialTab ?? loadTab());
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  // Stable callbacks for memoized rows that still see fresh data.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const showToast = useCallback((t: Omit<Toast, "id">) => {
    window.clearTimeout(toastTimer.current);
    const next = { ...t, id: Date.now() };
    setToast(next);
    toastTimer.current = window.setTimeout(
      () => setToast((cur) => (cur?.id === next.id ? null : cur)),
      t.action ? 6000 : 4000,
    );
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /** Change statuses with an undo that restores each item's previous status. */
  const changeStatus = useCallback(
    (ids: string[], status: StockStatus, text: string, action?: Toast["action"]) => {
      const before = itemsRef.current.filter((i) => ids.includes(i.id)).map((i) => [i.id, i.status, i.onList] as const);
      actionsRef.current.setStatus(ids, status);
      showToast({
        text,
        action,
        undo: () => {
          const byStatus = new Map<StockStatus, string[]>();
          for (const [id, s] of before) byStatus.set(s, [...(byStatus.get(s) ?? []), id]);
          for (const [s, list] of byStatus) actionsRef.current.setStatus(list, s);
          for (const [id, , onList] of before) if (onList) actionsRef.current.setOnList(id, true);
        },
      });
    },
    [showToast],
  );

  const setOne = useCallback(
    (item: InventoryItem, status: StockStatus) => {
      let text = `${item.name} moved to ${STATUS_WORD[status]}.`;
      let action: Toast["action"];
      if (status === "have") text = `${item.name} is back in stock.`;
      else if (status === "low") text += " Added to your list.";
      else if (item.neededFor) text += ` Added to your list for ${item.neededFor}.`;
      else
        action = {
          label: "Add to list",
          run: () => {
            actionsRef.current.setOnList(item.id, true);
            showToast({ text: `Added ${item.name} to your list.`, undo: () => actionsRef.current.setOnList(item.id, false) });
          },
        };
      changeStatus([item.id], status, text, action);
    },
    [changeStatus, showToast],
  );

  const onTap = useCallback((item: InventoryItem) => setOne(item, nextOnTap(item.status)), [setOne]);
  const onEdit = useCallback((item: InventoryItem) => setSheet({ kind: "edit", id: item.id }), []);

  const searching = normalize(deferredQuery).length > 0;
  const tabItems = useMemo(() => items.filter((i) => inTab(i, tab)), [items, tab]);
  const counts = useMemo(() => countByStatus(searching ? items : tabItems), [items, tabItems, searching]);
  const tabNeeds = useMemo(() => {
    const m: Record<Tab, number> = { pantry: 0, fridge: 0, freezer: 0, spices: 0 };
    for (const i of items) if (isOnList(i)) m[isSpice(i) ? "spices" : i.location]++;
    return m;
  }, [items]);

  const visible = useMemo(
    () => filterItems(searching ? items : tabItems, { status: filter, query: deferredQuery }),
    [items, tabItems, filter, deferredQuery, searching],
  );
  const groups = useMemo(() => groupByCategory(visible, categoryOrder), [visible, categoryOrder]);
  const suggestions = useMemo(
    () => (searching ? catalogSuggestions(deferredQuery, catalog, items) : []),
    [searching, deferredQuery, catalog, items],
  );
  const categories = useMemo(() => {
    const s = new Set<string>(categoryOrder ?? []);
    for (const c of catalog) s.add(c.category);
    for (const i of items) s.add(i.category);
    return [...s].filter(Boolean).sort();
  }, [catalog, items, categoryOrder]);

  const tabLabel = TABS.find((t) => t.id === tab)!.label.toLowerCase();
  const inSection = useCallback((e: { location: StorageLocation; category: string }) => inTab(e, tab), [tab]);
  const browseCount = useMemo(
    () => browseGroups(catalog, items, inSection).reduce((n, g) => n + g.items.filter((e) => !e.out).length, 0),
    [catalog, items, inSection],
  );

  /** Add everything picked in the browse sheet: new items are added, out items flip back to Have. */
  const addPicked = (picked: BrowseEntry[], status: "have" | "out") => {
    const fresh = picked.filter((e) => !e.out);
    const outIds = picked.filter((e) => e.out).map((e) => e.id);
    const before = items.filter((i) => outIds.includes(i.id)).map((i) => [i.id, i.onList] as const);
    const ids = fresh.length
      ? actions.addItems(fresh.map((e) => ({ catalogId: e.id, name: e.name, location: e.location, category: e.category, status })))
      : [];
    if (status === "have" && outIds.length) actions.setStatus(outIds, "have");
    if (status === "out") for (const id of [...ids, ...outIds]) actions.setOnList(id, true);
    const n = picked.length;
    const what = n === 1 ? picked[0].name : `${n} items`;
    showToast({
      text: status === "have" ? `Added ${what} to your ${tabLabel}.` : `Added ${what} to your list.`,
      undo: () => {
        for (const id of ids) actions.removeItem(id);
        if (status === "have" && outIds.length) actions.setStatus(outIds, "out");
        for (const [id, onList] of before) if (status === "out" || onList) actions.setOnList(id, Boolean(onList));
      },
    });
  };

  const candidates = useMemo(() => restockCandidates(items), [items]);
  const onListCount = useMemo(() => items.filter(isOnList).length, [items]);
  const editing = sheet?.kind === "edit" ? items.find((i) => i.id === sheet.id) : undefined;

  const exactMatch = useMemo(() => {
    if (!searching) return false;
    const q = normalize(deferredQuery);
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const hit = (n: string, aliases: string[] = []) => [n, ...aliases].some((x) => normalize(x) === q);
    return items.some((i) => hit(i.name, byId.get(i.id)?.aliases)) || suggestions.some((c) => hit(c.name, c.aliases));
  }, [searching, deferredQuery, items, suggestions, catalog]);

  const addFromCatalog = (c: CatalogEntry, status: StockStatus) => {
    actions.addItems([{ catalogId: c.id, name: c.name, location: c.location, category: c.category, status }]);
    if (status === "out") actions.setOnList(c.id, true);
    showToast({
      text: status === "have" ? `Added ${c.name} to your kitchen.` : `Added ${c.name} to your list.`,
      undo: () => actions.removeItem(c.id),
    });
  };

  const filterChips: { id: StatusFilter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "low", label: "Running low", count: counts.low },
    { id: "out", label: "Out", count: counts.out },
  ];

  return (
    <div className="inv">
      <header className="inv-header">
        <div className="inv-header__row">
          <div>
            <h1 className="inv-title">Kitchen</h1>
            <p className="inv-sub">
              {items.length} item{items.length === 1 ? "" : "s"}
              {onListCount > 0 && ` · ${onListCount} on your list`}
            </p>
          </div>
          <button type="button" className="inv-restock-btn" onClick={() => setSheet({ kind: "restock" })}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7" />
              <circle cx="9.5" cy="19" r="1.4" />
              <circle cx="17" cy="19" r="1.4" />
            </svg>
            Just shopped
          </button>
        </div>
      </header>

      <div className="inv-sticky">
        <div className="inv-search">
          <svg className="inv-search__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Search or add an item"
            aria-label="Search your kitchen"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              window.scrollTo({ top: 0 });
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
          />
          {query && (
            <button
              type="button"
              className="inv-icon-btn inv-search__clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>

        {!searching && (
          <div className="inv-tabs" role="tablist" aria-label="Where it's kept">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className="inv-tab"
                onClick={() => {
                  setTab(t.id);
                  window.scrollTo({ top: 0 });
                }}
              >
                {t.label}
                {tabNeeds[t.id] > 0 && <span className="inv-tab__dot" aria-label={`${tabNeeds[t.id]} on your list`} />}
              </button>
            ))}
          </div>
        )}

        <div className="inv-chips" role="group" aria-label="Filter">
          {filterChips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={filter === c.id}
              className={`inv-chip inv-chip--${c.id}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
              {c.count !== undefined && c.count > 0 && <span className="inv-chip__n">{c.count}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="inv-body">
        {!searching && filter === "all" && browseCount > 0 && (
          <button type="button" className="inv-browse-btn" onClick={() => setSheet({ kind: "browse" })}>
            <span className="inv-plus" aria-hidden="true">
              +
            </span>
            <span>
              Browse {browseCount} more {tabLabel === "spices" ? "spices" : `${tabLabel} items`}
              <small>Pick everything you have, then add them in one tap</small>
            </span>
          </button>
        )}
        {groups.length === 0 && !searching && (
          <div className="inv-empty">
            <div className="inv-empty__icon" aria-hidden="true">
              {filter === "all" ? "🧺" : "👌"}
            </div>
            {filter === "all" ? (
              <>
                <p>Nothing in your {tabLabel} yet.</p>
                <button type="button" className="inv-secondary" onClick={() => setSheet({ kind: "add" })}>
                  Type in a new item
                </button>
              </>
            ) : (
              <p>
                Nothing {filter === "low" ? "running low" : "out"} in your {tabLabel}.
              </p>
            )}
          </div>
        )}

        {groups.map((g) => (
          <section key={g.category} className="inv-group">
            <h2 className="inv-group__title">
              {formatCategory(g.category)}
              <span className="inv-group__count">{g.items.length}</span>
            </h2>
            <ul className="inv-list">
              {g.items.map((it) => (
                <ItemRow key={it.id} item={it} showLocation={searching} onTap={onTap} onSet={setOne} onEdit={onEdit} />
              ))}
            </ul>
          </section>
        ))}

        {searching && (
          <section className="inv-group">
            {groups.length === 0 && <p className="inv-hint inv-pad">"{query.trim()}" isn't in your kitchen yet.</p>}
            {(suggestions.length > 0 || !exactMatch) && <h2 className="inv-group__title">Add to your kitchen</h2>}
            <ul className="inv-list">
              {suggestions.map((c) => {
                const loc = LOCATIONS.find((l) => l.id === c.location);
                return (
                  <li key={c.id} className="inv-row inv-row--suggest">
                    <button type="button" className="inv-row__main" onClick={() => addFromCatalog(c, "have")}>
                      <span className="inv-plus" aria-hidden="true">
                        +
                      </span>
                      <span className="inv-row__text">
                        <span className="inv-row__name">{c.name}</span>
                        <span className="inv-row__meta">
                          <span className="inv-row__loc">
                            {loc?.label} · {formatCategory(c.category)}
                          </span>
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="inv-pill-btn"
                      aria-label={`Add ${c.name} to your grocery list`}
                      onClick={() => addFromCatalog(c, "out")}
                    >
                      Need it
                    </button>
                  </li>
                );
              })}
              {!exactMatch && (
                <li className="inv-row inv-row--suggest">
                  <button type="button" className="inv-row__main" onClick={() => setSheet({ kind: "add", name: query.trim() })}>
                    <span className="inv-plus" aria-hidden="true">
                      +
                    </span>
                    <span className="inv-row__text">
                      <span className="inv-row__name">Add "{query.trim()}" as a new item</span>
                    </span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        )}

        {!searching && groups.length > 0 && (
          <p className="inv-hint inv-foot-hint">
            Tap an item to mark it out, or pick Have, Low or Out. Low items go on your list right away. Out items go on
            it when a planned recipe needs them. Press and hold an item for more.
          </p>
        )}
      </div>

      <button
        type="button"
        className="inv-fab"
        aria-label="Add an item"
        onClick={() => {
          if (searching) setSheet({ kind: "add", name: query.trim() });
          else setSheet({ kind: "browse" });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {toast && (
        <div className="inv-toast" role="status" key={toast.id}>
          <span>{toast.text}</span>
          <span className="inv-toast__actions">
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  const run = toast.action!.run;
                  setToast(null);
                  run();
                }}
              >
                {toast.action.label}
              </button>
            )}
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
              >
                Undo
              </button>
            )}
          </span>
        </div>
      )}

      {sheet?.kind === "add" && (
        <AddItemSheet
          initialName={sheet.name}
          initialLocation={sheet.name || tab === "spices" ? undefined : tab}
          categories={categories}
          items={items}
          onAdd={(input) => {
            const [id] = actions.addItems([input]);
            if (input.status === "out" && id) actions.setOnList(id, true);
            setQuery("");
            setTab(input.location);
            showToast({
              text:
                input.status && input.status !== "have"
                  ? `Added ${input.name} to your kitchen and your list.`
                  : `Added ${input.name} to your ${input.location}.`,
              undo: id ? () => actions.removeItem(id) : undefined,
            });
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === "browse" && (
        <BrowseSheet
          sectionLabel={tabLabel}
          catalog={catalog}
          items={items}
          inSection={inSection}
          categoryOrder={categoryOrder}
          onAdd={addPicked}
          onClose={() => setSheet(null)}
        />
      )}

      {editing && (
        <ItemSheet
          key={editing.id}
          item={editing}
          categories={categories}
          onStatus={(s) => actions.setStatus([editing.id], s)}
          onList={(on) => actions.setOnList(editing.id, on)}
          onUpdate={(patch) => actions.updateItem(editing.id, patch)}
          onRemove={() => {
            const snap = editing;
            actions.removeItem(snap.id);
            setSheet(null);
            showToast({
              text: `Removed ${snap.name} from your kitchen.`,
              undo: () => {
                actions.addItems([{ catalogId: snap.id, name: snap.name, location: snap.location, category: snap.category, status: snap.status }]);
                if (snap.onList) actions.setOnList(snap.id, true);
              },
            });
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet?.kind === "restock" && (
        <RestockSheet
          items={candidates}
          preselected={(it) => isOnList(it) || Boolean(checkedOnList?.has(it.id))}
          onRestock={(ids) => changeStatus(ids, "have", `Restocked ${ids.length} item${ids.length === 1 ? "" : "s"}. Nice haul!`)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
