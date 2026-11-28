import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { InventoryItem, NewItemInput, StockStatus, StorageLocation } from './types';
import { LOCATIONS } from './types';
import { findExisting, guessLocation, titleCase } from './logic';

/* ---------- Bottom sheet shell ---------- */

export function Sheet({
  title,
  onClose,
  children,
  footer,
  className,
}: {
  title: string;
  className?: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="inv-sheet-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className={className ? `inv-sheet ${className}` : 'inv-sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inv-sheet__grab" aria-hidden="true" />
        <div className="inv-sheet__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="inv-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="inv-sheet__body">{children}</div>
        {footer && <div className="inv-sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

function LocationPicker({ value, onChange }: { value: StorageLocation; onChange(l: StorageLocation): void }) {
  return (
    <div className="inv-seg" role="radiogroup" aria-label="Where it's kept">
      {LOCATIONS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          className={value === l.id ? 'is-on' : ''}
          onClick={() => onChange(l.id)}
        >
          <span aria-hidden="true">{l.icon}</span> {l.label}
        </button>
      ))}
    </div>
  );
}

function StatusPicker({ value, onChange }: { value: StockStatus; onChange(s: StockStatus): void }) {
  const opts: { id: StockStatus; label: string }[] = [
    { id: 'have', label: 'Have it' },
    { id: 'low', label: 'Running low' },
    { id: 'out', label: 'Out' },
  ];
  return (
    <div className="inv-seg inv-seg--status" role="radiogroup" aria-label="Status">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={`inv-seg--${o.id} ${value === o.id ? 'is-on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Add a custom item ---------- */

export function AddItemSheet({
  initialName = '',
  initialLocation,
  categories,
  items,
  onAdd,
  onClose,
}: {
  initialName?: string;
  initialLocation?: StorageLocation;
  categories: string[];
  items: InventoryItem[];
  onAdd(item: NewItemInput): void;
  onClose(): void;
}) {
  const [name, setName] = useState(initialName);
  const [location, setLocation] = useState<StorageLocation>(
    initialLocation ?? (initialName ? guessLocation(initialName) : 'pantry'),
  );
  const [touchedLoc, setTouchedLoc] = useState(Boolean(initialLocation));
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StockStatus>('have');
  const listId = useId();

  const existing = useMemo(() => (name.trim() ? findExisting(name, items) : undefined), [name, items]);
  const clean = titleCase(name);

  const submit = () => {
    if (!clean || existing) return;
    onAdd({ name: clean, location, category: category.trim() || 'Other', status });
    onClose();
  };

  return (
    <Sheet
      title="Add an item"
      onClose={onClose}
      footer={
        <button type="button" className="inv-primary" disabled={!clean || Boolean(existing)} onClick={submit}>
          {status === 'have' ? 'Add to kitchen' : 'Add and put on list'}
        </button>
      }
    >
      <form
        className="inv-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="inv-field">
          <span>Name</span>
          <input
            autoFocus
            value={name}
            enterKeyHint="done"
            autoCapitalize="sentences"
            placeholder="e.g. Gochujang"
            onChange={(e) => {
              setName(e.target.value);
              if (!touchedLoc) setLocation(guessLocation(e.target.value));
            }}
          />
        </label>
        {existing && (
          <p className="inv-warn">
            You already have <strong>{existing.name}</strong> in your{' '}
            {LOCATIONS.find((l) => l.id === existing.location)?.label.toLowerCase()}.
          </p>
        )}
        <div className="inv-field">
          <span>Where it's kept</span>
          <LocationPicker
            value={location}
            onChange={(l) => {
              setTouchedLoc(true);
              setLocation(l);
            }}
          />
        </div>
        <label className="inv-field">
          <span>Section (optional)</span>
          <input
            list={listId}
            value={category}
            placeholder="e.g. Sauces & Condiments"
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="inv-field">
          <span>Right now</span>
          <StatusPicker value={status} onChange={setStatus} />
        </div>
      </form>
    </Sheet>
  );
}

/* ---------- Edit one item (long press) ---------- */

export function ItemSheet({
  item,
  categories,
  onStatus,
  onList,
  onUpdate,
  onRemove,
  onClose,
}: {
  item: InventoryItem;
  categories: string[];
  onStatus(s: StockStatus): void;
  onList(on: boolean): void;
  onUpdate(patch: Partial<Pick<InventoryItem, 'name' | 'location' | 'category'>>): void;
  onRemove(): void;
  onClose(): void;
}) {
  const [name, setName] = useState(item.name);
  const listId = useId();
  const commitName = () => {
    const n = titleCase(name);
    if (n && n !== item.name) onUpdate({ name: n });
  };
  return (
    <Sheet
      title={item.name}
      onClose={() => {
        commitName();
        onClose();
      }}
      footer={
        <button type="button" className="inv-danger" onClick={onRemove}>
          I don't keep this anymore
        </button>
      }
    >
      <div className="inv-form">
        <div className="inv-field">
          <span>Right now</span>
          <StatusPicker value={item.status} onChange={onStatus} />
        </div>
        {item.status === 'out' &&
          (item.neededFor ? (
            <p className="inv-hint">It's on your grocery list because {item.neededFor} needs it.</p>
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(item.onList)}
              className={`inv-switch ${item.onList ? 'is-on' : ''}`}
              onClick={() => onList(!item.onList)}
            >
              <span>Put it on my grocery list</span>
              <span className="inv-switch__track" aria-hidden="true">
                <span className="inv-switch__thumb" />
              </span>
            </button>
          ))}
        {item.custom ? (
          <>
        <div className="inv-field">
          <span>Where it's kept</span>
          <LocationPicker value={item.location} onChange={(location) => onUpdate({ location })} />
        </div>
        <label className="inv-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} />
        </label>
        <label className="inv-field">
          <span>Section</span>
          <input
            list={listId}
            defaultValue={item.category}
            onBlur={(e) => {
              const c = e.target.value.trim() || 'Other';
              if (c !== item.category) onUpdate({ category: c });
            }}
          />
          <datalist id={listId}>
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
          </>
        ) : (
          <p className="inv-hint">
            Kept in your {LOCATIONS.find((l) => l.id === item.location)?.label.toLowerCase()} · {item.category}
          </p>
        )}
        <p className="inv-hint">
          Removing it means it only lands on your grocery list when a planned recipe needs it.
        </p>
      </div>
    </Sheet>
  );
}

/* ---------- Quick restock after shopping ---------- */

export function RestockSheet({
  items,
  preselected,
  onRestock,
  onClose,
}: {
  items: InventoryItem[];
  preselected(item: InventoryItem): boolean;
  onRestock(ids: string[]): void;
  onClose(): void;
}) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(items.filter(preselected).map((i) => i.id)),
  );
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOn = picked.size === items.length;

  return (
    <Sheet
      title="Just got back from the store?"
      onClose={onClose}
      footer={
        items.length > 0 ? (
          <button
            type="button"
            className="inv-primary"
            disabled={picked.size === 0}
            onClick={() => {
              onRestock([...picked]);
              onClose();
            }}
          >
            {picked.size === 0
              ? 'Pick what you bought'
              : `Restock ${picked.size} item${picked.size === 1 ? '' : 's'}`}
          </button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="inv-empty">
          <div className="inv-empty__icon" aria-hidden="true">
            🎉
          </div>
          <p>Nothing is low or out. Your kitchen is fully stocked.</p>
        </div>
      ) : (
        <>
          <div className="inv-restock__bar">
            <p className="inv-hint">Check what you bought. Your list items are already checked.</p>
            <button
              type="button"
              className="inv-link"
              onClick={() => setPicked(allOn ? new Set() : new Set(items.map((i) => i.id)))}
            >
              {allOn ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <ul className="inv-restock">
            {items.map((it) => {
              const on = picked.has(it.id);
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`inv-restock__row ${on ? 'is-on' : ''}`}
                    onClick={() => toggle(it.id)}
                  >
                    <span className="inv-check" aria-hidden="true">
                      {on ? '✓' : ''}
                    </span>
                    <span className="inv-row__name">{it.name}</span>
                    <span className={`inv-pill inv-pill--${it.status}`}>{it.status === 'low' ? 'Low' : 'Out'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
}
