import { useEffect, useState } from "react";
import { kes } from "@/lib/format";
import type { Sale } from "@/lib/types";
import { useHotkeys } from "@/hooks/useHotkeys";
import { PrintReceipt, Receipt, usePaperWidth } from "@/components/Receipt";
import { Button, Segmented } from "@/components/ui";

const AUTO_NEXT_SECONDS = 30;

export function SaleDone({ sale, cashGiven, change, onNext }: { sale: Sale; cashGiven: number | null; change: number | null; onNext: () => void }) {
  const [width, setWidth] = usePaperWidth();
  const [printing, setPrinting] = useState(false);
  const [left, setLeft] = useState(AUTO_NEXT_SECONDS);

  useEffect(() => {
    if (printing) return;
    if (left <= 0) {
      onNext();
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, printing, onNext]);

  useHotkeys({
    Enter: (e) => (e.preventDefault(), onNext()),
    " ": (e) => (e.preventDefault(), onNext()),
    p: () => setPrinting(true),
  });

  const isCash = sale.payment.mode === "cash";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="overflow-hidden rounded-lg border border-line bg-white shadow-lift">
        <div className="flex items-center gap-4 bg-brand-700 px-6 py-5 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black text-brand-700" aria-hidden>
            ✓
          </span>
          <div>
            <p className="text-xl font-bold">Sale saved{sale.duplicate ? " (already saved, not saved twice)" : ""}</p>
            <p className="text-white/80">
              {isCash ? "Paid in cash" : `Paid by M-Pesa${sale.payment.mpesa_ref ? ` · ${sale.payment.mpesa_ref}` : ""}`} · {kes(sale.total)} · stock updated
            </p>
          </div>
        </div>
        <div className="p-6">

        {isCash && (
          <div className="mb-6 rounded-md border-l-4 border-brand-600 bg-brand-50 px-5 py-4">
            <div className="font-medium text-brand-800">Give the customer this change</div>
            <div className="tabular text-5xl font-bold tracking-tight text-brand-900">{kes(change ?? 0)}</div>
            {cashGiven != null && <div className="mt-1 text-sm text-brand-800/80">Customer gave {kes(cashGiven)}</div>}
          </div>
        )}

        <div>
          <Button size="xl" className="w-full" onClick={onNext}>
            Next customer
          </Button>
          <p className="mt-2 text-center text-sm text-ink-soft">Press Enter, or wait {left}s</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <Button variant="secondary" size="lg" onClick={() => setPrinting(true)}>
            Print receipt
          </Button>
          <Segmented
            label="Paper width"
            value={width}
            onChange={setWidth}
            options={[
              { value: 58, label: "58mm" },
              { value: 80, label: "80mm" },
            ]}
          />
        </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm text-ink-soft">Receipt</div>
        <div className="rounded border border-line bg-white p-4">
          <Receipt sale={sale} cashGiven={cashGiven} change={change} />
        </div>
      </div>

      {printing && <PrintReceipt sale={sale} cashGiven={cashGiven} change={change} width={width} onDone={() => setPrinting(false)} />}
    </div>
  );
}
