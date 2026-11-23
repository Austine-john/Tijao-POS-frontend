import { useState } from "react";
import { kes } from "@/lib/format";
import { QtyInput, Segmented } from "./ui";

// Kenyan notes and coins in common use.
const NOTES = [1000, 500, 200, 100, 50];
const COINS = [20, 10, 5, 1];

export function denominationTotal(counts: Record<number, number>): number {
  return Object.entries(counts).reduce((s, [v, n]) => s + Number(v) * (n || 0), 0);
}

/**
 * Count the drawer by notes and coins (fewer mistakes than adding up in your head),
 * or just type the total.
 */
export function CashCounter({ onChange }: { onChange: (total: number | null) => void }) {
  const [mode, setMode] = useState<"notes" | "total">("notes");
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [typed, setTyped] = useState("");

  const set = (value: number, n: number) => {
    const next = { ...counts, [value]: n };
    setCounts(next);
    onChange(denominationTotal(next));
  };

  const total = mode === "notes" ? denominationTotal(counts) : Number(typed || 0);

  return (
    <div>
      <div className="mb-4">
        <Segmented
          label="How to count"
          value={mode}
          onChange={(m) => {
            setMode(m);
            onChange(m === "notes" ? denominationTotal(counts) : typed.trim() === "" ? null : Number(typed));
          }}
          options={[
            { value: "notes", label: "Count notes and coins" },
            { value: "total", label: "Type the total" },
          ]}
        />
      </div>

      {mode === "notes" ? (
        <>
          <p className="mb-3 text-sm text-ink-soft">Type how many of each you have. Press Enter to go to the next one.</p>
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {[...NOTES, ...COINS].map((v) => (
              <div key={v} className="flex items-center justify-between gap-3 border-b border-line py-1.5">
                <span className="tabular">
                  KES {v.toLocaleString("en-KE")} <span className="text-sm text-ink-soft">{NOTES.includes(v) ? "notes" : "coins"}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular w-20 text-right text-sm text-ink-soft">{counts[v] ? kes(v * counts[v]) : ""}</span>
                  <QtyInput label={`Number of KES ${v} ${NOTES.includes(v) ? "notes" : "coins"}`} value={counts[v] ?? 0} onChange={(n) => set(v, n)} />
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft">KES</span>
          <input
            inputMode="numeric"
            aria-label="Total cash"
            data-autofocus
            value={typed}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setTyped(v);
              onChange(v === "" ? null : Number(v));
            }}
            className="tabular h-14 w-full rounded-md border border-line bg-white pl-14 pr-4 text-2xl font-semibold outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between rounded-md bg-canvas px-4 py-3">
        <span className="text-ink-soft">Total counted</span>
        <span className="tabular text-2xl font-semibold">{kes(total)}</span>
      </div>
    </div>
  );
}
