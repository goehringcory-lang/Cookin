// Quantity merging. Volumes and weights convert to a base unit so "1 cup" and
// "4 tbsp" sum; counts and unknown units are summed per unit.

type Dim = 'volume' | 'mass' | 'count' | 'other';

interface UnitDef { dim: Dim; base: number; label: string; plural?: string }

// base: millilitres for volume, grams for mass.
const UNITS: Record<string, UnitDef> = {
  tsp: { dim: 'volume', base: 4.92892, label: 'tsp' },
  teaspoon: { dim: 'volume', base: 4.92892, label: 'tsp' },
  tbsp: { dim: 'volume', base: 14.7868, label: 'tbsp' },
  tablespoon: { dim: 'volume', base: 14.7868, label: 'tbsp' },
  cup: { dim: 'volume', base: 236.588, label: 'cup', plural: 'cups' },
  'fl oz': { dim: 'volume', base: 29.5735, label: 'fl oz' },
  pint: { dim: 'volume', base: 473.176, label: 'pint', plural: 'pints' },
  quart: { dim: 'volume', base: 946.353, label: 'quart', plural: 'quarts' },
  gallon: { dim: 'volume', base: 3785.41, label: 'gallon', plural: 'gallons' },
  ml: { dim: 'volume', base: 1, label: 'ml' },
  l: { dim: 'volume', base: 1000, label: 'L' },
  liter: { dim: 'volume', base: 1000, label: 'L' },
  oz: { dim: 'mass', base: 28.3495, label: 'oz' },
  ounce: { dim: 'mass', base: 28.3495, label: 'oz' },
  lb: { dim: 'mass', base: 453.592, label: 'lb' },
  pound: { dim: 'mass', base: 453.592, label: 'lb' },
  g: { dim: 'mass', base: 1, label: 'g' },
  gram: { dim: 'mass', base: 1, label: 'g' },
  kg: { dim: 'mass', base: 1000, label: 'kg' },
};

const ALIASES: Record<string, string> = {
  t: 'tsp', tsps: 'tsp', teaspoons: 'teaspoon',
  tbs: 'tbsp', tbsps: 'tbsp', tbl: 'tbsp', tablespoons: 'tablespoon', T: 'tbsp',
  cups: 'cup', c: 'cup',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  pints: 'pint', pt: 'pint', quarts: 'quart', qt: 'quart', gallons: 'gallon', gal: 'gallon',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  liters: 'liter', litre: 'liter', litres: 'liter',
  ounces: 'ounce', lbs: 'lb', pounds: 'pound',
  grams: 'gram', kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
};

function canonUnit(unit?: string): string {
  if (!unit) return '';
  const trimmed = unit.trim().replace(/\.$/, '');
  if (trimmed === 'T') return 'tbsp';
  const u = trimmed.toLowerCase();
  return ALIASES[u] ?? u;
}

/** Accumulates quantities for one shopping item. */
export class Amount {
  private volumeMl = 0;
  private massG = 0;
  private counts = new Map<string, number>(); // unit label ('' = plain count) -> total

  add(quantity: number | undefined, unit?: string): void {
    // Unknown amounts ("salt to taste") add nothing; the line still shows.
    if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) return;
    const u = canonUnit(unit);
    const def = UNITS[u];
    if (def?.dim === 'volume') this.volumeMl += quantity * def.base;
    else if (def?.dim === 'mass') this.massG += quantity * def.base;
    else this.counts.set(u, (this.counts.get(u) ?? 0) + quantity);
  }

  /** Adds another amount into this one. */
  merge(other: Amount): void {
    this.volumeMl += other.volumeMl;
    this.massG += other.massG;
    for (const [u, n] of other.counts) this.counts.set(u, (this.counts.get(u) ?? 0) + n);
  }

  isEmpty(): boolean {
    return this.volumeMl === 0 && this.massG === 0 && this.counts.size === 0;
  }

  format(): string {
    const parts: string[] = [];
    if (this.massG > 0) parts.push(formatMass(this.massG));
    if (this.volumeMl > 0) parts.push(formatVolume(this.volumeMl));
    for (const [unit, raw] of this.counts) {
      // You can't buy 2½ lemons or 1¼ cans: round countable things up.
      const n = Math.ceil(raw - 1e-9);
      parts.push(unit ? `${n} ${pluralizeUnit(unit, n)}` : String(n));
    }
    return parts.join(' + ');
  }
}

function pluralizeUnit(unit: string, n: number): string {
  if (n <= 1) return unit;
  if (/(s|sh|ch|x)$/.test(unit)) return unit + 'es';
  if (/[^aeiou]y$/.test(unit)) return unit.slice(0, -1) + 'ies';
  return unit + 's';
}

function formatMass(g: number): string {
  const lb = g / UNITS.lb.base;
  if (lb >= 0.999) return `${fraction(nice(lb))} lb`;
  return `${fraction(roundTo(g / UNITS.oz.base, 2))} oz`;
}

function formatVolume(ml: number): string {
  const gallons = ml / UNITS.gallon.base;
  if (gallons >= 0.999) {
    const g = nice(gallons);
    return `${fraction(g)} ${g > 1 ? 'gallons' : 'gallon'}`;
  }
  const cups = ml / UNITS.cup.base;
  if (cups >= 0.249) {
    const c = nice(cups);
    return `${fraction(c)} ${c > 1 ? 'cups' : 'cup'}`;
  }
  const tbsp = ml / UNITS.tbsp.base;
  if (tbsp >= 0.999) return `${fraction(nice(tbsp))} tbsp`;
  return `${fraction(nice(ml / UNITS.tsp.base))} tsp`;
}

function roundTo(n: number, denom: number): number {
  return Math.max(1 / denom, Math.round(n * denom) / denom);
}

const NICE = [0, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];
/** Snaps to a whole number plus a kitchen fraction (⅛ ¼ ⅓ ½ ⅔ ¾), never below ⅛. */
function nice(n: number): number {
  const whole = Math.floor(n);
  const rest = n - whole;
  const best = NICE.reduce((a, b) => (Math.abs(b - rest) < Math.abs(a - rest) ? b : a));
  return Math.max(1 / 8, whole + best);
}

const FRACTIONS: Record<string, string> = {
  '0.25': '¼', '0.5': '½', '0.75': '¾', '0.333': '⅓', '0.667': '⅔', '0.125': '⅛',
};

/** 2.5 -> "2½", 0.333 -> "⅓", 3 -> "3". */
export function fraction(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const rest = n - whole;
  if (rest < 0.02) return String(whole);
  for (const [dec, glyph] of Object.entries(FRACTIONS)) {
    if (Math.abs(rest - Number(dec)) < 0.02) return whole ? `${whole}${glyph}` : glyph;
  }
  return String(Math.round(n * 10) / 10);
}
