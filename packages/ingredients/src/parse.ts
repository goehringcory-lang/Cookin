import type { ParsedIngredient } from './types';
import { getIndex, type CatalogIndex } from './catalog';
import { normalizeTokens } from './normalize';

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5',
  '⅘': '4/5', '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
};
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

/** Spoken unit -> normalized unit. Keys are lowercase, without trailing periods. */
const UNITS: Record<string, string> = {
  cup: 'cup', cups: 'cup', c: 'cup',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tbl: 'tbsp', T: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', tsps: 'tsp', t: 'tsp',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl oz': 'fl oz',
  gram: 'g', grams: 'g', g: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', ml: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  quart: 'quart', quarts: 'quart', qt: 'quart',
  pint: 'pint', pints: 'pint', pt: 'pint',
  gallon: 'gallon', gallons: 'gallon',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  jar: 'jar', jars: 'jar',
  package: 'package', packages: 'package', pkg: 'package', packet: 'package', packets: 'package',
  box: 'box', boxes: 'box', bag: 'bag', bags: 'bag', bottle: 'bottle', bottles: 'bottle',
  container: 'container', containers: 'container', carton: 'container', cartons: 'container',
  clove: 'clove', cloves: 'clove',
  bunch: 'bunch', bunches: 'bunch',
  head: 'head', heads: 'head',
  sprig: 'sprig', sprigs: 'sprig',
  stalk: 'stalk', stalks: 'stalk', rib: 'stalk', ribs: 'stalk',
  stick: 'stick', sticks: 'stick',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece', chunk: 'piece', chunks: 'piece', knob: 'piece',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash', splash: 'dash',
  handful: 'handful', handfuls: 'handful',
  sheet: 'sheet', sheets: 'sheet',
  ear: 'ear', ears: 'ear',
  drop: 'drop', drops: 'drop',
  fillet: 'fillet', fillets: 'fillet',
};

/** Units that, when they appear right after the ingredient name, are the line's unit ("3 garlic cloves"). */
const TRAILING_UNITS = new Set(['clove', 'sprig', 'stalk', 'bunch', 'head', 'stick', 'slice', 'ear']);

const UNIT_ADJECTIVES = /^(heaping|heaped|level|scant|generous|rounded|packed|lightly packed|firmly packed|loosely packed|large|small|medium|big|good|very large|extra-large)\s+/i;

const COMMA_JOINERS = /^\s*(skinless|boneless|skin-on|bone-in|skin on|bone in|peeled|deveined|tail-on|shell-on)\b/i;

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?|\.\d+)`;
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s*(?:-|to|or)\s*(${NUM}))?\s*`, 'i');

function toNumber(s: string): number {
  const t = s.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return round(Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]));
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return round(Number(frac[1]) / Number(frac[2]));
  return Number(t);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Normalize typography so the regexes below stay simple. */
function preprocess(line: string): string {
  let s = line
    .replace(/\u00a0/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/⁄/g, '/');
  // "1½" or "1 ½" -> "1 1/2"; lone "½" -> "1/2"
  s = s.replace(new RegExp(`(\\d)?(\\s*)([${FRACTION_CHARS}])`, 'g'), (_m, whole: string | undefined, sp: string, f: string) =>
    `${whole ? whole + ' ' : sp}${UNICODE_FRACTIONS[f]}`,
  );
  // Drop metric (or secondary) amounts after a slash: "1 cup/240 milliliters", "1 pound/450 grams"
  s = s.replace(
    new RegExp(String.raw`(?<=[A-Za-z.)])\s*\/\s*${NUM}(?:\s*(?:-|to)\s*${NUM})?\s*(?:grams?|g|kilograms?|kg|milliliters?|millilitres?|ml|liters?|litres?|l|ounces?|oz|pounds?|lbs?|cups?)\b\.?`, 'gi'),
    '',
  );
  return s.replace(/\s+/g, ' ').trim();
}

/** Split on the first top-level comma, keeping "boneless, skinless" together. */
function splitNameNote(text: string): [string, string | null] {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      const rest = text.slice(i + 1);
      if (COMMA_JOINERS.test(rest)) continue;
      return [text.slice(0, i).trim(), rest.trim() || null];
    }
  }
  return [text.trim(), null];
}

function joinNotes(...parts: (string | null | undefined)[]): string | null {
  const s = parts.filter((p): p is string => !!p && p.trim().length > 0).map((p) => p.trim()).join('; ');
  return s || null;
}

/**
 * Parse one recipe ingredient line into quantity, unit, flags and catalog matches.
 * Pure and deterministic; pass a custom index only in tests.
 */
export function parseIngredientLine(line: string, index: CatalogIndex = getIndex()): ParsedIngredient {
  const raw = line;
  let s = preprocess(line);
  const lower = s.toLowerCase();

  const optional = /\boptional\b/.test(lower);
  const toTaste = /\b(to taste|as needed|if needed|as desired)\b/.test(lower);
  const garnish =
    /\bfor (serving|garnish|garnishing|drizzling|topping|sprinkling|dipping|dusting|the table|finishing)\b/.test(lower) ||
    /\b(to serve|to garnish|to finish)\b/.test(lower);

  // Section headings NYT sometimes includes ("For the sauce:")
  if (/^for (the )?[a-z ]+:?$/i.test(s) && s.endsWith(':')) {
    return emptyResult(raw, s);
  }

  let leadNote: string | null = null;
  // "Juice of 1 lime", "Zest and juice of 1 lemon", "Finely grated zest of 1 orange"
  const ofMatch = s.match(/^((?:finely )?(?:grated )?(?:zest|juice|zest and juice|juice and zest|grated zest|seeds|leaves|kernels)(?: from)?(?: of)?)\s+(?=\d|a\b|an\b|half\b|one\b|two\b)/i);
  if (ofMatch && ofMatch[1]) {
    leadNote = ofMatch[1].toLowerCase();
    s = s.slice(ofMatch[0].length);
  }

  // Word numbers
  s = s.replace(/^(a|an|one)\s+(?=[a-z(])/i, '1 ').replace(/^two\s+/i, '2 ').replace(/^three\s+/i, '3 ').replace(/^half (a|an)\s+/i, '1/2 ');

  let quantity: number | null = null;
  let quantityMax: number | null = null;
  const q = s.match(QTY_RE);
  if (q && q[1]) {
    quantity = toNumber(q[1]);
    quantityMax = q[2] ? toNumber(q[2]) : null;
    s = s.slice(q[0].length);
  }

  // Package size: "(15-ounce)" or "15-ounce"
  let size: string | null = null;
  const paren = s.match(/^\(([^)]*)\)\s*/);
  if (paren && paren[1] !== undefined && quantity !== null) {
    size = paren[1].trim();
    s = s.slice(paren[0].length);
  } else {
    const bare = s.match(/^(\d+(?:\.\d+)?(?:\s+\d\/\d)?-(?:ounce|oz|pound|lb|inch|gram|g|quart|liter)s?)\s+/i);
    if (bare && bare[1]) {
      size = bare[1];
      s = s.slice(bare[0].length);
    }
  }

  // Unit, possibly preceded by an adjective ("1 heaping tablespoon", "1 packed cup")
  let unit: string | null = null;
  {
    let rest = s;
    const adj = rest.match(UNIT_ADJECTIVES);
    if (adj) rest = rest.slice(adj[0].length);
    const um = rest.match(/^([A-Za-z]+(?: (?:ounce|ounces|oz))?)\.?(?=\s|$|\/|,)/);
    if (um && um[1]) {
      const word = um[1];
      const key = word === 'T' ? 'T' : word.toLowerCase();
      const u = UNITS[key];
      // Single-letter units only count right after a number
      if (u && (key.length > 1 || quantity !== null)) {
        unit = u;
        s = rest.slice(um[0].length).replace(/^\s*of\s+/i, '').trim();
        // "(15-ounce) can" after the unit is not possible; but "1 can (15 ounces) beans" is
        const afterParen = s.match(/^\(([^)]*)\)\s*/);
        if (afterParen && afterParen[1] !== undefined && !size) {
          size = afterParen[1].trim();
          s = s.slice(afterParen[0].length);
        }
      }
    }
  }

  const [rawName, note] = splitNameNote(s);
  let name = rawName;
  // Parentheticals inside the name become notes: "Kosher salt (Diamond Crystal)"
  const parenNotes: string[] = [];
  name = name.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    parenNotes.push(inner.trim());
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  name = name.replace(/^of\s+/i, '');

  if (!unit && quantity !== null) {
    const words = name.toLowerCase().split(/\s+/);
    const last = words[words.length - 1] ?? '';
    const u = UNITS[last];
    if (u && TRAILING_UNITS.has(u)) unit = u;
  }

  let groups = matchGroups(name, index);
  if (groups.length === 0) {
    // Fall back to the note ("Lime wedges, for serving" is fine already; "Neutral oil, such as canola")
    groups = matchGroups([note, ...parenNotes].filter(Boolean).join(' '), index);
  }

  // "Sour cream, shredded cheddar and chopped cilantro, for serving": a list of toppings
  if (garnish && note && groups.length > 0) {
    const toppings = note.split(/,?\s*\b(?:for|to)\s+(?:serving|garnish|garnishing|topping|drizzling|sprinkling|dipping|serve|the table)\b/i)[0] ?? '';
    for (const g of matchGroups(toppings, index)) {
      if (!groups.some((x) => x.join() === g.join())) groups.push(g);
    }
  }

  const assumedOnly = groups.length > 0 && groups.every((g) => g.some((id) => index.assumed.has(id)));

  return {
    raw,
    quantity,
    quantityMax,
    unit,
    size,
    name: name.replace(/[.:;]+$/, '').trim(),
    note: joinNotes(leadNote, ...parenNotes, note),
    optional,
    toTaste,
    garnish,
    groups,
    assumedOnly,
    unmatched: groups.length === 0,
  };
}

function emptyResult(raw: string, name: string): ParsedIngredient {
  return {
    raw, quantity: null, quantityMax: null, unit: null, size: null, name, note: null,
    optional: false, toTaste: false, garnish: false, groups: [], assumedOnly: false, unmatched: true,
  };
}

interface Hit {
  id: string;
  start: number;
  end: number; // exclusive
}

const OR_TOKENS = new Set(['or']);

/**
 * Find catalog items in free text. Longest phrase wins at each position.
 * Items separated by "or" become alternatives in one group; everything else is its own group.
 */
export function matchGroups(text: string, index: CatalogIndex = getIndex()): string[][] {
  const tokens = normalizeTokens(text);
  if (tokens.length === 0) return [];
  const hits = scan(tokens, index);
  resolveEllipticalOr(tokens, hits, index);
  pruneGenericNeighbors(hits, index);
  hits.sort((a, b) => a.start - b.start);

  const groups: string[][] = [];
  let prev: Hit | null = null;
  for (const h of hits) {
    const between = prev ? tokens.slice(prev.end, h.start) : [];
    const isAlt = prev !== null && between.some((t) => OR_TOKENS.has(t)) && between.length <= 4;
    const last = groups[groups.length - 1];
    if (isAlt && last) {
      if (!last.includes(h.id)) last.push(h.id);
    } else if (!groups.some((g) => g.length === 1 && g[0] === h.id)) {
      groups.push([h.id]);
    }
    prev = h;
  }
  return groups;
}

function scan(tokens: string[], index: CatalogIndex): Hit[] {
  const hits: Hit[] = [];
  let i = 0;
  while (i < tokens.length) {
    let found = false;
    for (let len = Math.min(index.maxLen, tokens.length - i); len >= 1; len--) {
      const id = index.phrases.get(tokens.slice(i, i + len).join(' '));
      if (id) {
        hits.push({ id, start: i, end: i + len });
        i += len;
        found = true;
        break;
      }
    }
    if (!found) i++;
  }
  return hits;
}

/**
 * "chicken or vegetable stock" -> chicken stock | vegetable stock.
 * "white or brown rice" -> white rice | brown rice.
 */
function resolveEllipticalOr(tokens: string[], hits: Hit[], index: CatalogIndex): void {
  for (let p = 0; p < tokens.length; p++) {
    if (!OR_TOKENS.has(tokens[p] ?? '')) continue;
    const next = hits.find((h) => h.start === p + 1);
    if (!next || next.end - next.start < 2) continue;
    let replaced = false;
    for (let leftLen = Math.min(3, p); leftLen >= 1 && !replaced; leftLen--) {
      const left = tokens.slice(p - leftLen, p);
      for (let drop = 1; drop < next.end - next.start && !replaced; drop++) {
        const tail = tokens.slice(next.start + drop, next.end);
        const id = index.phrases.get([...left, ...tail].join(' '));
        if (id) {
          const start = p - leftLen;
          for (let k = hits.length - 1; k >= 0; k--) {
            const h = hits[k]!;
            if (h.start >= start && h.end <= p) hits.splice(k, 1);
          }
          hits.push({ id, start, end: p });
          replaced = true;
        }
      }
    }
  }
}

/** "cheddar cheese" -> cheddar, not cheddar + generic cheese. */
function pruneGenericNeighbors(hits: Hit[], index: CatalogIndex): void {
  hits.sort((a, b) => a.start - b.start);
  for (let k = hits.length - 1; k >= 0; k--) {
    const h = hits[k]!;
    if (!index.generic.has(h.id)) continue;
    const before = hits[k - 1];
    const after = hits[k + 1];
    const touchesBefore = before && before.end === h.start && !index.generic.has(before.id);
    const touchesAfter = after && after.start === h.end && !index.generic.has(after.id);
    if (touchesBefore || touchesAfter) hits.splice(k, 1);
  }
}

/** Parse every line of a recipe. */
export function parseIngredients(lines: readonly string[], index: CatalogIndex = getIndex()): ParsedIngredient[] {
  return lines.map((l) => parseIngredientLine(l, index));
}
