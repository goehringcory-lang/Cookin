/**
 * First-run setup: Welcome -> Pantry -> Fridge -> Freezer -> Always buy -> Review.
 * Every tap writes straight to the shared store (inventory, customItems, staples, settings),
 * so progress syncs across devices and survives an interruption. Only the walkthrough
 * position (which step, which category is open) is kept per device.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, Location, Staple } from "@shared/types";
import { store, useCollection } from "@shared/store";
import { setStatus, updateSettings, useCatalogVersion, useOwned, useSettings } from "@shared/domain";
import { allItems, catalogGroups } from "@shared/catalog";
import { navigate } from "../../app/nav";
import {
  LOCATIONS,
  clearProgress,
  loadProgress,
  makeCustomItem,
  rankedSearch,
  saveProgress,
  toGroups,
  type CategoryGroup,
} from "./model";
import { STAPLE_SUGGESTIONS, makeStaple } from "./staples";
import "./onboarding.css";

/** Adds custom items the catalog hasn't picked up yet to an "Added by you" group. */
function withCustom(groups: CategoryGroup[], items: CatalogItem[], loc: Location): CategoryGroup[] {
  const shown = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  const missing = items.filter((i) => i.custom && i.location === loc && !shown.has(i.id));
  if (!missing.length) return groups;
  const key = "Added by you";
  const existing = groups.find((g) => g.key === key);
  if (existing) return groups.map((g) => (g === existing ? { ...g, items: [...g.items, ...missing] } : g));
  return [...groups, { key, name: key, emoji: "✏️", items: missing }];
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** "Step n of 5" counts the five screens after Welcome. */
const STEP_COUNT = 5;
const PREVIEW = 10; // chips shown per category before "Show all"

const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not supported */
  }
};

export function Onboarding() {
  const settings = useSettings();
  const owned = useOwned();
  const customDocs = useCollection("customItems");
  const stapleDocs = useCollection("staples");
  const hasRecipes = Object.keys(useCollection("recipes")).length > 0;
  const progress = useMemo(() => loadProgress(), []);
  const [step, setStep] = useState(progress?.step ?? 0);
  const [open, setOpen] = useState<Partial<Record<Location, string | null>>>(progress?.open ?? {});

  useEffect(() => saveProgress({ step, open }), [step, open]);

  // The shell pushes custom items into the catalog in a layout effect after this renders,
  // so key on the catalog version (and the docs, for the first paint) to never read a stale catalog.
  const catalogVersion = useCatalogVersion();
  const items = useMemo(() => {
    const base = allItems();
    const ids = new Set(base.map((i) => i.id));
    const extra = Object.values(customDocs).filter((c) => !ids.has(c.id)).map((c) => ({ ...c, custom: true }));
    return [...base, ...extra];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customDocs, catalogVersion]);

  const counts = useMemo(() => {
    const byLoc: Record<Location, number> = { pantry: 0, fridge: 0, freezer: 0 };
    for (const it of items) if (owned.has(it.id) && !it.assumed) byLoc[it.location]++;
    return byLoc;
  }, [items, owned]);

  const go = (next: number) => {
    setStep(Math.max(0, Math.min(STEP_COUNT, next)));
    window.scrollTo({ top: 0 });
  };

  const toggle = (id: string) => {
    buzz();
    setStatus([id], owned.has(id) ? "out" : "have");
  };
  const setMany = (ids: string[], on: boolean) => {
    if (ids.length) setStatus(ids, on ? "have" : "out");
  };
  const addCustom = (name: string, location: Location) => {
    const item = makeCustomItem(name, location);
    if (!item.id || item.id === "c-") return;
    const existing = items.find((c) => c.name.toLowerCase() === item.name.toLowerCase());
    if (existing) return setStatus([existing.id], "have");
    store.put("customItems", item.id, item);
    setStatus([item.id], "have");
  };

  const finish = (to = "home") => {
    clearProgress();
    updateSettings({ onboardingComplete: true });
    navigate(to);
  };

  if (step === 0)
    return (
      <Welcome
        onStart={() => go(1)}
        rerun={settings.onboardingComplete}
        resumed={!settings.onboardingComplete && owned.size > 0}
        onClose={settings.onboardingComplete ? () => finish() : undefined}
      />
    );

  const loc = step >= 1 && step <= 3 ? LOCATIONS[step - 1] : null;

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
          {step < STEP_COUNT ? (
            <button className="ob-link" onClick={() => go(step + 1)}>
              Skip
            </button>
          ) : (
            <span className="ob-link-spacer" />
          )}
        </div>
        <div
          className="ob-progress"
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={0}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={step}
        >
          <div className="ob-progress-fill" style={{ width: `${(step / STEP_COUNT) * 100}%` }} />
        </div>
      </header>

      {loc && (
        <LocationStep
          key={loc.id}
          loc={loc}
          items={items}
          groups={withCustom(toGroups(catalogGroups(loc.id)), items, loc.id)}
          owned={owned}
          count={counts[loc.id]}
          openKey={open[loc.id]}
          setOpenKey={(k) => setOpen((o) => ({ ...o, [loc.id]: k }))}
          toggle={toggle}
          setMany={setMany}
          addCustom={addCustom}
          onNext={() => go(step + 1)}
          nextLabel={step < 3 ? `Next: ${LOCATIONS[step].title}` : "Next: Always-buy items"}
        />
      )}

      {step === 4 && <StaplesStep docs={stapleDocs} onNext={() => go(5)} />}

      {step === 5 && (
        <ReviewStep
          counts={counts}
          staples={Object.values(stapleDocs).filter((s) => s.active).length}
          dinners={settings.dinnersPerWeek}
          people={settings.householdSize}
          onEdit={go}
          onFinish={finish}
          hasRecipes={hasRecipes}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Welcome({
  onStart,
  resumed,
  rerun,
  onClose,
}: {
  onStart: () => void;
  resumed: boolean;
  rerun: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="ob ob-welcome">
      {onClose && (
        <button className="ob-link ob-close" onClick={onClose}>
          Close
        </button>
      )}
      <div className="ob-welcome-art" aria-hidden>
        <span>🥫</span>
        <span>🧀</span>
        <span>🧊</span>
      </div>
      <h1>{rerun ? "Walk through your kitchen" : "Dinner, sorted."}</h1>
      <p className="ob-lede">
        Tell me what's in your kitchen once. I'll show which recipes you can make and write the list for what's
        missing.
      </p>
      <ul className="ob-welcome-points">
        <li>
          <b>About 5 minutes.</b> Everything saves as you go, on every device.
        </li>
        <li>
          <b>Roughly is fine.</b> Skip fresh herbs, greens and raw meat; those get bought per recipe.
        </li>
        <li>
          <b>Change it anytime</b> from the Kitchen tab.
        </li>
      </ul>
      <button className="ob-primary ob-wide" onClick={onStart}>
        {resumed ? "Pick up where I left off" : "Let's go"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface LocationStepProps {
  loc: (typeof LOCATIONS)[number];
  items: CatalogItem[];
  groups: CategoryGroup[];
  owned: Set<string>;
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
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<{ key: string; prev: string[] } | null>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  // First visit: open the first category.
  const openKey = p.openKey === undefined ? (p.groups[0]?.key ?? null) : p.openKey;

  const results = useMemo(() => rankedSearch(p.items, query), [p.items, query]);
  const exact = results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  const scrollTo = (key: string) =>
    requestAnimationFrame(() => cardRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const openCard = (key: string | null) => {
    p.setOpenKey(key);
    setUndo(null);
    if (key) scrollTo(key);
  };

  const nextCategory = (idx: number) => {
    const next = p.groups[idx + 1];
    if (next) openCard(next.key);
    else {
      p.setOpenKey(null);
      setUndo(null);
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
    }
  };

  return (
    <section className="ob-main">
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
          <button className="ob-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
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
                  name={item.name}
                  on={p.owned.has(item.id)}
                  onToggle={() => p.toggle(item.id)}
                  hint={item.location !== p.loc.id ? LOCATIONS.find((l) => l.id === item.location)?.title : undefined}
                />
              ))}
            </div>
          )}
          {results.length === 0 && <p className="ob-empty">Not in the list yet.</p>}
          {!exact && (
            <button
              className="ob-add"
              onClick={() => {
                p.addCustom(query, p.loc.id);
                setQuery("");
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
            const selected = g.items.filter((i) => p.owned.has(i.id)).length;
            const common = g.items.filter((i) => i.common).map((i) => i.id);
            const showAll = expanded.has(g.key) || g.items.length <= PREVIEW + 2;
            const visible = showAll ? g.items : g.items.slice(0, Math.max(PREVIEW, common.length));
            const canUndo = undo?.key === g.key;
            const snapshot = () => setUndo({ key: g.key, prev: g.items.filter((i) => p.owned.has(i.id)).map((i) => i.id) });
            const next = p.groups[idx + 1];
            return (
              <section
                key={g.key}
                className={"ob-card" + (isOpen ? " is-open" : "")}
                ref={(el) => {
                  cardRefs.current[g.key] = el;
                }}
              >
                <button className="ob-card-head" onClick={() => openCard(isOpen ? null : g.key)} aria-expanded={isOpen}>
                  <span className="ob-card-emoji" aria-hidden>
                    {g.emoji}
                  </span>
                  <span className="ob-card-name">{g.name}</span>
                  <span className="ob-card-count" aria-label={`${selected} of ${g.items.length} selected`}>
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
                            const prev = new Set(undo.prev);
                            p.setMany(
                              g.items.filter((i) => !prev.has(i.id) && p.owned.has(i.id)).map((i) => i.id),
                              false,
                            );
                            p.setMany(undo.prev.filter((id) => !p.owned.has(id)), true);
                            setUndo(null);
                          }}
                        >
                          ↺ Undo
                        </button>
                      ) : (
                        common.some((id) => !p.owned.has(id)) && (
                          <button
                            className="ob-pill"
                            onClick={() => {
                              snapshot();
                              p.setMany(common.filter((id) => !p.owned.has(id)), true);
                              buzz();
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
                            snapshot();
                            p.setMany(g.items.filter((i) => p.owned.has(i.id)).map((i) => i.id), false);
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="ob-chips">
                      {visible.map((item) => (
                        <Chip key={item.id} name={item.name} on={p.owned.has(item.id)} onToggle={() => p.toggle(item.id)} />
                      ))}
                    </div>
                    {!showAll && (
                      <button className="ob-more" onClick={() => setExpanded((s) => new Set(s).add(g.key))}>
                        Show all ({g.items.length - visible.length} more)
                      </button>
                    )}
                    <button className="ob-next-cat" onClick={() => nextCategory(idx)}>
                      {selected === 0 ? "None of these" : "Done"}
                      {next ? `, next: ${next.name}` : ""} ›
                    </button>
                  </div>
                )}
              </section>
            );
          })}
          <AddInline
            onAdd={(n) => p.addCustom(n, p.loc.id)}
            label={`Something else in your ${p.loc.title.toLowerCase()}?`}
            placeholder="e.g. smoked salmon"
          />
        </div>
      )}

      <footer className="ob-footer">
        <button className="ob-primary ob-wide" onClick={p.onNext}>
          {p.nextLabel} ›
        </button>
      </footer>
    </section>
  );
}

function Chip({ name, on, onToggle, hint }: { name: string; on: boolean; onToggle: () => void; hint?: string }) {
  return (
    <button className={"ob-chip" + (on ? " is-on" : "")} aria-pressed={on} onClick={onToggle}>
      <span className="ob-chip-check" aria-hidden>
        {on ? "✓" : "+"}
      </span>
      <span className="ob-chip-label">{name}</span>
      {hint && <span className="ob-chip-hint">{hint}</span>}
    </button>
  );
}

function AddInline({ onAdd, label, placeholder }: { onAdd: (n: string) => void; label: string; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <form
      className="ob-add-inline"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        onAdd(v);
        setV("");
      }}
    >
      <label>
        {label}
        <div className="ob-add-row">
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} enterKeyHint="done" />
          <button type="submit" className="ob-pill" disabled={!v.trim()}>
            Add
          </button>
        </div>
      </label>
    </form>
  );
}

// ---------------------------------------------------------------------------

function StaplesStep({ docs, onNext }: { docs: Record<string, Staple>; onNext: () => void }) {
  // Seed the shared defaults (milk, bananas, eggs, bread, cereal) the first time.
  useEffect(() => {
    const now = Date.now();
    const missing = STAPLE_SUGGESTIONS.filter((s) => s.kind !== "kids-snack" && s.active && !docs[s.id]);
    if (missing.length)
      store.putMany(missing.map((s) => ({ c: "staples" as const, id: s.id, data: { ...s, updatedAt: now } })));
      // Seed once on mount; later changes come from taps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOn = (id: string) => docs[id]?.active ?? false;
  const toggle = (s: Omit<Staple, "updatedAt">) => {
    buzz();
    const cur = docs[s.id] ?? s;
    store.put("staples", s.id, { ...cur, active: !isOn(s.id), updatedAt: Date.now() });
  };

  const extras = Object.values(docs).filter((d) => !STAPLE_SUGGESTIONS.some((s) => s.id === d.id));
  const count = Object.values(docs).filter((d) => d.active).length;
  const section = (title: string, list: Omit<Staple, "updatedAt">[], note?: string) => (
    <section className="ob-staple-group">
      <h2>{title}</h2>
      {note && <p className="ob-note">{note}</p>}
      <div className="ob-chips">
        {list.map((s) => (
          <Chip key={s.id} name={s.name} on={isOn(s.id)} onToggle={() => toggle(s)} />
        ))}
      </div>
    </section>
  );

  return (
    <section className="ob-main">
      <div className="ob-heading">
        <h1>
          <span aria-hidden>🔁</span> Always buy
        </h1>
        <p className="ob-sub">
          These go on every shopping list, whatever's in the kitchen. <span className="ob-count">{count} selected</span>
        </p>
      </div>
      {section("Every trip", STAPLE_SUGGESTIONS.filter((s) => s.kind !== "kids-snack"))}
      {section(
        "Kids' snacks & lunchbox",
        STAPLE_SUGGESTIONS.filter((s) => s.kind === "kids-snack"),
        "Tap the ones you buy most weeks.",
      )}
      {extras.length > 0 && section("Added by you", extras)}
      <AddInline
        label="Anything else you always buy?"
        placeholder="e.g. sparkling water"
        onAdd={(n) => {
          const s = makeStaple(n);
          if (!s.id) return;
          store.put("staples", s.id, { ...(docs[s.id] ?? s), active: true, updatedAt: Date.now() });
        }}
      />
      <footer className="ob-footer">
        <button className="ob-primary ob-wide" onClick={onNext}>
          Review ›
        </button>
      </footer>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="ob-stepper">
      <span className="ob-stepper-label">{label}</span>
      <button aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="ob-stepper-value" aria-live="polite">
        {value}
      </span>
      <button aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function ReviewStep({
  counts,
  staples,
  dinners,
  people,
  onEdit,
  onFinish,
  hasRecipes,
}: {
  counts: Record<Location, number>;
  staples: number;
  dinners: number;
  people: number;
  onEdit: (step: number) => void;
  onFinish: (to?: string) => void;
  hasRecipes: boolean;
}) {
  const rows = [
    ...LOCATIONS.map((l, i) => ({ step: i + 1, emoji: l.emoji, title: l.title, n: plural(counts[l.id], "item") })),
    { step: 4, emoji: "🔁", title: "Always buy", n: plural(staples, "item") },
  ];
  return (
    <section className="ob-main ob-done">
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
            <span className="ob-summary-n">{r.n}</span>
            <button className="ob-link" onClick={() => onEdit(r.step)} aria-label={`Edit ${r.title}`}>
              Edit
            </button>
          </li>
        ))}
      </ul>
      <div className="ob-summary ob-household">
        <Stepper label="Dinners a week" value={dinners} min={1} max={7} onChange={(n) => updateSettings({ dinnersPerWeek: n })} />
        <Stepper label="Cooking for" value={people} min={1} max={12} onChange={(n) => updateSettings({ householdSize: n })} />
      </div>
      {!hasRecipes && (
        <button className="ob-nyt" onClick={() => onFinish("recipes")}>
          <span aria-hidden>📖</span>
          <span>
            <b>Bring in your NYT Recipe Box</b>
            <small>Set up the Sync button and the weekly Sunday sync.</small>
          </span>
          <span aria-hidden>›</span>
        </button>
      )}
      <footer className="ob-footer">
        <button className="ob-primary ob-wide" onClick={() => onFinish()}>
          Plan my week ›
        </button>
      </footer>
    </section>
  );
}
