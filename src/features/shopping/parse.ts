// Parses a typed or recipe line like "1 1/2 cups flour" or "2 lb. chicken thighs".

export interface ParsedLine { name: string; quantity?: number; unit?: string; raw: string }

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

const UNIT_WORDS = [
  'teaspoons', 'teaspoon', 'tsps', 'tsp', 'tablespoons', 'tablespoon', 'tbsps', 'tbsp', 'tbs', 'tbl',
  'cups', 'cup', 'fluid ounces', 'fluid ounce', 'fl oz', 'ounces', 'ounce', 'oz', 'pounds', 'pound', 'lbs', 'lb',
  'grams', 'gram', 'g', 'kilograms', 'kilogram', 'kg', 'milliliters', 'milliliter', 'ml', 'liters', 'liter', 'l',
  'pints', 'pint', 'quarts', 'quart', 'qt', 'gallons', 'gallon',
  'cloves', 'clove', 'cans', 'can', 'jars', 'jar', 'packages', 'package', 'pkg', 'bunches', 'bunch',
  'heads', 'head', 'sticks', 'stick', 'slices', 'slice', 'sprigs', 'sprig', 'pinch', 'pinches', 'dash',
  'boxes', 'box', 'bags', 'bag', 'bottles', 'bottle', 'loaves', 'loaf', 'dozen', 'containers', 'container',
];
// Longest first so "fl oz" wins over "fl".
UNIT_WORDS.sort((a, b) => b.length - a.length);

const UNIT_RE = new RegExp(`^(${UNIT_WORDS.map((u) => u.replace(/ /g, '\\s+')).join('|')})\\.?(?=\\s|$)`, 'i');
const SINGULAR_UNIT: Record<string, string> = {
  cloves: 'clove', cans: 'can', jars: 'jar', packages: 'package', pkg: 'package', bunches: 'bunch', heads: 'head',
  sticks: 'stick', slices: 'slice', sprigs: 'sprig', pinches: 'pinch', boxes: 'box', bags: 'bag',
  bottles: 'bottle', loaves: 'loaf', containers: 'container',
};

function readNumber(s: string): { value: number; rest: string } | null {
  let rest = s.trimStart();
  let total = 0;
  let matched = false;
  // whole, mixed ("1 1/2"), fraction ("3/4"), decimal ("1.5"), unicode ("1½" or "½")
  const m = rest.match(/^(\d+(?:\.\d+)?)(?:\s*([½⅓⅔¼¾⅕⅛⅜⅝⅞]))?/);
  if (m) {
    const frac = rest.slice(m[0].length).match(/^\s*\/\s*(\d+)/);
    if (frac) {
      total += Number(m[1]) / Number(frac[1]);
      rest = rest.slice(m[0].length + frac[0].length);
    } else {
      total += Number(m[1]) + (m[2] ? UNICODE_FRACTIONS[m[2]] : 0);
      rest = rest.slice(m[0].length);
      const mixed = rest.match(/^\s+(\d+)\s*\/\s*(\d+)/);
      if (mixed && !m[2]) {
        total += Number(mixed[1]) / Number(mixed[2]);
        rest = rest.slice(mixed[0].length);
      }
    }
    matched = true;
  } else if (UNICODE_FRACTIONS[rest[0]] !== undefined) {
    total = UNICODE_FRACTIONS[rest[0]];
    rest = rest.slice(1);
    matched = true;
  }
  if (!matched) return null;
  // ranges: "2 to 3" / "2-3" -> take the larger amount so we buy enough
  const range = rest.match(/^\s*(?:-|–|to)\s*/);
  if (range) {
    const next = readNumber(rest.slice(range[0].length));
    if (next) return { value: Math.max(total, next.value), rest: next.rest };
  }
  return { value: total, rest };
}

export function parseLine(line: string): ParsedLine {
  const raw = line.trim();
  let rest = raw.replace(/^[-•*]\s*/, '');
  let quantity: number | undefined;
  let unit: string | undefined;

  const num = readNumber(rest);
  if (num) {
    quantity = num.value;
    rest = num.rest.trimStart();
    // "1 (15-ounce) can chickpeas" -> skip the parenthetical size
    rest = rest.replace(/^\([^)]*\)\s*/, '');
    const u = rest.match(UNIT_RE);
    if (u) {
      const word = u[1].toLowerCase().replace(/\s+/g, ' ');
      unit = SINGULAR_UNIT[word] ?? word;
      rest = rest.slice(u[0].length).trimStart();
      rest = rest.replace(/^of\s+/i, '');
    }
  }
  return { name: rest || raw, quantity, unit, raw };
}
