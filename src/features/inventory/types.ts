// View-model types for the Kitchen (pantry / fridge / freezer) screen.
// Storage lives in the shared store (collection `inventory`, see src/shared/types.ts);
// KitchenScreen.tsx maps it to these and back.
import type { Location, StockStatus } from "@shared/types";

export type StorageLocation = Location;
export type { StockStatus };

/**
 * One stocked item on screen.
 * have: in stock. low: still owned, goes on the grocery list.
 * out: ran out. Goes on the list when a planned recipe needs it, or when added by hand.
 * Catalog items with no inventory doc are "not in the kitchen" and are not shown here.
 */
export interface InventoryItem {
  /** Catalog item id (also the inventory doc id). */
  id: string;
  name: string;
  location: StorageLocation;
  category: string;
  status: StockStatus;
  custom?: boolean;
  updatedAt: number;
  /** For out items: a planned meal this week that needs it, e.g. "Tue dinner". */
  neededFor?: string;
  /** Put on the grocery list by hand from this screen. */
  onList?: boolean;
}

/** One entry from the ingredient catalog that can be added. */
export interface CatalogEntry {
  id: string;
  name: string;
  location: StorageLocation;
  category: string;
  aliases?: string[];
}

export interface NewItemInput {
  /** Catalog id for catalog items; omitted for a brand-new custom item. */
  catalogId?: string;
  name: string;
  location: StorageLocation;
  category: string;
  status?: StockStatus;
}

/** Everything the screen needs to change data. */
export interface InventoryActions {
  setStatus(ids: string[], status: StockStatus): void;
  /** Adds items (status defaults to have) and returns their ids in the same order. */
  addItems(items: NewItemInput[]): string[];
  removeItem(id: string): void;
  /** Only custom items can be renamed or moved; catalog items keep their catalog name and place. */
  updateItem(id: string, patch: Partial<Pick<InventoryItem, "name" | "location" | "category">>): void;
  /** Add an out item to the grocery list (or take it off again). */
  setOnList(id: string, on: boolean): void;
}

export const LOCATIONS: { id: StorageLocation; label: string; icon: string }[] = [
  { id: "pantry", label: "Pantry", icon: "🥫" },
  { id: "fridge", label: "Fridge", icon: "🧊" },
  { id: "freezer", label: "Freezer", icon: "❄️" },
];
