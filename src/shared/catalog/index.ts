/**
 * INTERIM catalog + matcher (ported from the prototype) so feature threads can build now.
 * The ingredient-catalog thread replaces the internals with packages/ingredients; this file's
 * exported names and shapes are the stable API, so features import only from "@shared/catalog".
 */
import type { CatalogItem, Location } from "../types";

/* Kitchen catalog: "Name:alias,alias|Name|..." per category. Ids are slugs of names. */
const CATALOG_SRC: Record<Location, Record<string, string>> = {
  pantry: {
    "Baking": "All-purpose flour:flour,plain flour|Bread flour|Whole wheat flour|Granulated sugar:sugar,white sugar,caster sugar|Brown sugar:light brown sugar,dark brown sugar|Powdered sugar:confectioners sugar,confectioners' sugar,icing sugar|Baking soda:bicarbonate of soda|Baking powder|Yeast:active dry yeast,instant yeast|Vanilla extract:vanilla|Cocoa powder:unsweetened cocoa|Chocolate chips:semisweet chocolate,bittersweet chocolate,dark chocolate,chocolate|Cornstarch:corn starch|Honey|Maple syrup|Molasses|Rolled oats:oats,old-fashioned oats,oatmeal|Cornmeal:polenta",
    "Oils & vinegars": "Olive oil:extra-virgin olive oil,extra virgin olive oil|Vegetable oil:canola oil,neutral oil,grapeseed oil,sunflower oil,avocado oil|Sesame oil:toasted sesame oil|Cooking spray:nonstick spray|Red wine vinegar|White wine vinegar|Apple cider vinegar:cider vinegar|Rice vinegar:rice wine vinegar,seasoned rice vinegar|Balsamic vinegar|White vinegar:distilled white vinegar",
    "Spices & dried herbs": "Kosher salt:salt,sea salt,flaky salt,table salt,fine salt|Black pepper:pepper,ground pepper,peppercorns,black peppercorns|Garlic powder|Onion powder|Ground cumin:cumin,cumin seeds|Chili powder|Smoked paprika:pimenton|Paprika:sweet paprika|Red pepper flakes:crushed red pepper,red-pepper flakes,chile flakes,red chile flakes,chili flakes,aleppo pepper,gochugaru|Cayenne:cayenne pepper|Ground cinnamon:cinnamon,cinnamon stick|Ground ginger|Nutmeg|Dried oregano:oregano|Dried thyme|Bay leaves:bay leaf|Italian seasoning|Curry powder|Garam masala|Turmeric:ground turmeric|Ground coriander:coriander,coriander seeds|Cloves:ground cloves|Allspice|Fennel seeds|Mustard seeds|Taco seasoning|Everything bagel seasoning",
    "Canned & jarred": "Chicken broth:chicken stock|Vegetable broth:vegetable stock|Beef broth:beef stock|Canned tomatoes:diced tomatoes,crushed tomatoes,whole peeled tomatoes,peeled tomatoes,san marzano|Tomato paste|Tomato sauce:marinara,marinara sauce,pasta sauce|Coconut milk:coconut cream|Black beans|Chickpeas:garbanzo beans,garbanzos|Kidney beans|White beans:cannellini beans,cannellini,great northern beans,navy beans,butter beans|Pinto beans|Refried beans|Canned tuna:tuna|Peanut butter|Jam:jelly,preserves|Salsa:salsa verde|Olives:kalamata olives,castelvetrano olives,green olives,black olives|Capers|Pickles|Roasted red peppers|Anchovies:anchovy,anchovy fillets|Chipotles in adobo:chipotle,chipotle chiles,chipotle peppers",
    "Sauces & condiments": "Soy sauce:tamari,shoyu,low-sodium soy sauce|Fish sauce|Hoisin sauce:hoisin|Oyster sauce|Sriracha|Hot sauce:tabasco,frank's|Worcestershire sauce:worcestershire|Ketchup|Yellow mustard:mustard|Dijon mustard:dijon,whole-grain mustard,grainy mustard|Mayonnaise:mayo,kewpie|BBQ sauce:barbecue sauce|Chili crisp:chile crisp,chili oil|Gochujang|Tahini",
    "Pasta, rice & grains": "Spaghetti|Long pasta:linguine,fettuccine,bucatini,angel hair,tagliatelle,pappardelle,capellini|Short pasta:pasta,rigatoni,fusilli,orecchiette,ziti,macaroni,elbow macaroni,farfalle,penne,shells,orzo,ditalini,gemelli,campanelle|Lasagna noodles:lasagna|Egg noodles|Rice noodles:rice vermicelli,pad thai noodles|Asian noodles:ramen,ramen noodles,soba,udon,lo mein noodles|White rice:rice,jasmine rice,basmati rice,long-grain rice,short-grain rice,sushi rice|Brown rice|Arborio rice:risotto rice,carnaroli|Quinoa|Couscous:israeli couscous,pearl couscous|Farro|Lentils:red lentils,green lentils,brown lentils,french lentils|Breadcrumbs:bread crumbs,panko,panko bread crumbs",
    "Bread & snacks": "Sandwich bread:bread,sliced bread,white bread,whole wheat bread,sourdough,sourdough bread,country bread|Tortillas:flour tortillas,corn tortillas|Hamburger buns:buns,hot dog buns,brioche buns|Pita:pita bread,naan,flatbread|Crackers|Tortilla chips|Nuts:almonds,walnuts,pecans,cashews,peanuts,pine nuts,pistachios,hazelnuts|Seeds:sesame seeds,pumpkin seeds,sunflower seeds,chia seeds|Dried fruit:raisins,dried cranberries,dates,dried apricots|Cereal",
    "Produce on the counter": "Onions:onion,yellow onion,white onion,sweet onion,yellow onions|Red onion|Shallots:shallot|Garlic:garlic cloves,garlic clove,head of garlic|Potatoes:potato,russet potatoes,yukon gold potatoes,baby potatoes,red potatoes,new potatoes|Sweet potatoes:sweet potato,yams|Tomatoes:tomato,cherry tomatoes,grape tomatoes,plum tomatoes|Avocados:avocado|Bananas:banana|Lemons:lemon,lemon juice,lemon zest|Limes:lime,lime juice,lime zest|Apples:apple|Fresh ginger:ginger,ginger root|Winter squash:butternut squash,acorn squash,delicata squash,pumpkin"
  },
  fridge: {
    "Dairy & eggs": "Eggs:egg,large eggs,egg yolks,egg yolk,egg whites,egg white|Milk:whole milk,2% milk|Heavy cream:heavy whipping cream,whipping cream,cream,double cream|Half-and-half:half and half|Butter:unsalted butter,salted butter|Buttermilk|Sour cream:creme fraiche|Greek yogurt:yogurt,plain yogurt,whole-milk yogurt|Cream cheese|Cheddar:cheddar cheese,sharp cheddar|Mozzarella:fresh mozzarella,mozzarella cheese,burrata|Parmesan:parmigiano-reggiano,parmigiano reggiano,parmigiano,grated parmesan,pecorino,pecorino romano,grana padano|Feta:feta cheese|Monterey Jack:pepper jack,monterey jack cheese|Shredded Mexican cheese:mexican blend,mexican cheese,cotija,queso fresco|Sliced cheese:american cheese,provolone,swiss cheese,gruyere,fontina,havarti|Ricotta|Goat cheese:chevre",
    "Meat, fish & tofu": "Chicken breasts:chicken breast,boneless skinless chicken breasts,chicken cutlets|Chicken thighs:chicken thigh,boneless skinless chicken thighs,bone-in chicken thighs,chicken legs,drumsticks,chicken drumsticks|Whole chicken:chicken|Ground beef:ground chuck|Ground turkey|Ground pork|Pork chops|Pork tenderloin|Pork shoulder:pork butt|Bacon:pancetta|Sausage:italian sausage,chorizo,kielbasa,sausages|Steak:flank steak,skirt steak,sirloin,rib-eye,ribeye,strip steak,hanger steak|Beef for stew:chuck roast,beef chuck,short ribs,brisket|Salmon:salmon fillets,salmon fillet|Shrimp:prawns|White fish:cod,halibut,tilapia,flounder,haddock,sea bass|Deli turkey:sliced turkey,deli meat,turkey slices|Ham:deli ham,prosciutto|Hot dogs:frankfurters|Tofu:firm tofu,extra-firm tofu,silken tofu",
    "Vegetables & fruit": "Carrots:carrot|Celery:celery stalks,celery stalk|Bell peppers:bell pepper,red bell pepper,red pepper,green pepper,yellow pepper,orange bell pepper|Hot peppers:jalapeno,jalapenos,serrano,serrano chile,fresno chile,thai chile,chiles,chile|Broccoli:broccolini|Cauliflower|Spinach:baby spinach|Kale:lacinato kale,tuscan kale|Lettuce:romaine,iceberg,mixed greens,salad greens,arugula,little gem|Cabbage:red cabbage,napa cabbage,green cabbage,savoy cabbage|Cucumbers:cucumber,english cucumber,persian cucumbers|Zucchini:summer squash,yellow squash|Mushrooms:mushroom,cremini,cremini mushrooms,shiitake,button mushrooms,oyster mushrooms|Green beans:haricots verts|Asparagus|Scallions:scallion,green onions,green onion|Corn on the cob:corn,fresh corn,ears of corn,corn kernels|Brussels sprouts|Eggplant:eggplants|Leeks:leek|Berries:strawberries,blueberries,raspberries,blackberries|Grapes|Oranges:orange,orange juice,orange zest",
    "Fresh herbs": "Parsley:flat-leaf parsley,fresh parsley,italian parsley|Cilantro:fresh cilantro|Basil:fresh basil,basil leaves|Mint:fresh mint,mint leaves|Dill:fresh dill|Fresh thyme:thyme,thyme sprigs,thyme leaves|Rosemary:fresh rosemary,rosemary sprigs|Chives|Sage:fresh sage,sage leaves",
    "Fridge condiments & drinks": "Miso:white miso,red miso,miso paste|Pesto|Hummus|Salad dressing:ranch,vinaigrette,caesar dressing|Kimchi|Sauerkraut|Dry white wine:white wine|Red wine:dry red wine|Beer:lager|Orange juice"
  },
  freezer: {
    "Frozen vegetables & fruit": "Frozen peas:peas,green peas|Frozen corn|Frozen spinach|Frozen broccoli|Frozen mixed vegetables:mixed vegetables|Frozen edamame:edamame|Frozen berries:frozen fruit,frozen blueberries,frozen strawberries",
    "Frozen meals & proteins": "Frozen pizza|Chicken nuggets:nuggets,chicken tenders|Frozen dumplings:dumplings,potstickers,gyoza|Frozen shrimp|Frozen chicken|Frozen ground beef|Frozen fish fillets:fish sticks",
    "Frozen sides & treats": "Frozen fries:french fries,tater tots|Frozen waffles|Puff pastry|Pie crust:pie dough,pie shell|Ice cream|Frozen bread:frozen rolls,garlic bread"
  }
};


export const LOCATION_NAMES: Record<Location, string> = { pantry: "Pantry", fridge: "Fridge", freezer: "Freezer" };

const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const norm = (s: string) => " " + String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\u2018\u2019]/g, "'") + " ";
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ASSUMED = new Set(["kosher-salt"]);

export const CATALOG: CatalogItem[] = [];
for (const location of Object.keys(CATALOG_SRC) as Location[]) for (const category of Object.keys(CATALOG_SRC[location])) {
  for (const part of CATALOG_SRC[location][category].split("|")) {
    const [name, al] = part.split(":");
    const id = slug(name);
    CATALOG.push({ id, name, location, category, aliases: al ? al.split(",") : [], assumed: ASSUMED.has(id) || undefined });
  }
}

let items = new Map<string, CatalogItem>();
let aliasIndex: { a: string; id: string; re: RegExp }[] = [];
/** Rebuild the matcher with Cory's custom items (collection `customItems`). Cheap; call when they change. */
export function setCustomItems(custom: CatalogItem[]) {
  items = new Map([...CATALOG, ...custom].map(i => [i.id, i]));
  aliasIndex = [];
  for (const it of items.values()) for (const a of [it.name, ...it.aliases]) {
    const n = norm(a).trim();
    if (n) aliasIndex.push({ a: n, id: it.id, re: new RegExp("(^|[^a-z])" + reEsc(n) + "(?:s|es)?(?=[^a-z]|$)", "g") });
  }
  aliasIndex.sort((x, y) => y.a.length - x.a.length);
  cache.clear();
  version++;
  catalogListeners.forEach(f => f());
}
const cache = new Map<string, string[]>();
let version = 0;
const catalogListeners = new Set<() => void>();
/** Increments whenever setCustomItems() rebuilds the matcher. */
export const catalogVersion = () => version;
export const subscribeCatalog = (fn: () => void) => { catalogListeners.add(fn); return () => { catalogListeners.delete(fn); }; };

export const getItem = (id: string) => items.get(id);
export const allItems = () => [...items.values()];
export function searchCatalog(q: string): CatalogItem[] {
  const n = q.trim().toLowerCase();
  if (!n) return allItems();
  return allItems().filter(i => i.name.toLowerCase().includes(n) || i.aliases.some(a => a.includes(n)));
}
/** Sections for onboarding/inventory, in catalog order. */
export function catalogGroups(location: Location): { category: string; items: CatalogItem[] }[] {
  const out: { category: string; items: CatalogItem[] }[] = [];
  for (const it of allItems()) {
    if (it.location !== location) continue;
    const cat = it.custom ? "Added by you" : it.category;
    let g = out.find(x => x.category === cat);
    if (!g) out.push(g = { category: cat, items: [] });
    g.items.push(it);
  }
  return out;
}

/** Catalog ids an ingredient line refers to (may be several, e.g. "salt and pepper"). */
export function matchLine(line: string): string[] {
  const hit = cache.get(line);
  if (hit) return hit;
  let s = norm(line);
  const ids: string[] = [];
  for (const { a, id, re } of aliasIndex) {
    if (s.indexOf(a) < 0) continue;
    let found = false;
    s = s.replace(re, (m: string, p: string) => { found = true; return p + " ".repeat(m.length - p.length); });
    if (found && !ids.includes(id)) ids.push(id);
  }
  cache.set(line, ids);
  return ids;
}
const IGNORE = /(^|[^a-z])(water|ice cubes?|ice)([^a-z]|$)/;

export type Owned = Set<string> | string[] | ((id: string) => boolean);
const ownedFn = (o: Owned) => typeof o === "function" ? o : (o instanceof Set ? (id: string) => o.has(id) : (id: string) => o.includes(id));

export interface RecipeAnalysis {
  /** Catalog ids the recipe needs that are owned. */
  have: string[];
  /** Catalog ids the recipe needs that are not owned. */
  missing: string[];
  /** Ingredient lines that matched nothing in the catalog. */
  unknown: string[];
  /** Per line detail, in recipe order. */
  lines: { line: string; ids: string[]; status: "have" | "missing" | "unknown" | "ignored" }[];
  /** have / (have + missing), 0..1 (1 when nothing is tracked). */
  coverage: number;
  /** Every tracked ingredient is owned. */
  canMake: boolean;
}
export function analyzeRecipe(recipe: { ingredients: string[] }, owned: Owned): RecipeAnalysis {
  const isOwned = ownedFn(owned);
  const have: string[] = [], missing: string[] = [], unknown: string[] = [];
  const lines: RecipeAnalysis["lines"] = [];
  for (const line of recipe.ingredients || []) {
    const ids = matchLine(line);
    if (!ids.length) {
      const ignored = IGNORE.test(norm(line));
      if (!ignored) unknown.push(line);
      lines.push({ line, ids, status: ignored ? "ignored" : "unknown" });
      continue;
    }
    let all = true;
    for (const id of ids) {
      const ok = isOwned(id) || !!items.get(id)?.assumed;
      if (!ok) all = false;
      const bucket = ok ? have : missing;
      if (!bucket.includes(id)) bucket.push(id);
    }
    lines.push({ line, ids, status: all ? "have" : "missing" });
  }
  const t = have.length + missing.length;
  return { have, missing, unknown, lines, coverage: t ? have.length / t : 1, canMake: missing.length === 0 };
}
/** Recipes ranked for "you can make this now": canMake first, then by fewest missing. */
export function makeableRecipes<R extends { ingredients: string[] }>(recipes: R[], owned: Owned, opts: { maxMissing?: number } = {}) {
  const max = opts.maxMissing ?? 0;
  return recipes.map(r => ({ recipe: r, analysis: analyzeRecipe(r, owned) }))
    .filter(x => x.analysis.missing.length <= max)
    .sort((a, b) => a.analysis.missing.length - b.analysis.missing.length || b.analysis.coverage - a.analysis.coverage);
}
/** Clean display name from an unmatched line: "2 cups fresh tarragon, chopped" -> "Fresh tarragon". */
export function cleanIngredientName(line: string): string {
  let s = String(line).replace(/\([^)]*\)/g, " ").split(",")[0];
  s = s.replace(/[\d\u00bd\u2153\u2154\u00bc\u00be\u215b\/.\-\u2013]+/g, " ");
  s = s.replace(/\b(cups?|tablespoons?|tbsps?|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|grams?|g|kg|ml|cans?|jars?|packages?|bunch(?:es)?|heads?|cloves?|pinch(?:es)?|sprigs?|stalks?|slices?|sticks?|large|medium|small|whole|pieces?|inch(?:es)?|of|about|plus|more|to taste|for serving|optional)\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : String(line).trim();
}

setCustomItems([]);
