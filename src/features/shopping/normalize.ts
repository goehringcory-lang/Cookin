// Turns recipe ingredient names into a stable key so "2 large Yellow Onions,
// diced" and "1 onion" merge into one "onion" line.

const DESCRIPTORS = new Set([
  'fresh', 'freshly', 'large', 'small', 'medium', 'extra', 'chopped', 'diced',
  'minced', 'sliced', 'thinly', 'finely', 'roughly', 'coarsely', 'grated',
  'shredded', 'crushed', 'peeled', 'seeded', 'trimmed', 'halved', 'quartered',
  'cubed', 'melted', 'softened', 'room', 'temperature', 'cold', 'warm', 'hot',
  'packed', 'lightly', 'plus', 'more', 'for', 'serving', 'garnish', 'to', 'taste',
  'optional', 'about', 'divided', 'whole', 'boneless', 'skinless', 'ripe',
  'heaping', 'level', 'cut', 'into', 'pieces', 'inch', 'rinsed', 'drained',
  'and', 'or', 'of', 'a', 'an', 'the', 'such', 'as', 'good', 'quality',
  'kosher', 'flaky', 'unsalted', 'salted', 'loosely', 'tightly', 'torn',
]);

/** Words kept even though they look like descriptors, because they change the item. */
const KEEP_PHRASES: Array<[RegExp, string]> = [
  [/\bkosher salt\b/g, 'salt'],
  [/\bsea salt\b/g, 'salt'],
  [/\bunsalted butter\b/g, 'butter'],
  [/\bsalted butter\b/g, 'butter'],
  [/\ball[- ]purpose flour\b/g, 'flour'],
  [/\bap flour\b/g, 'flour'],
  [/\bextra[- ]virgin olive oil\b/g, 'olive oil'],
  [/\bground black pepper\b/g, 'black pepper'],
  [/\bblack peppercorns?\b/g, 'black pepper'],
  [/\bscallions?\b/g, 'green onion'],
  [/\bspring onions?\b/g, 'green onion'],
  [/\bgarlic cloves?\b/g, 'garlic'],
  [/\bcloves? garlic\b/g, 'garlic'],
  [/\bcloves? of garlic\b/g, 'garlic'],
  [/\bheads? of garlic\b/g, 'garlic'],
  [/\bcilantro leaves\b/g, 'cilantro'],
  [/\bparsley leaves\b/g, 'parsley'],
  [/\bbasil leaves\b/g, 'basil'],
];

/** Ingredients nobody buys. */
const IGNORED = new Set(['water', 'ice', 'boiling water', 'ice water', 'cold water', 'warm water', 'hot water']);

const IRREGULAR_PLURALS: Record<string, string> = {
  tomatoes: 'tomato',
  potatoes: 'potato',
  leaves: 'leaf',
  loaves: 'loaf',
  knives: 'knife',
  berries: 'berry',
  cherries: 'cherry',
  anchovies: 'anchovy',
  chilies: 'chile',
  chiles: 'chile',
  chillies: 'chile',
  peaches: 'peach',
  radishes: 'radish',
  dishes: 'dish',
  squashes: 'squash',
  molasses: 'molasses',
  couscous: 'couscous',
  hummus: 'hummus',
  asparagus: 'asparagus',
  citrus: 'citrus',
  swiss: 'swiss',
  grits: 'grits',
  oats: 'oats',
  peas: 'pea',
  chickpeas: 'chickpea',
  noodles: 'noodle',
  greens: 'greens',
};

export function singularize(word: string): string {
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word];
  if (word.length <= 3) return word;
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ch|sh|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Normalized key for an ingredient or item name. Returns '' for things to skip. */
export function normalizeName(input: string): string {
  let s = input.toLowerCase();
  s = s.replace(/\([^)]*\)/g, ' '); // drop parentheticals: "(about 2 cups)"
  s = s.split(',')[0]; // "onion, diced" -> "onion"
  s = s.replace(/[’']/g, '').replace(/[^a-z\s-]/g, ' ');
  for (const [re, rep] of KEEP_PHRASES) s = s.replace(re, rep);
  const words = s
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ''))
    .filter((w) => w && !DESCRIPTORS.has(w));
  const key = words.map(singularize).join(' ').trim();
  if (IGNORED.has(key) || IGNORED.has(input.toLowerCase().trim())) return '';
  return key;
}

/** Title-cases a key for display: "olive oil" -> "Olive oil". */
export function displayName(key: string): string {
  return key ? key[0].toUpperCase() + key.slice(1) : key;
}
