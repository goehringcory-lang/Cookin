/** Where an item normally lives. Each item lives in exactly one place. */
export type Location = 'pantry' | 'fridge' | 'freezer';

/**
 * One selectable ingredient. Matches the shape the ingredient catalog
 * thread exports; `common` items are listed first and are what
 * "Select common" picks.
 */
export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  location: Location;
  common?: boolean;
  aliases?: string[];
  /** Always-have items (salt, water). Hidden from onboarding. */
  assumed?: boolean;
  /** Generic match targets like 'short-pasta'. Hidden from onboarding. */
  generic?: boolean;
  /** Generic ids this item stands in for, e.g. penne -> short-pasta. */
  satisfies?: string[];
  /** True for items the user typed in during setup. */
  custom?: boolean;
}

/** Category order for the walkthrough, from the catalog package. */
export interface CategoryInfo {
  id: string;
  name: string;
  location: Location;
  emoji?: string;
}

/** A recurring "always buy" item that goes on every shopping list. */
export interface Staple {
  id: string;
  name: string;
  group: 'household' | 'kids';
}

/** What onboarding hands to the app's shared store when it saves. */
export interface OnboardingResult {
  haveIds: string[];
  customItems: CatalogItem[];
  staples: Staple[];
}

/**
 * The app shell passes this in. Onboarding never talks to the database
 * directly, so it works with whatever store the lead thread builds.
 */
export interface OnboardingAdapter {
  catalog: CatalogItem[];
  /** Optional category order. Items' `category` may be an id or a name. */
  categories?: CategoryInfo[];
  /** Called after each step and at the end. Should be idempotent. */
  save(result: OnboardingResult): Promise<void> | void;
  /** Called when the user taps the final button. */
  onFinish(result: OnboardingResult): void;
  /** Pre-existing inventory, e.g. when re-running setup later. */
  initial?: Partial<OnboardingResult>;
}
