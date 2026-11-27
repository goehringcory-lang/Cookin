/** Words whose trailing "s" is not a plural. */
const NOT_PLURAL = new Set([
  'molasses', 'couscous', 'hummus', 'asparagus', 'swiss', 'brussels', 'grits', 'citrus', 'bass',
  'harissa', 'glass', 'grass', 'gras', 'jus', 'chess', 'cress', 'watercress', 'bus',
  'octopus', 'mascarpone', 'is', 'us', 'has', 'was', 'this', 'plus', 'less', 
  'herbes', 'provence', 'pancreas', 'series', 'species', 
  'des', 'les', 'aus', 'gras', 'yes', 'bitters', 'ras',
]);

const IRREGULAR: Record<string, string> = {
  leaves: 'leaf', halves: 'half', loaves: 'loaf', knives: 'knife', calves: 'calf',
  potatoes: 'potato', tomatoes: 'tomato', mangoes: 'mango', avocadoes: 'avocado',
  chilies: 'chile', chiles: 'chile', chilis: 'chile', chili: 'chile', chilli: 'chile', chillies: 'chile',
  anchovies: 'anchovy', cookies: 'cookie', brownies: 'brownie', smoothies: 'smoothie',
  pastries: 'pastry', geese: 'goose', mice: 'mouse', dice: 'dice', rice: 'rice', grapes: 'grape',
  olives: 'olive', chives: 'chive', cloves: 'clove', shallots: 'shallot', oats: 'oat', peas: 'pea',
  greens: 'green', chips: 'chip', lentils: 'lentil', onions: 'onion', bitters: 'bitters',
  pierogies: 'pierogi', pierogis: 'pierogi', tacos: 'taco', burritos: 'burrito',
  jalapenos: 'jalapeno', jalapeños: 'jalapeno', jalapeño: 'jalapeno', echoes: 'echo',
  dashes: 'dash', pinches: 'pinch', bunches: 'bunch', radishes: 'radish', peaches: 'peach',
  squashes: 'squash', boxes: 'box', sandwiches: 'sandwich', dishes: 'dish',
};

/** Reduce a single lowercase word to a singular form. Symmetric: used on aliases and recipe text. */
export function singularize(word: string): string {
  const irr = IRREGULAR[word];
  if (irr) return irr;
  if (word.length <= 3 || NOT_PLURAL.has(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ss') || word.endsWith('us')) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Strip accents: "crème fraîche" -> "creme fraiche", "jalapeño" -> "jalapeno". */
export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Lowercase, de-accent, turn punctuation into spaces, singularize each word.
 * Keeps apostrophes inside words out ("za'atar" -> "zaatar").
 */
export function normalizeTokens(text: string): string[] {
  const s = stripAccents(text.toLowerCase())
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!s) return [];
  return s.split(' ').map(singularize);
}

export function normalizePhrase(text: string): string {
  return normalizeTokens(text).join(' ');
}
