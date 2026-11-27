import { describe, expect, it } from 'vitest';
import { parseIngredientLine } from '../src';
import expected from './fixtures/expected-lines.json';

interface Expected {
  line: string;
  quantity: number | null;
  quantityMax: number | null;
  unit: string | null;
  size: string | null;
  optional: boolean;
  toTaste: boolean;
  garnish: boolean;
}

describe('parseIngredientLine: fixture lines', () => {
  for (const e of expected as Expected[]) {
    it(e.line, () => {
      const p = parseIngredientLine(e.line);
      if (e.quantity === null) expect(p.quantity).toBeNull();
      else expect(p.quantity).toBeCloseTo(e.quantity, 2);
      if (e.quantityMax === null) expect(p.quantityMax).toBeNull();
      else expect(p.quantityMax).toBeCloseTo(e.quantityMax, 2);
      expect(p.unit).toBe(e.unit);
      expect(p.size).toBe(e.size);
      expect(p.optional).toBe(e.optional);
      expect(p.toTaste).toBe(e.toTaste);
      expect(p.garnish).toBe(e.garnish);
      expect(p.unmatched).toBe(false);
    });
  }
});

const ids = (line: string) => parseIngredientLine(line).groups;

describe('parseIngredientLine: catalog matching', () => {
  it.each([
    ['1½ pounds boneless, skinless chicken thighs, patted dry', [['chicken-thighs-boneless']]],
    ['2 cups/250 grams all-purpose flour', [['all-purpose-flour']]],
    ['4 tablespoons unsalted butter, softened', [['butter']]],
    ['2 tablespoons peanut butter', [['peanut-butter']]],
    ['1 cup buttermilk', [['buttermilk']]],
    ['1 pound rigatoni', [['rigatoni']]],
    ['1 pound short pasta, such as rigatoni', [['short-pasta']]],
    ['8 ounces orecchiette', [['orecchiette']]],
    ['1 cup orzo', [['orzo']]],
    ['1 tablespoon Dijon mustard', [['dijon-mustard']]],
    ['½ teaspoon ground cumin', [['ground-cumin']]],
    ['1 teaspoon smoked paprika', [['smoked-paprika']]],
    ['1 cup panko bread crumbs', [['panko']]],
    ['1 large yellow onion, finely chopped', [['yellow-onion']]],
    ['1 red bell pepper, sliced', [['bell-peppers']]],
    ['2 cups low-sodium chicken broth', [['chicken-broth']]],
    ['1 (15-ounce) can chickpeas, drained and rinsed', [['canned-chickpeas']]],
    ['2 (28-ounce) cans whole peeled tomatoes', [['canned-whole-tomatoes']]],
    ['1 (2-inch) piece fresh ginger, peeled and grated', [['fresh-ginger']]],
    ['Juice of 1 lime', [['limes']]],
    ['Zest and juice of 1 lemon', [['lemons']]],
    ['1 large egg, beaten', [['eggs']]],
    ['2 large egg yolks', [['eggs']]],
    ['Freshly grated Parmesan, for serving', [['parmesan']]],
    ['1 cup grated Parmesan cheese', [['parmesan']]],
    ['8 ounces sharp Cheddar cheese, grated', [['cheddar']]],
    ['1 bunch scallions, thinly sliced', [['scallions']]],
  ])('%s', (line, groups) => {
    expect(ids(line as string)).toEqual(groups);
  });

  it('does not confuse garlic cloves with the spice', () => {
    expect(ids('4 cloves garlic, thinly sliced')).toEqual([['garlic']]);
    expect(ids('3 garlic cloves, minced')).toEqual([['garlic']]);
    expect(ids('6 whole cloves')).toEqual([['ground-cloves']]);
  });

  it('splits "and" into separate requirements', () => {
    expect(ids('Kosher salt and black pepper')).toEqual([['salt'], ['black-pepper']]);
    expect(ids('Salt and freshly ground black pepper')).toEqual([['salt'], ['black-pepper']]);
  });

  it('treats "or" as alternatives, including elliptical ones', () => {
    expect(ids('4 cups chicken or vegetable stock')).toEqual([['chicken-broth', 'vegetable-broth']]);
    expect(ids('1 tablespoon fish sauce or soy sauce')).toEqual([['fish-sauce', 'soy-sauce']]);
    expect(ids('2 cups cooked white or brown rice')).toEqual([['white-rice', 'brown-rice']]);
  });

  it('marks salt and water lines as assumed', () => {
    expect(parseIngredientLine('Kosher salt (Diamond Crystal)').assumedOnly).toBe(true);
    expect(parseIngredientLine('1 cup water').assumedOnly).toBe(true);
    expect(parseIngredientLine('Ice water').assumedOnly).toBe(true);
    expect(parseIngredientLine('Kosher salt and black pepper').assumedOnly).toBe(false);
  });

  it('reads flags', () => {
    expect(parseIngredientLine('Red-pepper flakes (optional)')).toMatchObject({ optional: true, groups: [['red-pepper-flakes']] });
    expect(parseIngredientLine('Hot sauce, to taste')).toMatchObject({ toTaste: true });
    expect(parseIngredientLine('Lime wedges, for serving')).toMatchObject({ garnish: true, groups: [['limes']] });
    expect(parseIngredientLine('¼ cup extra-virgin olive oil, plus more for drizzling').groups).toEqual([['extra-virgin-olive-oil']]);
  });

  it('parses quantities and units', () => {
    expect(parseIngredientLine('1 ½ cups/190 grams flour')).toMatchObject({ quantity: 1.5, unit: 'cup' });
    expect(parseIngredientLine('2 to 3 tablespoons olive oil')).toMatchObject({ quantity: 2, quantityMax: 3, unit: 'tbsp' });
    expect(parseIngredientLine('4–6 garlic cloves')).toMatchObject({ quantity: 4, quantityMax: 6, unit: 'clove' });
    expect(parseIngredientLine('1 (15-ounce) can black beans')).toMatchObject({ quantity: 1, unit: 'can', size: '15-ounce' });
    expect(parseIngredientLine('A pinch of saffron')).toMatchObject({ quantity: 1, unit: 'pinch' });
    expect(parseIngredientLine('6 tablespoons/85 grams cold unsalted butter, cubed')).toMatchObject({ quantity: 6, unit: 'tbsp', note: 'cubed' });
  });
});

describe('parseIngredientLine: more real-world lines', () => {
  it.each([
    ['Juice of ½ lemon', [['lemons']], 0.5],
    ['1 large bunch broccoli rabe, trimmed', [['broccoli-rabe']], 1],
    ['1 pint cherry tomatoes, halved', [['cherry-tomatoes']], 1],
    ['Sour cream, shredded cheddar and chopped cilantro, for serving', [['sour-cream'], ['cheddar'], ['cilantro']], null],
    ['12 ounces pappardelle or fettuccine', [['pappardelle', 'fettuccine']], 12],
    ['1 pound rotini', [['rotini']], 1],
    ['1 dash Angostura bitters', [['bitters']], 1],
    ['2 kiwis', [['kiwi']], 2],
    ['4 cloves garlic', [['garlic']], 4],
    ['1 head of lettuce', [['lettuce']], 1],
    ['1 stick of butter', [['butter']], 1],
    ['1 bunch of scallions', [['scallions']], 1],
    ['2 ears of corn', [['corn-on-the-cob']], 2],
    ['1 can of tomatoes', [['canned-whole-tomatoes']], 1],
    ['2 cans of black beans', [['canned-black-beans']], 2],
    ['2 heads of garlic', [['garlic']], 2],
    ['2 star anise pods', [['star-anise']], 2],
    ['1 refrigerated pie crust', [['pie-crust']], 1],
    ['1 cup Shaoxing wine or dry sherry', [['shaoxing-wine', 'dry-sherry']], 1],
    ['1 cup heavy cream or half-and-half', [['heavy-cream', 'half-and-half']], 1],
  ])('%s', (line, groups, qty) => {
    const p = parseIngredientLine(line as string);
    expect(p.groups).toEqual(groups);
    expect(p.quantity).toBe(qty);
  });
});
