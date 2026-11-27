/** Living style guide at #ui. Lets every thread see and screenshot the primitives. Not linked from the tab bar. */
import { useState } from "react";
import {
  ActionBar, AppBar, Badge, Button, Card, Check, Chip, ChipRow, EmptyState, IconButton, OptionCard, Progress,
  RecipeCard, RecipeGrid, SearchField, SectionTitle, Segmented, Sheet, Stepper, SwapBar, TextField, TriState, toast,
  type StockState,
} from "./index";

export function UiGallery() {
  const [chips, setChips] = useState<Record<string, boolean>>({ Flour: true, Penne: true, "Brown sugar": true, Orzo: false });
  const [filter, setFilter] = useState("All");
  const [loc, setLoc] = useState<"pantry" | "fridge" | "freezer" | "spices">("pantry");
  const [stock, setStock] = useState<StockState>("have");
  const [kids, setKids] = useState(1);
  const [lunch, setLunch] = useState("leftovers");
  const [checked, setChecked] = useState(false);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);

  return (
    <div>
      <AppBar title="Style guide" subtitle="Cookin UI primitives" actions={<IconButton icon="settings" label="Settings" />} />
      <Progress step={3} total={8} />

      <RecipeCard variant="hero" overline="Tonight · Thursday" title="Sheet-pan chicken with lemon and olives" minutes={45} missing={1}
        actions={<><Button>Cook this</Button><Button variant="secondary" icon="swap">Swap</Button></>} />

      <SwapBar filters={["All", "Quicker", "Under 30 min"].map(f => (
        <Chip key={f} kind="filter" selected={filter === f} onChange={() => setFilter(f)}>{f}</Chip>
      ))}>
        <RecipeCard variant="compact" title="Pasta with garlic, greens and parm" minutes={20} missing={0} />
        <RecipeCard variant="compact" title="Fried rice with eggs and peas" minutes={15} missing={0} />
        <RecipeCard variant="compact" title="Black bean tacos" minutes={25} missing={1} />
      </SwapBar>

      <SectionTitle action={<Button variant="ghost" size="sm">Select all</Button>}>Chips</SectionTitle>
      <ChipRow label="Baking">
        {Object.entries(chips).map(([name, on]) => (
          <Chip key={name} selected={on} low={name === "Brown sugar"} onChange={v => setChips({ ...chips, [name]: v })}>{name}</Chip>
        ))}
      </ChipRow>

      <SectionTitle>Controls</SectionTitle>
      <div className="ck-stack">
        <SearchField value={q} onChange={setQ} placeholder="Search 250 ingredients" />
        <Segmented label="Location" value={loc} onChange={setLoc} options={[
          { value: "pantry", label: "Pantry" }, { value: "fridge", label: "Fridge" }, { value: "freezer", label: "Freezer" }, { value: "spices", label: "Spices" },
        ]} />
        <div className="ck-pantry-row" style={{ borderRadius: 14 }}>
          <span className="ck-pantry-row__icon" aria-hidden="true">🧁</span><span>All-purpose flour</span>
          <TriState label="All-purpose flour" value={stock} onChange={v => { setStock(v); toast(`Flour marked ${v}.`, { label: "Undo", run: () => setStock(stock) }); }} />
        </div>
        <div className="ck-row" style={{ justifyContent: "space-between" }}><span>Kids</span><Stepper label="kids" value={kids} onChange={setKids} /></div>
        <OptionCard selected={lunch === "leftovers"} onSelect={() => setLunch("leftovers")} title="Leftovers when we can" description="Dinner makes extra for tomorrow's lunch" />
        <OptionCard selected={lunch === "easy"} onSelect={() => setLunch("easy")} title="Easy lunches every day" />
        <TextField label="Add an item" />
        <div className="ck-row ck-row--wrap"><Badge tone="have">Have everything</Badge><Badge tone="low">Need 1</Badge><Badge tone="need">Need 4</Badge><Badge>Synced Sunday</Badge></div>
      </div>

      <SectionTitle>List</SectionTitle>
      <ul className="ck-list">
        <li className="ck-list-item" data-checked={checked}>
          <Check label="Chicken thighs" checked={checked} onChange={setChecked} />
          <div><span className="ck-list-item__name">Chicken thighs</span><span className="ck-list-item__why">for Sheet-pan chicken · Thu</span></div>
          <span className="ck-list-item__qty">2 lb</span>
        </li>
      </ul>

      <SectionTitle>Recipes</SectionTitle>
      <RecipeGrid>
        <RecipeCard title="Weeknight turkey chili" minutes={40} missing={0} />
        <RecipeCard title="Miso-butter salmon with rice" minutes={30} missing={3} />
      </RecipeGrid>

      <Card pad style={{ marginTop: 16 }}><EmptyState title="Nothing planned yet" action={<Button>Plan this week</Button>}>Pick a few recipes and I'll write the list.</EmptyState></Card>

      <ActionBar><Button block onClick={() => setSheet(true)}>Open a sheet</Button></ActionBar>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Swap Thursday">
        <p className="ck-muted">Sheet content goes here.</p>
      </Sheet>
    </div>
  );
}
