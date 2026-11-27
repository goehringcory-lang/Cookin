/**
 * Planner feature: the "This week" tab. The shell mounts <HomeScreen /> for #home and for any
 * route it doesn't know, so this also serves #plan/... (see routes.ts for the URL scheme).
 */
import { useRoute } from "../../app/nav";
import { Home } from "./Home";
import { PlanWeek } from "./PlanWeek";
import { MealSheet } from "./MealSheet";
import { parseParams } from "./routes";
import { ToastHost } from "./ui";
import "./planner.css";

export function HomeScreen() {
  const route = useRoute();
  const { params } = parseParams(route.param);
  if (route.name === "plan") {
    return (
      <>
        <PlanWeek key={`${params.w}|${params.s}`} week={params.w} slot={params.s} />
        <ToastHost />
      </>
    );
  }
  return (
    <>
      <Home start={params.w} />
      {params.m && <MealSheet slot={params.m} mode={params.x} week={params.w} />}
      <ToastHost />
    </>
  );
}

export { SwapBar } from "./SwapBar";
export { swapOptions, rankForPlanning, scaleLine, servingFactor } from "./logic";
export { href as plannerHref } from "./routes";
