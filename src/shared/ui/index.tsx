/**
 * Cookin UI primitives. Thin React wrappers over the ck- classes in src/styles/components.css.
 * Spec: docs/design-spec.md §10. Import from "@shared/ui".
 * State lives in ARIA attributes (aria-pressed, aria-checked, aria-current), never extra classes.
 */
import {
  useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode,
} from "react";
import { haveBadge, type Availability } from "@styles/tokens";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ---------- Icons (Lucide-style strokes, MIT) ---------- */
const ICONS = {
  back: "M15 18l-6-6 6-6",
  close: "M18 6 6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  check: "M20 6 9 17l-5-5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  more: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  copy: "M9 9h12v12H9zM5 15V5a2 2 0 0 1 2-2h10",
  swap: "M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16",
  chevronRight: "M9 18l6-6-6-6",
  chevronLeft: "M15 18l-6-6 6-6",
  pot: "M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM2 10h20M9 6c0-1 .5-2 1.5-2M14 6c0-1 .5-2 1.5-2",
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- Buttons ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  block?: boolean;
  icon?: IconName;
};
export function Button({ variant = "primary", size = "md", block, icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx("ck-btn", `ck-btn--${variant}`, size === "sm" && "ck-btn--sm", block && "ck-btn--block", className)} {...rest}>
      {icon && <Icon name={icon} />}{children}
    </button>
  );
}

export function IconButton({ icon, label, float, className, type = "button", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; float?: boolean }) {
  return (
    <button type={type} aria-label={label} title={label} className={cx("ck-icon-btn", float && "ck-icon-btn--float", className)} {...rest}>
      <Icon name={icon} size={22} />
    </button>
  );
}

/* ---------- Layout ---------- */
export function AppBar({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: () => void }) {
  return (
    <header className="ck-appbar">
      <div className="ck-row" style={{ alignItems: "flex-start" }}>
        {back && <IconButton icon="back" label="Back" onClick={back} style={{ marginLeft: -10 }} />}
        <div>
          <h1 className="ck-h1">{title}</h1>
          {subtitle && <div className="ck-appbar__sub">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="ck-appbar__actions">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="ck-section-title">
      <h2 className="ck-h2" style={{ fontSize: 18 }}>{children}</h2>
      {action}
    </div>
  );
}

/** Sticky bottom bar for the screen's main action (onboarding Continue, plan mode Done). */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="ck-actionbar">{children}</div>;
}

export function Card({ pad, className, ...rest }: HTMLAttributes<HTMLDivElement> & { pad?: boolean }) {
  return <div className={cx("ck-card", pad && "ck-card--pad", className)} {...rest} />;
}

/* ---------- Chips, segmented, tri-state ---------- */
type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  selected: boolean;
  onChange?: (next: boolean) => void;
  /** "have" (green check, default) for inventory; "filter" (solid ink) for filters. */
  kind?: "have" | "filter";
  /** Shows the running-low style when selected. */
  low?: boolean;
  /** Long-press handler (e.g. mark running low during onboarding). */
  onLongPress?: () => void;
};
export function Chip({ selected, onChange, kind = "have", low, onLongPress, className, children, onClick, ...rest }: ChipProps) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const start = () => {
    if (!onLongPress) return;
    fired.current = false;
    timer.current = window.setTimeout(() => { fired.current = true; onLongPress(); }, 500);
  };
  const cancel = () => window.clearTimeout(timer.current);
  return (
    <button type="button" aria-pressed={selected}
      className={cx("ck-chip", kind === "filter" && "ck-chip--filter", low && "ck-chip--low", className)}
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onContextMenu={onLongPress ? e => e.preventDefault() : undefined}
      onClick={e => { if (fired.current) { fired.current = false; return; } onChange?.(!selected); onClick?.(e); }}
      {...rest}>
      {children}
    </button>
  );
}

export function ChipRow({ scroll, children, label }: { scroll?: boolean; children: ReactNode; label?: string }) {
  return <div className={cx("ck-chips", scroll && "ck-chips--scroll")} role="group" aria-label={label}>{children}</div>;
}

export function Segmented<T extends string>({ value, options, onChange, label }:
  { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ck-segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export type StockState = "have" | "low" | "out";
const STOCK: { value: StockState; label: string }[] = [
  { value: "have", label: "Have" }, { value: "low", label: "Low" }, { value: "out", label: "Out" },
];
export function TriState({ value, onChange, label }: { value: StockState; onChange: (v: StockState) => void; label: string }) {
  return (
    <div className="ck-tristate" role="radiogroup" aria-label={label}>
      {STOCK.map(o => (
        <button key={o.value} type="button" role="radio" data-value={o.value} aria-checked={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 20, label }:
  { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="ck-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <output aria-live="polite">{value}</output>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

export function OptionCard({ selected, onSelect, title, description }:
  { selected: boolean; onSelect: () => void; title: ReactNode; description?: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={selected} className="ck-option-card" onClick={onSelect}>
      <span className="ck-option-card__title">{title}</span>
      {description && <span className="ck-option-card__desc">{description}</span>}
    </button>
  );
}

export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="ck-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} data-done={i < step} />)}
    </div>
  );
}

/* ---------- Badges ---------- */
export function Badge({ tone, children }: { tone?: Availability; children: ReactNode }) {
  return <span className={cx("ck-badge", tone && `ck-badge--${tone}`)}>{children}</span>;
}
/** "Have everything" / "Need 2" badge from a recipe's missing-ingredient count. */
export function HaveBadge({ missing }: { missing: number }) {
  const b = haveBadge(missing);
  return <Badge tone={b.tone}>{b.text}</Badge>;
}
/** Alias: some threads call it a Tag. */
export const Tag = Badge;

/* ---------- Recipe cards ---------- */
export type RecipeCardProps = {
  title: string;
  image?: string;
  minutes?: number;
  missing?: number;
  variant?: "grid" | "compact" | "hero";
  overline?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  onOpen?: () => void;
  href?: string;
};
export function RecipeImage({ src, title }: { src?: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="ck-recipe-card__img">
      {src && !failed
        ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
        : <div className="ck-recipe-card__fallback" aria-hidden="true">{title.trim().charAt(0).toUpperCase()}</div>}
    </div>
  );
}
export function RecipeCard({ title, image, minutes, missing, variant = "grid", overline, meta, actions, onOpen, href }: RecipeCardProps) {
  const body = (
    <>
      <RecipeImage src={image} title={title} />
      <div className="ck-recipe-card__body">
        {overline && <div className="ck-overline">{overline}</div>}
        <h3 className="ck-recipe-card__title">{title}</h3>
        <div className="ck-recipe-card__meta">
          {minutes != null && <span>{formatMinutes(minutes)}</span>}
          {meta}
          {missing != null && <HaveBadge missing={missing} />}
        </div>
      </div>
    </>
  );
  const cls = cx("ck-card", "ck-recipe-card", variant !== "grid" && `ck-recipe-card--${variant}`);
  if (actions) {
    // Hero cards hold their own buttons, so the card itself is not a button.
    return (
      <article className={cls}>
        {body}
        <div className="ck-recipe-card__body" style={{ paddingTop: 0 }}><div className="ck-recipe-card__actions">{actions}</div></div>
      </article>
    );
  }
  if (href) return <a className={cls} href={href}>{body}</a>;
  return <button type="button" className={cls} onClick={onOpen}>{body}</button>;
}

export function RecipeGrid({ children }: { children: ReactNode }) {
  return <div className="ck-recipe-grid">{children}</div>;
}

export function SwapBar({ title = "Or make instead, with what you have", filters, children }:
  { title?: ReactNode; filters?: ReactNode; children: ReactNode }) {
  return (
    <section className="ck-swap-bar" aria-label="Swap options">
      <div className="ck-swap-bar__head"><h3 className="ck-swap-bar__title">{title}</h3></div>
      {filters && <ChipRow scroll label="Swap filters">{filters}</ChipRow>}
      <div className="ck-swap-bar__track">{children}</div>
    </section>
  );
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/* ---------- Inputs ---------- */
export function SearchField({ value, onChange, placeholder = "Search", label, ...rest }:
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <input type="search" className="ck-search" value={value} placeholder={placeholder} aria-label={label ?? placeholder}
      onChange={e => onChange(e.target.value)} enterKeyHint="search" autoComplete="off" {...rest} />
  );
}

export function TextField({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <input className="ck-input" aria-label={label} placeholder={rest.placeholder ?? label} {...rest} />;
}

/* ---------- Check (shopping list) ---------- */
export function Check({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className="ck-check" onClick={() => onChange(!checked)} />;
}

/* ---------- Sheet ---------- */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="ck-scrim" onClick={onClose} />
      <div className="ck-sheet" role="dialog" aria-modal="true" aria-labelledby={title ? id : undefined} tabIndex={-1} ref={ref}>
        <div className="ck-sheet__grip" />
        {title && (
          <div className="ck-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h2 className="ck-h2" id={id}>{title}</h2>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </>
  );
}

/* ---------- Toast with Undo ---------- */
type ToastMsg = { id: number; text: string; action?: { label: string; run: () => void } };
const toastSubs = new Set<(t: ToastMsg | null) => void>();
let toastSeq = 0;
/** Show a toast from anywhere: toast("Flour moved to Out.", { label: "Undo", run: undo }). */
export function toast(text: string, action?: { label: string; run: () => void }) {
  const msg = { id: ++toastSeq, text, action };
  toastSubs.forEach(fn => fn(msg));
}
/** Mount once in the app shell. */
export function ToastHost({ duration = 5000 }: { duration?: number }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => { toastSubs.add(setMsg); return () => { toastSubs.delete(setMsg); }; }, []);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), duration);
    return () => window.clearTimeout(t);
  }, [msg, duration]);
  if (!msg) return null;
  return (
    <div className="ck-toast" role="status" aria-live="polite" key={msg.id}>
      <span>{msg.text}</span>
      {msg.action && <button type="button" onClick={() => { msg.action!.run(); setMsg(null); }}>{msg.action.label}</button>}
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ title, children, action, icon = "pot" }: { title: ReactNode; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="ck-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[icon]} /></svg>
      <h2 className="ck-h2" style={{ color: "var(--ck-text)" }}>{title}</h2>
      {children && <p style={{ margin: 0 }}>{children}</p>}
      {action}
    </div>
  );
}
