import { useEffect } from "react";
import { useRoute, navigate } from "./nav";
import { useSettings, useCustomItemsSync } from "@shared/domain";
import { useSyncStatus } from "@shared/store";
import { Onboarding } from "@features/onboarding";
import { HomeScreen } from "@features/planner";
import { ListScreen } from "@features/shopping";
import { KitchenScreen } from "@features/inventory";
import { RecipesScreen } from "@features/recipes";
import { RecipeScreen } from "@features/recipe";
import { ToastHost } from "@shared/ui";
import { UiGallery } from "@shared/ui/Gallery";

const TABS = [
  { name: "home", label: "This week", icon: "M4 6.5h16v13H4zM4 10.5h16M8.5 4v4M15.5 4v4" },
  { name: "list", label: "List", icon: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" },
  { name: "kitchen", label: "Kitchen", icon: "M6 3h12v18H6zM6 10h12M9.5 6v1.5M9.5 13v3" },
  { name: "recipes", label: "Recipes", icon: "M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10" },
];

export function App() {
  useCustomItemsSync();
  const settings = useSettings();
  const route = useRoute();
  const status = useSyncStatus();
  const onboarding = !settings.onboardingComplete || route.name === "onboarding";

  useEffect(() => { window.scrollTo(0, 0); }, [route.name, route.param]);

  if (onboarding) return <main className="ck-app ck-app--bare"><Onboarding /></main>;

  let screen;
  switch (route.name) {
    case "list": screen = <ListScreen />; break;
    case "kitchen": screen = <KitchenScreen />; break;
    case "recipes": screen = <RecipesScreen />; break;
    case "recipe": screen = <RecipeScreen id={route.param || ""} />; break;
    case "ui": screen = <UiGallery />; break;
    default: screen = <HomeScreen />;
  }
  const active = route.name === "recipe" ? "recipes" : TABS.some(t => t.name === route.name) ? route.name : "home";
  return (
    <div className="ck-app">
      {status === "unauthorized" && <div className="ck-banner" role="status">You're signed out. Reload the page to sign in again.</div>}
      <main className="ck-main">{screen}</main>
      <nav className="ck-tabbar" aria-label="Sections">
        {TABS.map(t => (
          <button key={t.name} className="ck-tabbar__tab" aria-current={active === t.name ? "page" : undefined} onClick={() => navigate(t.name)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.icon} /></svg>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
      <ToastHost />
    </div>
  );
}
