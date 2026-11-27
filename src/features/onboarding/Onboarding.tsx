import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogItem, Location, OnboardingAdapter, Staple } from './types';
import {
  LOCATIONS,
  clearDraft,
  groupByCategory,
  loadDraft,
  makeCustomItem,
  saveDraft,
  search,
  toResult,
  type CategoryGroup,
} from './model';
import { DEFAULT_STAPLE_NAMES, STAPLE_SUGGESTIONS, makeStaple } from './staples';
import './onboarding.css';

/** Steps: 0 welcome, 1-3 locations, 4 staples, 5 done. "Step n of 5" counts 1-5. */
const STEP_COUNT = 5;
const PREVIEW = 10; // chips shown per category before "Show all"

const tap = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not supported */
  }
};

export default function Onboarding({ catalog, categories, save, onFinish, initial }: OnboardingAdapter) {
  const draft = useMemo(() => loadDraft(), []);
  const [step, setStep] = useState(draft?.step ?? 0);
  const [have, setHave] = useState<Set<string>>(() => new Set(draft?.have ?? initial?.haveIds ?? []));
  const [custom, setCustom] = useState<CatalogItem[]>(draft?.custom ?? initial?.customItems ?? []);
  const [staples, setStaples] = useState<Staple[]>(
    () =>
      draft?.staples ??
      initial?.staples ??
      STAPLE_SUGGESTIONS.filter((s) => DEFAULT_STAPLE_NAMES.includes(s.name)),
  );
  const [open, setOpen] = useState<Partial<Record<Location, string | null>>>(draft?.open ?? {});

  const fullCatalog = useMemo(() => {
    const ids = new Set(catalog.map((c) => c.id));
    return [...catalog, ...custom.filter((c) => !ids.has(c.id))];
  }, [catalog, custom]);

  // Autosave every change so an interruption never loses progress.
  useEffect(() => {
    saveDraft({ v: 1, step, have: [...have], custom, staples, open });
  }, [step, have, custom, staples, open]);

  const result = useCallback(() => toResult(have, custom, staples), [have, custom, staples]);

  const go = (next: number) => {
    // Persist to the shared store on every step change, not just at the end.
    void Promise.resolve(save(result())).catch((e) => console.warn('[onboarding] save failed', e));
    setStep(Math.max(0, Math.min(5, next)));
    window.scrollTo({ top: 0 });
  };

  const finish = () => {
    const r = result();
    void Promise.resolve(save(r))
      .then(() => clearDraft())
      .catch((e) => console.warn('[onboarding] save failed', e));
    onFinish(r);
  };

  const toggle = (id: string) => {
    tap();
    setHave((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setMany = (ids: string[], on: boolean) =>
    setHave((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  const addCustom = (name: string, location: Location) => {
    const item = makeCustomItem(name, location);
    const existing = fullCatalog.find((c) => c.name.toLowerCase() === item.name.toLowerCase());
    if (existing) {
      setMany([existing.id], true);
      return;
    }
    setCustom((prev) => [...prev, item]);
    setMany([item.id], true);
  };

  const counts = useMemo(() => {
    const byLoc: Record<Location, number> = { pantry: 0, fridge: 0, freezer: 0 };
    for (const item of fullCatalog) if (have.has(item.id)) byLoc[item.location]++;
    return byLoc;
  }, [fullCatalog, have]);

  if (step === 0) return <Welcome onStart={() => go(1)} resumed={!!draft && draft.have.length > 0} />;

  return (
    <div className="ob">
      <header className="ob-top">
        <div className="ob-top-row">
          <button className="ob-icon-btn" onClick={() => go(step - 1)} aria-label="Back">
            <span aria-hidden>‹</span>
          </button>
          <span className="ob-step">
            Step {step} of {STEP_COUNT}
          </span>
          {step < 5 ? (
            <button className="ob-link" onClick={() => go(step + 1)}>
              Skip
            </button>
          ) : (
            <span className="ob-link-spacer" />
          )}
        </div>
        <div className="ob-progress" role="progressbar" aria-valuemin={0} aria-valuemax={STEP_COUNT} aria-valuenow={step}>
          <div className="ob-progress-fill" style={{ width: `${(step / STEP_COUNT) * 100}%` }} />
        </div>
      </header>

      {step >= 1 && step <= 3 && (
        <LocationStep
          key={LOCATIONS[step - 1].id}
          loc={LOCATIONS[step - 1]}
          catalog={fullCatalog}
          groups={groupByCategory(fullCatalog, LOCATIONS[step - 1].id, categories)}
          have={have}
          count={counts[LOCATIONS[step - 1].id]}
          openKey={open[LOCATIONS[step - 1].id]}
          setOpenKey={(k) => setOpen((o) => ({ ...o, [LOCATIONS[step - 1].id]: k }))}
          toggle={toggle}
          setMany={setMany}
          addCustom={addCustom}
          onNext={() => go(step + 1)}
          nextLabel={step < 3 ? `Next: ${LOCATIONS[step].title}` : 'Next: Always-buy items'}
        />
      )}

      {step === 4 && <StaplesStep staples={staples} setStaples={setStaples} onNext={() => go(5)} />}

      {step === 5 && <DoneStep counts={counts} staples={staples} onEdit={(s) => go(s)} onFinish={finish} />}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Welcome({ onStart, resumed }: { onStart: () => void; resumed: boolean }) {
  return (
    <div className="ob ob-welcome">
      <div className="ob-welcome-art" aria-hidden>
        <span>🥫</span>
        <span>🧀</span>
        <span>🧊</span>
      </div>
      <h1>Let's stock your kitchen</h1>
      <p className="ob-lede">
        Tap what you have in your pantry, fridge and freezer. Cookin uses it to show which recipes you can make and
        what to buy.
      </p>
      <ul className="ob-welcome-points">
        <li>
          <b>About 5 minutes.</b> Everything saves as you go.
        </li>
        <li>
          <b>Roughly is fine.</b> Fresh herbs, greens and raw meat are bought per recipe, so skip them.
        </li>
        <li>
          <b>Change it anytime</b> from the Pantry tab.
        </li>
      </ul>
      <button className="ob-primary ob-wide" onClick={onStart}>
        {resumed ? 'Pick up where I left off' : "Let's go"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface LocationStepProps {
  loc: (typeof LOCATIONS)[number];
  catalog: CatalogItem[];
  groups: CategoryGroup[];
  have: Set<string>;
  count: number;
  openKey: string | null | undefined;
  setOpenKey: (k: string | null) => void;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  addCustom: (name: string, loc: Location) => void;
  onNext: () => void;
  nextLabel: string;
}

function LocationStep(p: LocationStepProps) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ key: string; prev: string[] } | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // Default: first category open.
  const openKey = p.openKey === undefined ? (p.groups[0]?.key ?? null) : p.openKey;

  const results = useMemo(() => search(p.catalog, query), [p.catalog, query]);
  const exact = results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  const openCard = (key: string | null) => {
    p.setOpenKey(key);
    setUndo(null);
    if (key)
      requestAnimationFrame(() =>
        cardRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
  };

  const nextCategory = (idx: number) => {
    const next = p.groups[idx + 1];
    if (next) openCard(next.key);
    else {
      p.setOpenKey(null);
      requestAnimationFrame(() => document.querySelector('.ob-footer')?.scrollIntoView({ behavior: 'smooth' }));
    }
  };

  return (
    <main className="ob-main">
      <div className="ob-heading">
        <h1>
          <span aria-hidden>{p.loc.emoji}</span> {p.loc.title}
        </h1>
        <p className="ob-sub">
          {p.loc.blurb} <span className="ob-count">{p.count} selected</span>
        </p>
      </div>

      <div className="ob-search">
        <input
          type="search"
          inputMode="search"
          enterKeyHint="done"
          placeholder="Search everything (e.g. tahini)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search ingredients"
        />
        {query && (
          <button className="ob-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
            ×
          </button>
        )}
      </div>

      {query.trim() ? (
        <section className="ob-results" aria-live="polite">
          {results.length > 0 && (
            <div className="ob-chips">
              {results.map((item) => (
                <Chip
                  key={item.id}
                  item={item}
                  on={p.have.has(item.id)}
                  onToggle={p.toggle}
                  hint={item.location !== p.loc.id ? LOCATIONS.find((l) => l.id === item.location)?.title : undefined}
                />
              ))}
            </div>
          )}
          {results.length === 0 && <p className="ob-empty">No match in the list.</p>}
          {!exact && (
            <button
              className="ob-add"
              onClick={() => {
                p.addCustom(query, p.loc.id);
                setQuery('');
              }}
            >
              + Add “{query.trim()}” to {p.loc.title.toLowerCase()}
            </button>
          )}
        </section>
      ) : (
        <div className="ob-cards">
          {p.groups.map((g, idx) => {
            const isOpen = openKey === g.key;
            const selected = g.items.filter((i) => p.have.has(i.id)).length;
            const common = g.items.filter((i) => i.common).map((i) => i.id);
            const showAll = expanded.has(g.key) || g.items.length <= PREVIEW + 2;
            const visible = showAll ? g.items : g.items.slice(0, Math.max(PREVIEW, common.length));
            const canUndo = undo?.key === g.key;
            return (
              <section
                key={g.key}
                className={'ob-card' + (isOpen ? ' is-open' : '') + (selected ? ' has-sel' : '')}
                ref={(el) => {
                  cardRefs.current[g.key] = el;
                }}
              >
                <button
                  className="ob-card-head"
                  onClick={() => openCard(isOpen ? null : g.key)}
                  aria-expanded={isOpen}
                >
                  <span className="ob-card-emoji" aria-hidden>
                    {g.emoji}
                  </span>
                  <span className="ob-card-name">{g.name}</span>
                  <span className="ob-card-count">
                    {selected > 0 ? (
                      <>
                        <b>{selected}</b>/{g.items.length}
                      </>
                    ) : (
                      g.items.length
                    )}
                  </span>
                  <span className="ob-chev" aria-hidden>
                    ›
                  </span>
                </button>
                {isOpen && (
                  <div className="ob-card-body">
                    <div className="ob-bulk">
                      {canUndo ? (
                        <button
                          className="ob-pill"
                          onClick={() => {
                            const ids = g.items.map((i) => i.id);
                            p.setMany(ids, false);
                            p.setMany(undo.prev, true);
                            setUndo(null);
                          }}
                        >
                          ↺ Undo
                        </button>
                      ) : (
                        common.length > 0 &&
                        common.some((id) => !p.have.has(id)) && (
                          <button
                            className="ob-pill"
                            onClick={() => {
                              setUndo({ key: g.key, prev: g.items.filter((i) => p.have.has(i.id)).map((i) => i.id) });
                              p.setMany(common, true);
                              tap();
                            }}
                          >
                            ✓ Select common ({common.length})
                          </button>
                        )
                      )}
                      {selected > 0 && !canUndo && (
                        <button
                          className="ob-pill ob-pill-quiet"
                          onClick={() => {
                            setUndo({ key: g.key, prev: g.items.filter((i) => p.have.has(i.id)).map((i) => i.id) });
                            p.setMany(
                              g.items.map((i) => i.id),
                              false,
                            );
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="ob-chips">
                      {visible.map((item) => (
                        <Chip key={item.id} item={item} on={p.have.has(item.id)} onToggle={p.toggle} />
                      ))}
                    </div>
                    {!showAll && (
                      <button
                        className="ob-more"
                        onClick={() => setExpanded((s) => new Set(s).add(g.key))}
                      >
                        Show all ({g.items.length - visible.length} more)
                      </button>
                    )}
                    <button className="ob-next-cat" onClick={() => nextCategory(idx)}>
                      {selected === 0 ? 'None of these, next' : 'Next category'}
                      {p.groups[idx + 1] ? `: ${p.groups[idx + 1].name}` : ''} ›
                    </button>
                  </div>
                )}
              </section>
            );
          })}
          <AddInline onAdd={(n) => p.addCustom(n, p.loc.id)} label={`Something else in your ${p.loc.title.toLowerCase()}?`} />
        </div>
      )}

      <footer className="ob-footer">
        <button className="ob-primary ob-wide" onClick={p.onNext}>
          {p.nextLabel} ›
        </button>
      </footer>
    </main>
  );
}

function Chip({
  item,
  on,
  onToggle,
  hint,
}: {
  item: { id: string; name: string };
  on: boolean;
  onToggle: (id: string) => void;
  hint?: string;
}) {
  return (
    <button className={'ob-chip' + (on ? ' is-on' : '')} aria-pressed={on} onClick={() => onToggle(item.id)}>
      <span className="ob-chip-check" aria-hidden>
        {on ? '✓' : '+'}
      </span>
      <span className="ob-chip-label">{item.name}</span>
      {hint && <span className="ob-chip-hint">{hint}</span>}
    </button>
  );
}

function AddInline({ onAdd, label, placeholder = 'Type an item' }: { onAdd: (n: string) => void; label: string; placeholder?: string }) {
  const [v, setV] = useState('');
  const submit = () => {
    if (!v.trim()) return;
    onAdd(v);
    setV('');
  };
  return (
    <form
      className="ob-add-inline"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label>{label}</label>
      <div className="ob-add-row">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} enterKeyHint="done" />
        <button type="submit" className="ob-pill" disabled={!v.trim()}>
          Add
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function StaplesStep({
  staples,
  setStaples,
  onNext,
}: {
  staples: Staple[];
  setStaples: React.Dispatch<React.SetStateAction<Staple[]>>;
  onNext: () => void;
}) {
  const ids = new Set(staples.map((s) => s.id));
  const extras = staples.filter((s) => !STAPLE_SUGGESTIONS.some((x) => x.id === s.id));
  const toggle = (s: Staple) => {
    tap();
    setStaples((prev) => (prev.some((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]));
  };
  const section = (title: string, list: Staple[]) => (
    <section className="ob-staple-group">
      <h2>{title}</h2>
      <div className="ob-chips">
        {list.map((s) => (
          <Chip key={s.id} item={s} on={ids.has(s.id)} onToggle={() => toggle(s)} />
        ))}
      </div>
    </section>
  );
  return (
    <main className="ob-main">
      <div className="ob-heading">
        <h1>
          <span aria-hidden>🔁</span> Always buy
        </h1>
        <p className="ob-sub">
          These go on every shopping list, whatever's in the kitchen. <span className="ob-count">{staples.length} selected</span>
        </p>
      </div>
      {section('Every week', STAPLE_SUGGESTIONS.filter((s) => s.group === 'household'))}
      {section("Kids' snacks & lunchbox", STAPLE_SUGGESTIONS.filter((s) => s.group === 'kids'))}
      {extras.length > 0 && section('Added by you', extras)}
      <AddInline
        label="Anything else you always buy?"
        placeholder="e.g. sparkling water"
        onAdd={(n) => {
          const s = makeStaple(n);
          setStaples((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
        }}
      />
      <footer className="ob-footer">
        <button className="ob-primary ob-wide" onClick={onNext}>
          Review ›
        </button>
      </footer>
    </main>
  );
}

function DoneStep({
  counts,
  staples,
  onEdit,
  onFinish,
}: {
  counts: Record<Location, number>;
  staples: Staple[];
  onEdit: (step: number) => void;
  onFinish: () => void;
}) {
  const rows = [
    ...LOCATIONS.map((l, i) => ({ step: i + 1, emoji: l.emoji, title: l.title, n: counts[l.id], unit: 'items' })),
    { step: 4, emoji: '🔁', title: 'Always buy', n: staples.length, unit: 'staples' },
  ];
  return (
    <main className="ob-main ob-done">
      <div className="ob-done-badge" aria-hidden>
        ✓
      </div>
      <h1>Your kitchen is set</h1>
      <p className="ob-lede">Next, pick this week's dinners. Cookin will list only what you're missing.</p>
      <ul className="ob-summary">
        {rows.map((r) => (
          <li key={r.title}>
            <span className="ob-summary-emoji" aria-hidden>
              {r.emoji}
            </span>
            <span className="ob-summary-title">{r.title}</span>
            <span className="ob-summary-n">
              {r.n} {r.unit}
            </span>
            <button className="ob-link" onClick={() => onEdit(r.step)}>
              Edit
            </button>
          </li>
        ))}
      </ul>
      <footer className="ob-footer">
        <button className="ob-primary ob-wide" onClick={onFinish}>
          Plan my week ›
        </button>
      </footer>
    </main>
  );
}
