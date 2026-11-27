import type { CatalogItem, Location } from './types';

/**
 * Fallback catalog so onboarding works before the shared ingredient
 * catalog lands. The app should pass the real catalog in; this is only
 * used when none is given. Within each category, the first `common`
 * names are the "Select common" set and are shown first.
 */
type Group = [category: string, common: string[], more: string[]];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const build = (location: Location, groups: Group[]): CatalogItem[] =>
  groups.flatMap(([category, common, more]) => [
    ...common.map((name) => ({ id: slug(name), name, category, location, common: true })),
    ...more.map((name) => ({ id: slug(name), name, category, location })),
  ]);

const PANTRY: Group[] = [
  ['Pasta & noodles',
    ['Spaghetti', 'Penne', 'Rigatoni', 'Linguine', 'Elbow macaroni', 'Egg noodles'],
    ['Fettuccine', 'Angel hair', 'Bucatini', 'Orecchiette', 'Farfalle', 'Fusilli', 'Orzo', 'Lasagna noodles', 'Ditalini', 'Shells', 'Paccheri', 'Ramen noodles', 'Rice noodles', 'Soba noodles', 'Udon noodles', 'Couscous']],
  ['Rice & grains',
    ['Long-grain white rice', 'Jasmine rice', 'Brown rice', 'Rolled oats'],
    ['Basmati rice', 'Arborio rice', 'Sushi rice', 'Wild rice', 'Quinoa', 'Farro', 'Pearl barley', 'Bulgur', 'Polenta', 'Cornmeal', 'Grits']],
  ['Flour & baking',
    ['All-purpose flour', 'Granulated sugar', 'Brown sugar', 'Baking soda', 'Baking powder', 'Vanilla extract', 'Powdered sugar'],
    ['Bread flour', 'Whole-wheat flour', 'Cake flour', 'Cornstarch', 'Active dry yeast', 'Cocoa powder', 'Chocolate chips', 'Bittersweet chocolate', 'Sweetened condensed milk', 'Evaporated milk', 'Molasses', 'Almond extract', 'Panko breadcrumbs', 'Plain breadcrumbs', 'Shredded coconut']],
  ['Oils & vinegars',
    ['Olive oil', 'Vegetable oil', 'Cooking spray', 'Apple cider vinegar', 'Red wine vinegar'],
    ['Extra-virgin olive oil', 'Canola oil', 'Toasted sesame oil', 'Coconut oil', 'Avocado oil', 'White wine vinegar', 'Balsamic vinegar', 'Rice vinegar', 'Distilled white vinegar', 'Sherry vinegar']],
  ['Spices & dried herbs',
    ['Kosher salt', 'Black pepper', 'Garlic powder', 'Onion powder', 'Paprika', 'Ground cumin', 'Chili powder', 'Red pepper flakes', 'Dried oregano', 'Ground cinnamon'],
    ['Smoked paprika', 'Cayenne pepper', 'Ground coriander', 'Turmeric', 'Curry powder', 'Garam masala', 'Dried thyme', 'Dried basil', 'Dried rosemary', 'Italian seasoning', 'Bay leaves', 'Ground ginger', 'Nutmeg', 'Ground cloves', 'Allspice', 'Cumin seeds', 'Fennel seeds', 'Mustard seeds', 'Dried dill', 'Za\'atar', 'Sesame seeds', 'Flaky sea salt', 'Old Bay seasoning']],
  ['Canned & jarred',
    ['Canned diced tomatoes', 'Canned crushed tomatoes', 'Tomato paste', 'Chicken broth', 'Black beans', 'Chickpeas', 'Marinara sauce'],
    ['Whole peeled tomatoes', 'Tomato sauce', 'Vegetable broth', 'Beef broth', 'Kidney beans', 'Cannellini beans', 'Pinto beans', 'Refried beans', 'Coconut milk', 'Canned tuna', 'Canned corn', 'Chipotles in adobo', 'Green chiles', 'Roasted red peppers', 'Capers', 'Kalamata olives', 'Anchovies', 'Artichoke hearts', 'Salsa', 'Pesto']],
  ['Sauces & condiments',
    ['Soy sauce', 'Ketchup', 'Yellow mustard', 'Dijon mustard', 'Mayonnaise', 'Honey', 'Hot sauce'],
    ['Worcestershire sauce', 'Fish sauce', 'Oyster sauce', 'Hoisin sauce', 'Sriracha', 'Gochujang', 'Miso paste', 'Tahini', 'Maple syrup', 'BBQ sauce', 'Whole-grain mustard', 'Chili crisp', 'Teriyaki sauce']],
  ['Nuts, seeds & dried fruit',
    ['Peanut butter', 'Raisins'],
    ['Almonds', 'Walnuts', 'Pecans', 'Pine nuts', 'Cashews', 'Peanuts', 'Pistachios', 'Almond butter', 'Dried cranberries', 'Dates']],
  ['Bread & tortillas',
    ['Sandwich bread', 'Flour tortillas'],
    ['Corn tortillas', 'Hamburger buns', 'Pita', 'Naan', 'Crusty bread', 'Crackers', 'Taco shells']],
  ['Produce that keeps',
    ['Yellow onions', 'Garlic', 'Potatoes'],
    ['Red onions', 'Shallots', 'Sweet potatoes', 'Fresh ginger']],
  ['Wine & spirits',
    [],
    ['Dry white wine', 'Dry red wine', 'Dry sherry', 'Mirin', 'Shaoxing wine']],
];

const FRIDGE: Group[] = [
  ['Dairy & eggs',
    ['Eggs', 'Unsalted butter', 'Milk', 'Shredded cheddar', 'Parmesan', 'Sour cream'],
    ['Salted butter', 'Heavy cream', 'Half-and-half', 'Buttermilk', 'Plain Greek yogurt', 'Cream cheese', 'Mozzarella', 'Fresh mozzarella', 'Monterey Jack', 'Feta', 'Goat cheese', 'Ricotta', 'Pecorino Romano', 'Gruyère', 'Sliced cheese']],
  ['Produce',
    ['Carrots', 'Celery', 'Lemons', 'Limes'],
    ['Scallions', 'Bell peppers', 'Jalapeños', 'Cucumbers', 'Zucchini', 'Broccoli', 'Cauliflower', 'Mushrooms', 'Cabbage', 'Lettuce', 'Spinach', 'Kale', 'Tomatoes', 'Avocados', 'Apples', 'Berries', 'Cilantro', 'Parsley', 'Basil', 'Fresh thyme']],
  ['Meat & deli',
    [],
    ['Bacon', 'Deli turkey', 'Ham', 'Italian sausage', 'Hot dogs', 'Pepperoni', 'Prosciutto', 'Chorizo']],
  ['Condiments (opened)',
    ['Ketchup (opened)', 'Mayonnaise (opened)'],
    ['Pickles', 'Jam', 'Kimchi', 'Salad dressing', 'Prepared horseradish']],
  ['Other',
    [],
    ['Tofu', 'Hummus', 'Pizza dough', 'Fresh pasta', 'Orange juice']],
];

const FREEZER: Group[] = [
  ['Vegetables',
    ['Frozen peas', 'Frozen corn', 'Frozen broccoli'],
    ['Frozen spinach', 'Frozen green beans', 'Frozen mixed vegetables', 'Frozen edamame', 'Frozen hash browns', 'Frozen French fries']],
  ['Fruit',
    ['Frozen berries'],
    ['Frozen mango', 'Frozen bananas']],
  ['Meat & seafood',
    ['Chicken breasts', 'Ground beef'],
    ['Chicken thighs', 'Ground turkey', 'Pork chops', 'Pork shoulder', 'Steak', 'Shrimp', 'Salmon fillets', 'White fish fillets', 'Italian sausage (frozen)', 'Meatballs']],
  ['Ready to cook',
    [],
    ['Frozen pizza', 'Chicken nuggets', 'Dumplings', 'Waffles', 'Frozen ravioli', 'Puff pastry', 'Pie crust', 'Frozen bread']],
  ['Other',
    [],
    ['Homemade stock', 'Ice cream', 'Frozen butter']],
];

export const DEV_CATALOG: CatalogItem[] = [
  ...build('pantry', PANTRY),
  ...build('fridge', FRIDGE),
  ...build('freezer', FREEZER),
];
