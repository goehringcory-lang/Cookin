/**
 * Recipes tab: Cory's recipe library. Add a recipe by pasting (or sharing) an NYT Cooking gift
 * link or any recipe link; remove one from its detail screen. Searchable, with "can make now"
 * matching against the kitchen inventory.
 */
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useCollection } from "@shared/store";
import { useOwned } from "@shared/domain";
import { analyzeRecipe } from "@shared/catalog";

import { RecipeCard, RecipeGrid, SearchField } from "@shared/ui";
import { AddRecipeSheet } from "./AddRecipeSheet";
import { filterRecipes, FILTERS, type FilterId, type Row } from "./filter";
import "./recipes.css";

export function RecipesScreen({ add }: { add?: string }) {
  const recipes = useCollection("recipes");
  const owned = useOwned();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q);
  const [filter, setFilter] = useState<FilterId | null>(null);
  // #recipes/add or #recipes/add=<shared link> opens the Add sheet.
  const [sheet, setSheet] = useState(add !== undefined);
  const shared = add && add.length ? add : undefined;
  const closeSheet = useCallback(() => { setSheet(false); if (location.hash.startsWith("#recipes/")) history.replaceState(null, "", "#recipes"); }, []);

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
          <div className="ck-appbar__sub ck-muted ck-small">{active.length ? `${active.length} recipe${active.length === 1 ? "" : "s"} in your library` : "Your library"}</div>
        </div>
        <div className="ck-appbar__actions">
          <button className="ck-btn ck-btn--primary ck-recipes__add" onClick={() => setSheet(true)} aria-label="Add a recipe">+ Add</button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="ck-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10" /></svg>
          <h2 className="ck-h2">Build your recipe library</h2>
          <p>Paste an NYT Cooking gift link for each dish you want to cook. Cookin reads the ingredients and plans your week from them.</p>
          <button className="ck-btn ck-btn--primary" onClick={() => setSheet(true)}>Add a recipe</button>
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
      {sheet && <AddRecipeSheet onClose={closeSheet} initial={shared} />}
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
