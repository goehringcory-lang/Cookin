import type { CatalogItem } from '../types';

/** Catalog item as written in the data files. `location` is filled in from the category. */
export type RawItem = Omit<CatalogItem, 'location'>;
