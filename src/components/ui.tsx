import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import { Loader2, X } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons: one primary (green) action per screen; everything else is quiet.
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "mpesa";
type Size = "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 disabled:bg-brand-700/40 disabled:shadow-none",
  mpesa: "bg-mpesa text-white shadow-sm hover:bg-mpesa-dark disabled:bg-mpesa/40 disabled:shadow-none",
  secondary: "border border-line bg-white text-ink hover:bg-canvas disabled:opacity-50",
  ghost: "text-ink-soft hover:bg-canvas hover:text-ink disabled:opacity-50",
  danger: "bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-50",
};
const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-[15px] gap-2",
  lg: "h-12 px-5 text-base gap-2",
  xl: "h-14 px-6 text-lg gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = "primary", size = "md", loading, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center rounded-md font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Surfaces and headings
// ---------------------------------------------------------------------------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-lg border border-line bg-white shadow-card", className)}>{children}</div>;
}

/** Page title + one sentence telling the user what this screen is for. */
export function PageHeader({ title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** "1 Choose products · 2 Enter quantities · 3 Check and save": shows where you are in a task. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cx(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              i < current ? "bg-brand-100 text-brand-800" : i === current ? "bg-brand-700 text-white ring-4 ring-brand-100" : "bg-white text-ink-soft ring-1 ring-line",
            )}
          >
            {i + 1}
          </span>
          <span className={i === current ? "font-medium text-ink" : "text-ink-soft"} aria-current={i === current ? "step" : undefined}>
            {s}
          </span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** The drink's colour mark (see lib/flavour). */
export function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-full ring-2 ring-white" style={{ background: color }} aria-hidden />;
}

/** Small status text with a coloured dot. Colour is never the only signal: the label says it. */
export function Status({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted"; children: ReactNode }) {
  const dot = { ok: "bg-brand-500", warn: "bg-warn-600", bad: "bg-danger-600", muted: "bg-ink-faint" }[tone];
  const text = { ok: "text-ink", warn: "text-warn-700", bad: "text-danger-700", muted: "text-ink-soft" }[tone];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-sm font-medium", text)}>
      <span className={cx("h-2 w-2 rounded-full", dot)} aria-hidden />
      {children}
    </span>
  );
}

/** Kept for existing call sites; renders as Status. */
export function Badge({ tone = "green", children }: { tone?: "green" | "orange" | "red" | "grey"; children: ReactNode; className?: string }) {
  const map = { green: "ok", orange: "warn", red: "bad", grey: "muted" } as const;
  return <Status tone={map[tone]}>{children}</Status>;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-ink-soft" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="text-lg font-medium text-ink">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-md text-ink-soft">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

type Tone = "error" | "warning" | "success" | "info" | "offline";

export function Banner({ tone, title, children, onClose, action }: { tone: Tone; title: string; children?: ReactNode; onClose?: () => void; action?: ReactNode }) {
  const bar: Record<Tone, string> = {
    error: "border-danger-600 bg-danger-50",
    warning: "border-warn-600 bg-warn-50",
    offline: "border-warn-600 bg-warn-50",
    success: "border-brand-500 bg-brand-50",
    info: "border-ink-faint bg-white",
  };
  const titleColor: Record<Tone, string> = {
    error: "text-danger-700",
    warning: "text-warn-700",
    offline: "text-warn-700",
    success: "text-brand-800",
    info: "text-ink",
  };
  return (
    <div role={tone === "error" || tone === "offline" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-md border-l-4 px-4 py-3", bar[tone])}>
      <div className="min-w-0 flex-1">
        <div className={cx("font-semibold", titleColor[tone])}>{title}</div>
        {children && <div className="mt-0.5 text-ink">{children}</div>}
      </div>
      {action}
      {onClose && (
        <button onClick={onClose} className="rounded p-1 text-ink-soft hover:bg-black/5" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({ open, onClose, children, labelledBy, wide }: { open: boolean; onClose: () => void; children: ReactNode; labelledBy?: string; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus], input, button");
    first?.focus();
    return () => prev?.focus?.();
  }, [open]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className={cx("max-h-[92vh] w-full overflow-y-auto rounded-lg bg-white p-6 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Whole-number entry. Tap and type; the old number is selected so typing replaces it.
 * Enter jumps to the next quantity box, so a whole shelf can be counted from the keyboard.
 */
export function QtyInput({
  value,
  onChange,
  label,
  max,
  size = "md",
  autoFocus,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  size?: "md" | "lg";
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <input
      aria-label={label}
      data-qty
      autoFocus={autoFocus}
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={text}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focused.current = false;
        setText(String(value));
      }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
        setText(digits);
        let n = digits === "" ? 0 : parseInt(digits, 10);
        if (max !== undefined && n > max) n = max;
        onChange(n);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const all = Array.from(document.querySelectorAll<HTMLInputElement>("input[data-qty]"));
        const next = all[all.indexOf(e.currentTarget) + 1];
        next ? next.focus() : e.currentTarget.blur();
      }}
      className={cx(
        "tabular rounded-md border border-line bg-white text-center font-semibold text-ink outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100",
        size === "lg" ? "h-12 w-24 text-xl" : "h-10 w-20 text-lg",
      )}
    />
  );
}

/** Kept name for older call sites. */
export const Stepper = QtyInput;

export function MoneyInput({ id, value, onChange, placeholder, autoFocus, invalid, label }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; invalid?: boolean; label?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">KES</span>
      <input
        id={id}
        aria-label={label}
        data-autofocus={autoFocus ? "" : undefined}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        className={cx(
          "tabular h-14 w-full rounded-md border bg-white pl-14 pr-4 text-2xl font-semibold outline-none focus:ring-2",
          invalid ? "border-danger-600 focus:ring-danger-100" : "border-line focus:border-brand-600 focus:ring-brand-100",
        )}
      />
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, inputRef }: { value: string; onChange: (v: string) => void; placeholder: string; inputRef?: Ref<HTMLInputElement> }) {
  return (
    <div className="relative flex-1">
      <svg className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-md border border-line bg-white pl-10 pr-3 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
    </div>
  );
}

/** Filter choice. Looks like a quiet tab, not a pill. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors",
        active ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-soft hover:border-brand-300 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Pick one of a few options (period, paper width, payment reason...). */
export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex rounded-md border border-line bg-white p-0.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx("h-9 rounded px-3 text-sm font-medium", value === o.value ? "bg-brand-700 text-white" : "text-ink-soft hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="text-sm text-ink-soft">{hint}</span>}
    </label>
  );
}

/** A labelled number. Big money is the only large type on a page. */
export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "bad" | "warn" }) {
  return (
    <div className="rounded-lg border border-line border-t-[3px] border-t-brand-600 bg-white px-4 py-3 shadow-card">
      <div className="text-sm font-medium text-ink-soft">{label}</div>
      <div className={cx("tabular mt-0.5 text-[26px] font-bold", tone === "bad" ? "text-danger-700" : tone === "warn" ? "text-warn-700" : "text-ink")}>{value}</div>
      {note && <div className="mt-0.5 text-sm text-ink-soft">{note}</div>}
    </div>
  );
}
