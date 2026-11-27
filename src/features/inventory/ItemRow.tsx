import { memo, useRef } from "react";
import type { InventoryItem, StockStatus } from "./types";
import { LOCATIONS } from "./types";
import { itemEmoji } from "./icons";

interface Props {
  item: InventoryItem;
  showLocation?: boolean;
  /** Tap on the name: quick toggle between have and out. */
  onTap(item: InventoryItem): void;
  /** Explicit Have / Low / Out choice. */
  onSet(item: InventoryItem, status: StockStatus): void;
  onEdit(item: InventoryItem): void;
}

export function statusLabel(item: InventoryItem): string | null {
  if (item.status === "low") return "Running low · on your list";
  if (item.status === "out") {
    if (item.neededFor) return `Out · on your list for ${item.neededFor}`;
    if (item.onList) return "Out · on your list";
    return "Out";
  }
  return null;
}

const STATES: { id: StockStatus; label: string }[] = [
  { id: "have", label: "Have" },
  { id: "low", label: "Low" },
  { id: "out", label: "Out" },
];

const LONG_PRESS_MS = 450;

function ItemRowImpl({ item, showLocation, onTap, onSet, onEdit }: Props) {
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  };

  const loc = LOCATIONS.find((l) => l.id === item.location);
  const label = statusLabel(item);

  return (
    <li className={`inv-row inv-row--${item.status}`}>
      <button
        type="button"
        className="inv-row__main"
        onPointerDown={(e) => {
          longPressed.current = false;
          start.current = { x: e.clientX, y: e.clientY };
          timer.current = window.setTimeout(() => {
            longPressed.current = true;
            navigator.vibrate?.(15);
            onEdit(item);
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          // Scrolling cancels the long press.
          if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!longPressed.current) {
            clear();
            longPressed.current = true;
            onEdit(item);
          }
        }}
        onClick={() => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          navigator.vibrate?.(8);
          onTap(item);
        }}
      >
        <span className="inv-row__icon" aria-hidden="true">
          {itemEmoji(item.name, item.category, item.location)}
        </span>
        <span className="inv-row__text">
          <span className="inv-row__name">{item.name}</span>
          {(label || showLocation) && (
            <span className="inv-row__meta">
              {label && <span className="inv-row__status">{label}</span>}
              {showLocation && loc && <span className="inv-row__loc">{loc.label}</span>}
            </span>
          )}
          <span className="inv-sr">
            {item.status === "have" ? " Tap to mark out." : " Tap to mark in stock."} Press and hold for more.
          </span>
        </span>
      </button>
      <div className="inv-tri" role="radiogroup" aria-label={`${item.name} status`}>
        {STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            data-value={s.id}
            aria-checked={item.status === s.id}
            onClick={() => {
              if (item.status === s.id) return;
              navigator.vibrate?.(8);
              onSet(item, s.id);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </li>
  );
}

export const ItemRow = memo(ItemRowImpl);
