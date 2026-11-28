import { useDeferredValue, useMemo, useState } from 'react';
import type { CatalogEntry, InventoryItem, StorageLocation } from './types';
import { browseGroups, formatCategory, type BrowseEntry } from './logic';
import { Sheet } from './Sheets';

/**
 * "Browse and add": every catalog item in one section that you don't have yet (and anything marked out),
 * grouped by category. Tap to pick as many as you like, then add them all as Have in one go
 * (or put them on the grocery list instead).
 */
export function BrowseSheet({
  sectionLabel,
  catalog,
  items,
  inSection,
  categoryOrder,
  onAdd,
  onClose,
}: {
  /** Lowercase section name for copy, e.g. "freezer". */
  sectionLabel: string;
  catalog: CatalogEntry[];
  items: InventoryItem[];
  inSection(e: { location: StorageLocation; category: string }): boolean;
  categoryOrder?: string[];
  /** Picked entries; `status` is have (in the kitchen) or out (on the grocery list). */
  onAdd(picked: BrowseEntry[], status: 'have' | 'out'): void;
  onClose(): void;
}) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [picked, setPicked] = useState<Map<string, BrowseEntry>>(() => new Map());

  const all = useMemo(
    () => browseGroups(catalog, items, inSection, '', categoryOrder),
    [catalog, items, inSection, categoryOrder],
  );
  const groups = useMemo(
    () => (deferred.trim() ? browseGroups(catalog, items, inSection, deferred, categoryOrder) : all),
    [all, deferred, catalog, items, inSection, categoryOrder],
  );
  const total = useMemo(() => all.reduce((n, g) => n + g.items.length, 0), [all]);

  const toggle = (e: BrowseEntry) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(e.id)) next.delete(e.id);
      else next.set(e.id, e);
      return next;
    });

  const jump = (category: string) => {
    const el = document.getElementById(groupDomId(category));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const n = picked.size;
  const submit = (status: 'have' | 'out') => {
    if (!n) return;
    onAdd([...picked.values()], status);
    onClose();
  };

  return (
    <Sheet
      title={`Add to your ${sectionLabel}`}
      onClose={onClose}
      className="inv-sheet--tall"
      footer={
        <div className="inv-browse__foot">
          <button type="button" className="inv-primary" disabled={n === 0} onClick={() => submit('have')}>
            {n === 0 ? 'Tap items you have' : `I have ${n === 1 ? 'this' : `these ${n}`}`}
          </button>
          {n > 0 && (
            <div className="inv-browse__foot-row">
              <button type="button" className="inv-link" onClick={() => setPicked(new Map())}>
                Clear
              </button>
              <button type="button" className="inv-link" onClick={() => submit('out')}>
                Put {n === 1 ? 'it' : 'them'} on my list instead
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="inv-browse__top">
        <div className="inv-search inv-browse__search">
          <svg className="inv-search__icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder={`Search ${total} ${sectionLabel} items`}
            aria-label={`Search ${sectionLabel} items to add`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="inv-icon-btn inv-search__clear" aria-label="Clear search" onClick={() => setQuery('')}>
              ✕
            </button>
          )}
        </div>
        {!deferred.trim() && all.length > 1 && (
          <div className="inv-browse__jump" role="group" aria-label="Jump to a section">
            {all.map((g) => (
              <button key={g.category} type="button" className="inv-chip" onClick={() => jump(g.category)}>
                {shortCategory(g.category)}
              </button>
            ))}
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="inv-empty">
          <div className="inv-empty__icon" aria-hidden="true">
            🎉
          </div>
          <p>You have everything on our {sectionLabel} list.</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="inv-hint inv-pad">Nothing matches "{query.trim()}". Close this and use the main search to add it as a new item.</p>
      ) : (
        groups.map((g) => (
          <section key={g.category} id={groupDomId(g.category)} className="inv-browse__group">
            <h3 className="inv-group__title">
              {formatCategory(g.category)}
              <span className="inv-group__count">{g.items.length}</span>
            </h3>
            <div className="inv-browse__chips">
              {g.items.map((e) => {
                const on = picked.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={e.out ? `${e.name}, out` : e.name}
                    className={`inv-pick ${on ? 'is-on' : ''}`}
                    onClick={() => toggle(e)}
                  >
                    <span className="inv-pick__mark" aria-hidden="true">
                      {on ? '✓' : '+'}
                    </span>
                    {displayName(e.name)}
                    {e.out && <span className="inv-pick__out">out</span>}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </Sheet>
  );
}

const groupDomId = (category: string) => 'inv-browse-' + category.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** "Frozen meat & seafood" -> "Meat & seafood" for the jump chips. */
function shortCategory(c: string): string {
  const s = formatCategory(c).replace(/^Frozen\s+/i, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** In a list that is all freezer food, "Frozen peas" reads better as "Peas". */
function displayName(name: string): string {
  const s = name.replace(/^Frozen\s+/, '');
  return s === name ? name : s.charAt(0).toUpperCase() + s.slice(1);
}
