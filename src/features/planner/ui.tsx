/** Small shared pieces for the planner and recipe screens. Classes come from src/styles/components.css. */
import { useEffect, useState, type ReactNode } from "react";
import type { Recipe } from "@shared/types";

/** Badge text for a recipe given how many ingredients are missing (mirrors haveBadge in @styles/tokens). */
export function haveBadge(missing: number): { tone: "have" | "low" | "need"; text: string } {
  if (missing === 0) return { tone: "have", text: "Have everything" };
  if (missing <= 2) return { tone: "low", text: `Need ${missing}` };
  return { tone: "need", text: `Need ${missing}` };
}

export function HaveBadge({ missing }: { missing: number }) {
  const b = haveBadge(missing);
  return <span className={`ck-badge ck-badge--${b.tone}`}>{b.text}</span>;
}

/** Recipe photo, or the design system's warm fallback tile with the first letter. */
export function RecipeImg({ recipe, eager }: { recipe: Pick<Recipe, "title" | "imageUrl">; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (recipe.imageUrl && !failed) {
    return <img src={recipe.imageUrl} alt="" loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />;
  }
  return <div className="ck-recipe-card__fallback" aria-hidden="true">{recipe.title.replace(/^(the|a|an)\s+/i, "").charAt(0).toUpperCase()}</div>;
}

export function minutesLabel(m?: number): string | undefined {
  if (m == null) return undefined;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

export function Time({ minutes }: { minutes?: number }) {
  const l = minutesLabel(minutes);
  return l ? <span className="ck-pl-time"><ClockIcon />{l}</span> : null;
}

export function Sheet({ open, onClose, label, children, tall }: { open: boolean; onClose: () => void; label: string; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="ck-scrim" onClick={onClose} />
      <div className={`ck-sheet ck-pl-sheet${tall ? " ck-pl-sheet--tall" : ""}`} role="dialog" aria-modal="true" aria-label={label}>
        <div className="ck-sheet__grip" />
        {children}
      </div>
    </>
  );
}

export interface ToastMsg { text: string; action?: { label: string; run: () => void } }

/* Same call shape as toast() in @shared/ui (design PR #4); switch the import when it lands. */
type Live = ToastMsg & { id: number; at: number };
const toastSubs = new Set<(t: Live | null) => void>();
let toastSeq = 0;
/** Kept so a toast fired right before navigating still shows on the next screen. */
let lastToast: Live | null = null;
export function toast(text: string, action?: ToastMsg["action"]) {
  const msg = { id: ++toastSeq, text, action, at: Date.now() };
  lastToast = msg;
  toastSubs.forEach((fn) => fn(msg));
}
export function ToastHost({ duration = 5000 }: { duration?: number }) {
  const [msg, setMsg] = useState<Live | null>(() => (lastToast && Date.now() - lastToast.at < 1500 ? lastToast : null));
  useEffect(() => { toastSubs.add(setMsg); return () => { toastSubs.delete(setMsg); }; }, []);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => { setMsg(null); if (lastToast?.id === msg.id) lastToast = null; }, duration - (Date.now() - msg.at));
    return () => window.clearTimeout(t);
  }, [msg, duration]);
  if (!msg) return null;
  return (
    <div className="ck-toast" role="status" aria-live="polite" key={msg.id}>
      <span>{msg.text}</span>
      {msg.action && <button type="button" onClick={() => { msg.action!.run(); lastToast = null; setMsg(null); }}>{msg.action.label}</button>}
    </div>
  );
}

/* ---- icons (inline, stroke = currentColor) ---- */
const I = ({ d, size = 20 }: { d: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
export const ClockIcon = () => <I size={14} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />;
export const PlusIcon = () => <I d={<path d="M12 5v14M5 12h14" />} />;
export const CheckIcon = () => <I d={<path d="M5 12.5l4.5 4.5L19 7.5" />} />;
export const BackIcon = () => <I d={<path d="M15 5l-7 7 7 7" />} />;
export const ChevronL = () => <I d={<path d="M15 6l-6 6 6 6" />} />;
export const ChevronR = () => <I d={<path d="M9 6l6 6-6 6" />} />;
export const CloseIcon = () => <I d={<path d="M6 6l12 12M18 6L6 18" />} />;
export const MoreIcon = () => <I d={<><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>} />;
export const SwapIcon = () => <I d={<><path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" /></>} />;
export const CartIcon = () => <I d={<><circle cx="9" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 8H6.2" /></>} />;
export const ExternalIcon = () => <I size={16} d={<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>} />;
export const GearIcon = () => <I d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>} />;
export const BoltIcon = () => <I size={14} d={<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" />} />;
