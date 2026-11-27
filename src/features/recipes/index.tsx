/**
 * Recipes tab: Cory's NYT Recipe Box (plus any recipes added by hand), searchable, with
 * "can make now" matching against the kitchen inventory.
 */
import { useDeferredValue, useMemo, useState } from "react";
import { useCollection } from "@shared/store";
import { useOwned } from "@shared/domain";
import { analyzeRecipe } from "@shared/catalog";

import { RecipeCard, RecipeGrid, SearchField } from "@shared/ui";
import { SyncSheet, SyncStatusBadge } from "@features/nyt-sync";
import { filterRecipes, FILTERS, type FilterId, type Row } from "./filter";
import "./recipes.css";

export function RecipesScreen() {
  const recipes = useCollection("recipes");
  const owned = useOwned();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const [filter, setFilter] = useState<FilterId | null>(null);
  const [sheet, setSheet] = useState(false);

  const rows: Row[] = useMemo(
    () => Object.values(recipes).map(r => ({ recipe: r, missing: analyzeRecipe(r, owned).missing.length })),
    [recipes, owned],
  );
  const active = rows.filter(r => !r.recipe.archived);
  const shown = filterRecipes(rows, query, filter);
  const archivedCount = rows.length - active.length;

  return (
    <section className="ck-screen ck-recipes">
      <header className="ck-appbar">
        <div>
          <h1 className="ck-h1">Recipes</h1>
          <div className="ck-appbar__sub"><SyncStatusBadge count={active.length} onClick={() => setSheet(true)} /></div>
        </div>
        <div className="ck-appbar__actions">
          <button className="ck-btn ck-btn--secondary ck-btn--sm" onClick={() => setSheet(true)}>Sync</button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="ck-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10" /></svg>
          <h2 className="ck-h2">Bring in your Recipe Box</h2>
          <p>Sync your saved NYT Cooking recipes once and Cokkin keeps up with the new ones.</p>
          <button className="ck-btn ck-btn--primary" onClick={() => setSheet(true)}>Sync from NYT Cooking</button>
        </div>
      ) : (
        <>
          <SearchField value={q} onChange={setQ} placeholder="Search recipes or ingredients" label="Search recipes" />
          <div className="ck-chips ck-chips--scroll ck-recipes__chips" role="group" aria-label="Filter recipes">
            {FILTERS.filter(f => f.id !== "archived" || archivedCount > 0).map(f => (
              <button key={f.id} type="button" className="ck-chip ck-chip--filter" aria-pressed={filter === f.id} onClick={() => setFilter(filter === f.id ? null : f.id)}>
                {f.label}{f.id === "archived" ? ` (${archivedCount})` : ""}
              </button>
            ))}
          </div>
          <p className="ck-muted ck-small ck-recipes__count" aria-live="polite">{shown.length === active.length && !filter && !query ? `${active.length} recipes` : `${shown.length} of ${filter === "archived" ? archivedCount : active.length}`}</p>
          {shown.length ? (
            <RecipeGrid>{shown.map(r => <RecipeTile key={r.recipe.id} row={r} />)}</RecipeGrid>
          ) : (
            <div className="ck-empty"><p>No recipes match{query ? ` “${query}”` : ""}.</p><button className="ck-btn ck-btn--ghost" onClick={() => { setQ(""); setFilter(null); }}>Clear</button></div>
          )}
        </>
      )}
      {sheet && <SyncSheet onClose={() => setSheet(false)} />}
    </section>
  );
}

function RecipeTile({ row: { recipe: r, missing } }: { row: Row }) {
  return (
    <RecipeCard
      title={r.title}
      image={r.imageUrl}
      minutes={r.totalMinutes || undefined}
      missing={r.ingredients.length ? missing : undefined}
      meta={r.ingredients.length ? undefined : <span>No ingredients yet</span>}
      href={`#recipe/${encodeURIComponent(r.id)}`}
    />
  );
}
