import type { Staple } from './types';

const s = (group: Staple['group'], name: string): Staple => ({
  id: 'staple:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name,
  group,
});

/** Cory asked for these three to always be on the list. */
export const DEFAULT_STAPLE_NAMES = ['Milk', 'Bananas', 'Fig bars', 'Fruit bars'];

export const STAPLE_SUGGESTIONS: Staple[] = [
  ...['Milk', 'Bananas', 'Eggs', 'Bread', 'Cereal', 'Butter', 'Coffee', 'Juice boxes'].map((n) => s('household', n)),
  ...[
    'Fig bars',
    'Fruit bars',
    'Fruit leather',
    'Applesauce pouches',
    'String cheese',
    'Yogurt tubes',
    'Goldfish crackers',
    'Granola bars',
    'Pretzels',
    'Clementines',
    'Apples',
    'Grapes',
    'Baby carrots',
    'Peanut butter',
    'Jelly',
    'Deli turkey',
  ].map((n) => s('kids', n)),
];

export const makeStaple = (name: string): Staple => s('household', name.trim());
