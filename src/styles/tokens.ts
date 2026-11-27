// Cookin design tokens for JS (charts, meta theme-color, canvas, etc.).
// Mirrors src/styles/tokens.css. In components prefer the CSS variables: `var(--ck-primary)`.

export const color = {
  light: {
    bg: '#FBF7F1',
    surface: '#FFFFFF',
    surface2: '#F4EDE3',
    border: '#E7DDD0',
    text: '#2A221B',
    textMuted: '#6E6257',
    primary: '#C8492F',
    have: '#3F7D4E',
    low: '#C98A12',
    need: '#C8492F',
  },
  dark: {
    bg: '#1A1714',
    surface: '#24201C',
    surface2: '#2E2924',
    border: '#3A342E',
    text: '#F5EFE7',
    textMuted: '#B5A99C',
    primary: '#E7694E',
    have: '#6BB37D',
    low: '#E6AE3F',
    need: '#E7694E',
  },
} as const;

export const font = {
  display: '"Fraunces", Georgia, serif',
  ui: '"Inter", system-ui, -apple-system, sans-serif',
} as const;

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s8: 32, s10: 40, s14: 56 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
export const motion = { fast: 160, base: 260, ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)' } as const;

/** Ingredient availability, used everywhere for Have / Low / Need styling. */
export type Availability = 'have' | 'low' | 'need';

export const availability: Record<Availability, { label: string; glyph: string; cssVar: string }> = {
  have: { label: 'Have', glyph: '✓', cssVar: '--ck-have' },
  low: { label: 'Running low', glyph: '◐', cssVar: '--ck-low' },
  need: { label: 'Need', glyph: '○', cssVar: '--ck-need' },
};

/** Badge text for a recipe given how many ingredients are missing. */
export function haveBadge(missing: number): { tone: Availability; text: string } {
  if (missing === 0) return { tone: 'have', text: 'Have everything' };
  if (missing <= 2) return { tone: 'low', text: `Need ${missing}` };
  return { tone: 'need', text: `Need ${missing}` };
}
