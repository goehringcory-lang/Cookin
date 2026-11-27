# Feature modules

Each folder is owned by one thread. Export the screen component(s) the shell mounts from
`index.tsx` with the names below; everything else in the folder is private to that feature.

| Folder | Owner thread | Exports used by the shell |
|---|---|---|
| onboarding/ | First-run onboarding | `Onboarding` (route `#onboarding`) |
| inventory/ | Pantry, fridge and freezer screens | `KitchenScreen` (tab `#kitchen`) |
| planner/ | Weekly planner and home screen | `HomeScreen` (tab `#home`) |
| recipe/ | Weekly planner and home screen | `RecipeScreen` (route `#recipe/<id>`) |
| recipes/ | NYT sync thread | `RecipesScreen` (tab `#recipes`) |
| nyt-sync/ | NYT sync thread | used inside RecipesScreen; `#import` route handler |
| lunches/ | Lunches and leftovers | functions/components the planner and list import |
| shopping/ | Shopping list and Keep | `ListScreen` (tab `#list`), `useShoppingList()` |
| staples/ | Shopping list thread (with onboarding) | staple editor components |
