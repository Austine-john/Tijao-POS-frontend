import { useState, type FormEvent } from "react";
import { ApiError, api } from "@/lib/api";
import { kes } from "@/lib/format";
import { PAYOUT_REASONS, type PayoutReason, type Shift } from "@/lib/types";
import { CashCounter } from "@/components/CashCounter";
import { PrintSlip, SlipRow, SlipRule, usePaperWidth } from "@/components/Receipt";
import { Banner, Button, Card, Modal, MoneyInput, Steps, cx } from "@/components/ui";

export function shiftTime(dt?: string | null): string {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? dt : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function shiftDay(dt?: string | null): string {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? dt : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Open shift
// ---------------------------------------------------------------------------

export function OpenShiftCard({ onOpened }: { onOpened: (s: Shift) => void }) {
  const [float, setFloat] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (float == null || busy) return;
    setBusy(true);
    setError(null);
    try {
      onOpened(await api.openShift(float));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Could not open the shift.", "server"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl p-6">
      <form onSubmit={submit}>
        <h2 className="text-xl font-semibold">Start of day: open the till</h2>
        <p className="mb-5 mt-1 text-ink-soft">
          Before the first sale, count the money already in the drawer (the change you start with). Selling unlocks once the shift is open.
        </p>
        <CashCounter onChange={setFloat} />
        {error && (
          <div className="mt-4">
            <Banner tone="error" title="Shift not opened">
              {error.message}
            </Banner>
          </div>
        )}
        <Button type="submit" size="xl" className="mt-5 w-full" loading={busy} disabled={float == null}>
          Open the till with {kes(float ?? 0)}
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pay-out
// ---------------------------------------------------------------------------

export function PayoutModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (s: Shift) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<PayoutReason>("Paid distributor");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const amt = Number(amount || 0);
  const needNote = reason === "Other" && !note.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (amt <= 0 || needNote || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.addPayout(amt, reason, note.trim() || undefined));
      setAmount("");
      setNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Pay-out not saved.", "server"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} labelledBy="payout-title">
      <form onSubmit={submit}>
        <h2 id="payout-title" className="text-lg font-semibold">
          Cash taken out of the drawer
        </h2>
        <p className="mb-5 mt-1 text-ink-soft">Record every amount that leaves the drawer, so the till balances when you close.</p>
        <label htmlFor="payout-amount" className="mb-1 block font-medium">
          How much?
        </label>
        <div className="mb-5">
          <MoneyInput id="payout-amount" autoFocus value={amount} onChange={setAmount} />
        </div>
        <div className="mb-1 font-medium">What was it for?</div>
        <div className="mb-4 flex flex-wrap gap-2">
          {PAYOUT_REASONS.map((r) => (
            <button
              type="button"
              key={r}
              aria-pressed={reason === r}
              onClick={() => setReason(r)}
              className={cx("h-10 rounded-md border px-3 text-sm font-medium", reason === r ? "border-ink bg-ink text-white" : "border-line text-ink hover:bg-canvas")}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          aria-label="Note"
          placeholder={reason === "Other" ? "What was the cash for? (required)" : "Note (optional), e.g. Kisumu Bottlers"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mb-5 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
        {error && (
          <div className="mb-4">
            <Banner tone="error" title="Not saved">
              {error.message}
            </Banner>
          </div>
        )}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" size="xl" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="xl" className="flex-1" loading={busy} disabled={amt <= 0 || needNote}>
            Save {amt > 0 ? kes(amt) : ""} taken out
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Close shift (blind)
// ---------------------------------------------------------------------------

export function CloseShiftModal({ open, onClose, onClosed }: { open: boolean; onClose: () => void; onClosed: (s: Shift) => void }) {
  const [counted, setCounted] = useState<number | null>(0);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit() {
    if (counted == null || busy) return;
    setBusy(true);
    setError(null);
    try {
      onClosed(await api.closeShift(counted, notes.trim() || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Shift not closed.", "server"));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} labelledBy="close-title" wide>
      <h2 id="close-title" className="text-xl font-semibold">
        End of day: close the till
      </h2>
      <p className="mb-4 mt-1 text-ink-soft">Count all the money in the drawer. You will see whether it balances after you close.</p>
      <Steps steps={["Count the cash", "Confirm and close"]} current={confirm ? 1 : 0} />
      <CashCounter onChange={setCounted} />
      <textarea
        aria-label="Notes"
        placeholder="Notes for the owner (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="mt-4 w-full rounded-md border border-line p-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
      />
      {error && (
        <div className="mt-4">
          <Banner tone="error" title="Shift not closed">
            {error.message}
          </Banner>
        </div>
      )}
      {confirm ? (
        <div className="mt-5 rounded-md border border-line bg-canvas p-4">
          <p className="mb-3 font-medium">
            Close with {kes(counted ?? 0)} counted? After closing, nobody can sell until a new shift is opened.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" size="xl" onClick={() => setConfirm(false)} disabled={busy}>
              Back
            </Button>
            <Button size="xl" className="flex-1" loading={busy} onClick={submit}>
              Yes, close shift
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" size="xl" onClick={onClose}>
            Cancel
          </Button>
          <Button size="xl" className="flex-1" disabled={counted == null} onClick={() => setConfirm(true)}>
            Next: confirm
          </Button>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Result / Z-report
// ---------------------------------------------------------------------------

export function OverShort({ diff, big }: { diff: number; big?: boolean }) {
  const tone = Math.abs(diff) < 0.5 ? "ok" : diff < 0 ? "short" : "over";
  const label = tone === "ok" ? "Balanced" : tone === "short" ? `Short ${kes(Math.abs(diff))}` : `Over ${kes(diff)}`;
  return (
    <span className={cx(big ? "text-2xl font-semibold" : "font-medium", tone === "ok" ? "text-brand-700" : tone === "short" ? "text-danger-700" : "text-warn-700")}>{label}</span>
  );
}

export function ShiftFigures({ s }: { s: Shift }) {
  const rows: [string, number, string?][] = [
    ["Opening float", s.opening_float],
    ["+ Cash sales", s.cash_sales ?? 0],
    ["− Pay-outs", s.payouts_total ?? 0],
    ["= Expected cash", s.expected_cash ?? 0, "font-bold"],
  ];
  if (s.status === "Closed") rows.push(["Counted cash", s.counted_cash ?? 0, "font-bold"]);
  return (
    <div className="space-y-1">
      {rows.map(([label, value, cls]) => (
        <div key={label} className={cx("flex justify-between gap-4", cls)}>
          <span className="text-ink-soft">{label}</span>
          <span className="tabular">{kes(value)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-4 border-t border-line pt-2">
        <span className="text-ink-soft">M-Pesa (check against the phone)</span>
        <span className="tabular font-semibold">{kes(s.mpesa_sales ?? 0)}</span>
      </div>
    </div>
  );
}

export function ShiftClosedResult({ s, onDone }: { s: Shift; onDone: () => void }) {
  const [printing, setPrinting] = useState(false);
  const [width] = usePaperWidth();
  const diff = s.cash_difference ?? 0;
  return (
    <Card className="mx-auto max-w-xl p-6">
      <p className="text-ink-soft">Shift closed · {s.cashier_name}</p>
      <h1 className="mb-1 mt-1 text-2xl font-semibold">{Math.abs(diff) < 0.5 ? "The till balances" : diff < 0 ? "The till is short" : "The till has extra cash"}</h1>
      <div className="mb-5">
        <OverShort diff={diff} big />
      </div>
      <ShiftFigures s={s} />
      <div className="mt-2 text-ink-soft">
        {s.sales_count} sales{s.voided_count ? ` · ${s.voided_count} voided` : ""} · {shiftTime(s.opened_at)}–{shiftTime(s.closed_at)}
      </div>
      <div className="mt-6 flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setPrinting(true)}>
          Print shift report
        </Button>
        <Button size="lg" className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
      {printing && (
        <PrintSlip width={width} onDone={() => setPrinting(false)}>
          <ShiftSlip s={s} />
        </PrintSlip>
      )}
    </Card>
  );
}

/** End-of-shift (Z) report for the thermal printer. */
export function ShiftSlip({ s }: { s: Shift }) {
  return (
    <div className="receipt font-mono text-[12px] leading-snug text-black">
      <div className="text-center text-[14px] font-bold uppercase">Shift report</div>
      <div className="text-center">{s.name}</div>
      <SlipRule />
      <SlipRow left="Cashier:" right={s.cashier_name} />
      <SlipRow left="Opened:" right={`${shiftDay(s.opened_at)} ${shiftTime(s.opened_at)}`} />
      <SlipRow left="Closed:" right={`${shiftDay(s.closed_at)} ${shiftTime(s.closed_at)}`} />
      <SlipRule />
      <SlipRow left="Sales:" right={String(s.sales_count)} />
      {!!s.voided_count && <SlipRow left="Voided:" right={String(s.voided_count)} />}
      <SlipRow left="Cash sales:" right={kes(s.cash_sales)} />
      <SlipRow left="M-Pesa sales:" right={kes(s.mpesa_sales)} />
      <SlipRule />
      <SlipRow left="Opening float:" right={kes(s.opening_float)} />
      {s.payouts.map((p, i) => (
        <SlipRow key={i} left={`- ${p.reason}`} right={kes(p.amount)} />
      ))}
      <SlipRow left="Expected cash:" right={kes(s.expected_cash)} bold />
      <SlipRow left="Counted cash:" right={kes(s.counted_cash)} bold />
      <SlipRow left={(s.cash_difference ?? 0) < 0 ? "SHORT:" : "OVER:"} right={kes(Math.abs(s.cash_difference ?? 0))} bold />
      {s.notes && (
        <>
          <SlipRule />
          <div>Notes: {s.notes}</div>
        </>
      )}
      <SlipRule />
      <div className="mt-4">Cashier sign: ________</div>
      <div className="mt-4">Owner sign: __________</div>
    </div>
  );
}
