import { useMemo, useState, type FormEvent } from "react";
import { ApiError } from "@/lib/api";
import { changeBreakdown, changeDue, quickAmounts } from "@/lib/cart";
import { kes } from "@/lib/format";
import type { PaymentMode } from "@/lib/types";
import { Banner, Button, Modal, MoneyInput, cx } from "@/components/ui";

export interface PaymentModalProps {
  mode: PaymentMode | null;
  total: number;
  bottles: number;
  submitting: boolean;
  error: ApiError | null;
  onCancel: () => void;
  onConfirm: (p: { cashGiven?: number; mpesaRef?: string }) => void;
}

export function PaymentModal({ mode, total, bottles, submitting, error, onCancel, onConfirm }: PaymentModalProps) {
  return (
    <Modal open={mode !== null} onClose={() => !submitting && onCancel()} labelledBy="pay-title">
      {mode === "cash" && <CashForm total={total} bottles={bottles} submitting={submitting} error={error} onCancel={onCancel} onConfirm={onConfirm} />}
      {mode === "mpesa" && <MpesaForm total={total} bottles={bottles} submitting={submitting} error={error} onCancel={onCancel} onConfirm={onConfirm} />}
    </Modal>
  );
}

type FormProps = Omit<PaymentModalProps, "mode">;

function Header({ title, total, bottles }: { title: string; total: number; bottles: number }) {
  return (
    <div className="-mx-6 -mt-6 mb-5 bg-brand-50 px-6 pb-4 pt-5">
      <h2 id="pay-title" className="text-lg font-bold text-brand-900">
        {title}
      </h2>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="text-brand-800">
          To pay · {bottles} {bottles === 1 ? "item" : "items"}
        </span>
        <span className="tabular text-[34px] font-bold tracking-tight text-brand-900">{kes(total)}</span>
      </div>
    </div>
  );
}

function SubmitError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  if (error.kind === "network") {
    return (
      <div className="mb-4">
        <Banner tone="offline" title="No connection. This sale was NOT saved.">
          Check the connection, then press Try again. The sale will not be saved twice.
        </Banner>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <Banner tone="error" title="Sale not saved">
        {error.message}
      </Banner>
    </div>
  );
}

function Actions({ submitting, error, onCancel, disabled, mpesa }: { submitting: boolean; error: ApiError | null; onCancel: () => void; disabled?: boolean; mpesa?: boolean }) {
  const retry = error?.kind === "network";
  return (
    <div className="flex gap-2">
      <Button type="button" variant="secondary" size="xl" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" variant={mpesa ? "mpesa" : "primary"} size="xl" className="flex-1" loading={submitting} disabled={disabled}>
        {submitting ? "Saving…" : retry ? "Try again" : "Complete sale"}
      </Button>
    </div>
  );
}

function CashForm({ total, bottles, submitting, error, onCancel, onConfirm }: FormProps) {
  const [given, setGiven] = useState("");
  const amounts = useMemo(() => quickAmounts(total), [total]);
  const givenNum = given.trim() === "" ? total : Number(given.replace(/,/g, ""));
  const change = changeDue(total, givenNum);
  const tooLittle = given.trim() !== "" && change === null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (tooLittle || submitting) return;
    onConfirm({ cashGiven: givenNum });
  }

  return (
    <form onSubmit={submit}>
      <Header title="Cash payment" total={total} bottles={bottles} />

      <label htmlFor="given" className="mb-1 block font-medium">
        Amount given by customer
      </label>
      <p className="mb-2 text-sm text-ink-soft">Leave empty if the customer gave the exact amount.</p>
      <MoneyInput id="given" autoFocus value={given} onChange={setGiven} placeholder={String(total)} invalid={tooLittle} />
      <div className="mb-5 mt-2 flex flex-wrap gap-2">
        {amounts.slice(1).map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => setGiven(String(a))}
            className={cx("h-10 rounded-md border px-3 text-sm font-medium", givenNum === a && given !== "" ? "border-ink bg-ink text-white" : "border-line text-ink hover:bg-canvas")}
          >
            {kes(a)}
          </button>
        ))}
      </div>

      <div className={cx("mb-5 rounded-md px-4 py-3", tooLittle ? "bg-danger-50" : "bg-canvas")} aria-live="polite">
        {tooLittle ? (
          <p className="font-medium text-danger-700">
            Customer gave less than {kes(total)}. {kes(total - givenNum)} more needed.
          </p>
        ) : (
          <div className="flex items-baseline justify-between">
            <span className="text-ink-soft">Change to give back</span>
            <span className="text-right">
              <span className="tabular block text-[34px] font-bold tracking-tight text-ink">{kes(change ?? 0)}</span>
              {!!change && (
                <span className="text-sm text-ink-soft">
                  {changeBreakdown(change)
                    .map((d) => `${d.count} × ${d.value}`)
                    .join(" + ")}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <SubmitError error={error} />
      <Actions submitting={submitting} error={error} onCancel={onCancel} disabled={tooLittle} />
    </form>
  );
}

function MpesaForm({ total, bottles, submitting, error, onCancel, onConfirm }: FormProps) {
  const [code, setCode] = useState("");
  const clean = code.replace(/\s+/g, "").toUpperCase();
  const invalid = clean !== "" && !/^[A-Z0-9]{6,20}$/.test(clean);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid || submitting) return;
    onConfirm({ mpesaRef: clean || undefined });
  }

  return (
    <form onSubmit={submit}>
      <Header title="M-Pesa payment" total={total} bottles={bottles} />
      <ol className="mb-5 list-decimal space-y-1 pl-5 text-ink">
        <li>Wait for the M-Pesa message confirming {kes(total)}.</li>
        <li>Type the code from the message (optional).</li>
        <li>Press Complete sale.</li>
      </ol>
      <label htmlFor="mpesa" className="mb-1 block font-medium">
        M-Pesa code <span className="font-normal text-ink-soft">(optional)</span>
      </label>
      <input
        id="mpesa"
        data-autofocus
        autoCapitalize="characters"
        autoComplete="off"
        placeholder="e.g. SKL7Q2WP89"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        className={cx("mb-1 h-12 w-full rounded-md border px-3 font-mono text-xl tracking-widest outline-none focus:ring-2", invalid ? "border-danger-600 focus:ring-danger-100" : "border-line focus:border-brand-600 focus:ring-brand-100")}
      />
      <p className={cx("mb-5 text-sm", invalid ? "text-danger-700" : "text-ink-soft")}>
        {invalid ? "Letters and numbers only, like SKL7Q2WP89." : "The code helps match payments at the end of the day."}
      </p>
      <SubmitError error={error} />
      <Actions submitting={submitting} error={error} onCancel={onCancel} disabled={invalid} mpesa />
    </form>
  );
}
