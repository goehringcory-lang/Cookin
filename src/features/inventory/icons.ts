import type { StorageLocation } from "./types";

/** Keyword -> emoji, checked in order against the lowercased item name. */
const BY_NAME: [RegExp, string][] = [
  [/eggplant/, "🍆"],
  [/flour|cornstarch|cornmeal|baking (soda|powder)|yeast/, "🌾"],
  [/sugar|sweetener/, "🍬"],
  [/honey/, "🍯"],
  [/maple|molasses|syrup/, "🍁"],
  [/vanilla|extract/, "🧴"],
  [/cocoa|chocolate/, "🍫"],
  [/oat|cereal|granola/, "🥣"],
  [/oil|cooking spray/, "🫒"],
  [/vinegar/, "🍶"],
  [/salt/, "🧂"],
  [/pepper flakes|cayenne|chili powder|paprika|chipotle|hot pepper|jalape|sriracha|hot sauce|chili crisp|gochujang/, "🌶️"],
  [/bell pepper/, "🫑"],
  [/pepper|cumin|cinnamon|nutmeg|clove|allspice|turmeric|coriander|curry|masala|seasoning|seeds|ginger|oregano|thyme|bay|spice/, "🫙"],
  [/garlic/, "🧄"],
  [/onion|shallot|scallion|leek|chive/, "🧅"],
  [/potato/, "🥔"],
  [/tomato|marinara|ketchup|salsa/, "🍅"],
  [/broth|stock|soup/, "🍲"],
  [/bean|chickpea|lentil|edamame|pea/, "🫘"],
  [/coconut/, "🥥"],
  [/tuna|anchov|salmon|fish|cod/, "🐟"],
  [/shrimp|prawn/, "🦐"],
  [/peanut butter|nut|almond|walnut|pecan|cashew/, "🥜"],
  [/jam|jelly|preserve/, "🍓"],
  [/olive|caper|pickle|kimchi|sauerkraut/, "🫒"],
  [/soy|fish sauce|hoisin|oyster|worcestershire|sauce|dressing|miso|pesto|tahini|hummus/, "🥫"],
  [/mustard|mayo/, "🥪"],
  [/spaghetti|pasta|noodle|lasagna|macaroni|ramen|couscous/, "🍝"],
  [/rice|quinoa|farro|grain/, "🍚"],
  [/bread|bun|pita|naan|crumb|panko|bagel|roll/, "🍞"],
  [/tortilla|taco/, "🌮"],
  [/cracker|chip|pretzel|goldfish/, "🍘"],
  [/fig bar|fruit bar|granola bar|snack|raisin|dried fruit|date/, "🍪"],
  [/egg/, "🥚"],
  [/milk|half-and-half|buttermilk|cream(?! cheese)/, "🥛"],
  [/butter/, "🧈"],
  [/cheese|cheddar|mozzarella|parmesan|feta|ricotta|jack/, "🧀"],
  [/yogurt|sour cream/, "🥄"],
  [/chicken|turkey|nugget/, "🍗"],
  [/beef|steak|burger/, "🥩"],
  [/bacon|pork|ham|sausage|hot dog/, "🥓"],
  [/tofu/, "🧊"],
  [/carrot/, "🥕"],
  [/broccoli|cauliflower|brussels|cabbage/, "🥦"],
  [/spinach|kale|lettuce|greens|arugula|herb|parsley|cilantro|basil|mint|dill|rosemary|sage/, "🥬"],
  [/cucumber|zucchini|squash/, "🥒"],
  [/mushroom/, "🍄"],
  [/corn/, "🌽"],
  [/asparagus|green bean|celery/, "🥬"],
  [/avocado/, "🥑"],
  [/banana/, "🍌"],
  [/lemon/, "🍋"],
  [/lime|orange|citrus/, "🍊"],
  [/apple/, "🍎"],
  [/berr|strawberr|blueberr/, "🫐"],
  [/grape/, "🍇"],
  [/wine/, "🍷"],
  [/beer/, "🍺"],
  [/juice/, "🧃"],
  [/ice cream/, "🍨"],
  [/pizza/, "🍕"],
  [/fries|tots/, "🍟"],
  [/waffle/, "🧇"],
  [/dumpling|potsticker|gyoza/, "🥟"],
  [/pastry|pie/, "🥧"],
];

const BY_LOCATION: Record<StorageLocation, string> = { pantry: "🥫", fridge: "🧊", freezer: "❄️" };

/** A friendly emoji for an item row. Falls back to the storage location. */
export function itemEmoji(name: string, category: string, location: StorageLocation): string {
  const n = name.toLowerCase();
  for (const [re, e] of BY_NAME) if (re.test(n)) return e;
  const c = category.toLowerCase();
  if (/spice|herb/.test(c)) return "🫙";
  if (/produce|vegetable|fruit/.test(c)) return "🥬";
  if (/dairy/.test(c)) return "🥛";
  if (/meat|fish/.test(c)) return "🍖";
  if (/snack/.test(c)) return "🍪";
  return BY_LOCATION[location];
}
