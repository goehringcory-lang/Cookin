import type { Category } from '../types';

/** Ordered for the onboarding walkthrough: pantry, then fridge, then freezer. */
export const CATEGORIES: Category[] = [
  // Pantry
  { id: 'baking', name: 'Flours & baking', location: 'pantry', icon: '🧁' },
  { id: 'sweeteners', name: 'Sugars & sweeteners', location: 'pantry', icon: '🍯' },
  { id: 'pasta', name: 'Pasta & noodles', location: 'pantry', icon: '🍝' },
  { id: 'rice-grains', name: 'Rice & grains', location: 'pantry', icon: '🍚' },
  { id: 'beans-lentils', name: 'Dried beans & lentils', location: 'pantry', icon: '🫘' },
  { id: 'canned', name: 'Canned & jarred goods', location: 'pantry', icon: '🥫' },
  { id: 'broths', name: 'Broths & stocks', location: 'pantry', icon: '🍲' },
  { id: 'oils-vinegars', name: 'Oils & vinegars', location: 'pantry', icon: '🫒' },
  { id: 'sauces', name: 'Sauces & condiments', location: 'pantry', icon: '🍶' },
  { id: 'spices', name: 'Spices & dried herbs', location: 'pantry', icon: '🧂' },
  { id: 'nuts-seeds', name: 'Nuts, seeds & dried fruit', location: 'pantry', icon: '🥜' },
  { id: 'bread', name: 'Bread, tortillas & crackers', location: 'pantry', icon: '🍞' },
  { id: 'snacks', name: 'Snacks & lunchbox', location: 'pantry', icon: '🍪' },
  { id: 'counter-produce', name: 'Onions, garlic, potatoes & counter fruit', location: 'pantry', icon: '🧅' },
  { id: 'wine-spirits', name: 'Wine & spirits for cooking', location: 'pantry', icon: '🍷' },
  // Fridge
  { id: 'dairy', name: 'Milk, cream, butter & eggs', location: 'fridge', icon: '🧈' },
  { id: 'cheese', name: 'Cheese', location: 'fridge', icon: '🧀' },
  { id: 'meat', name: 'Meat & poultry', location: 'fridge', icon: '🥩' },
  { id: 'seafood', name: 'Fish & seafood', location: 'fridge', icon: '🐟' },
  { id: 'deli', name: 'Deli & ready-to-eat', location: 'fridge', icon: '🥪' },
  { id: 'vegetables', name: 'Vegetables', location: 'fridge', icon: '🥕' },
  { id: 'fruit', name: 'Fruit', location: 'fridge', icon: '🍎' },
  { id: 'fresh-herbs', name: 'Fresh herbs', location: 'fridge', icon: '🌿' },
  { id: 'fridge-condiments', name: 'Fridge condiments', location: 'fridge', icon: '🫙' },
  // Freezer
  { id: 'frozen-vegetables', name: 'Frozen vegetables', location: 'freezer', icon: '🥦' },
  { id: 'frozen-fruit', name: 'Frozen fruit', location: 'freezer', icon: '🍓' },
  { id: 'frozen-protein', name: 'Frozen meat & seafood', location: 'freezer', icon: '🍤' },
  { id: 'frozen-dough', name: 'Frozen dough & pastry', location: 'freezer', icon: '🥐' },
  { id: 'frozen-meals', name: 'Frozen meals & kid favorites', location: 'freezer', icon: '🍕' },
  { id: 'frozen-treats', name: 'Ice cream & treats', location: 'freezer', icon: '🍦' },
  // Hidden: assumed and generic items (never shown in onboarding)
  { id: 'basics', name: 'Always on hand', location: 'pantry', icon: '💧' },
  { id: 'generic', name: 'Generic recipe terms', location: 'pantry', icon: '📦' },
];

export const HIDDEN_CATEGORIES = new Set(['basics', 'generic']);
