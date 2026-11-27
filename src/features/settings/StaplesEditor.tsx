/** Always-buy and kids' snack editor. Used by Settings; usable from the list screen too. */
import { useState } from "react";
import type { Staple } from "@shared/types";
import { store, useCollection } from "@shared/store";
import { Button, Chip, ChipRow, TextField } from "@shared/ui";
import { STAPLE_SUGGESTIONS, makeStaple } from "../onboarding/staples";

type Base = Omit<Staple, "updatedAt">;

export function StaplesEditor() {
  const docs = useCollection("staples");
  const [name, setName] = useState("");

  const isOn = (id: string) => docs[id]?.active ?? false;
  const toggle = (s: Base) => store.put("staples", s.id, { ...(docs[s.id] ?? s), active: !isOn(s.id), updatedAt: Date.now() });
  const add = () => {
    const s = makeStaple(name);
    if (!s.id) return;
    store.put("staples", s.id, { ...(docs[s.id] ?? s), active: true, updatedAt: Date.now() });
    setName("");
  };

  const known = new Set(STAPLE_SUGGESTIONS.map((s) => s.id));
  const yours = Object.values(docs).filter((d) => !known.has(d.id)).sort((a, b) => a.name.localeCompare(b.name));
  const group = (label: string, list: Base[]) =>
    list.length > 0 && (
      <div className="ck-stack" style={{ gap: 8 }}>
        <div className="ck-st-label">{label}</div>
        <ChipRow label={label}>
          {list.map((s) => (
            <Chip key={s.id} selected={isOn(s.id)} onChange={() => toggle(s)}>
              {s.name}
            </Chip>
          ))}
        </ChipRow>
      </div>
    );

  return (
    <div className="ck-stack">
      {group("Every trip", STAPLE_SUGGESTIONS.filter((s) => s.kind !== "kids-snack"))}
      {group("Kids' snacks & lunchbox", STAPLE_SUGGESTIONS.filter((s) => s.kind === "kids-snack"))}
      {group("Added by you", yours)}
      <form
        className="ck-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <TextField label="Add something you always buy" placeholder="e.g. sparkling water" value={name} onChange={(e) => setName(e.target.value)} enterKeyHint="done" style={{ flex: 1 }} />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
