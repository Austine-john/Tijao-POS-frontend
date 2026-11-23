import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk, useCurrentShift, useRefreshAfterWrite, useShifts } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, api } from "@/lib/api";
import { kes } from "@/lib/format";
import type { Shift } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Banner, Button, Card, EmptyState, Modal, PageHeader, Spinner } from "@/components/ui";
import { CloseShiftModal, OpenShiftCard, OverShort, PayoutModal, ShiftClosedResult, ShiftFigures, shiftDay, shiftTime } from "./shift/ShiftParts";

export default function ShiftPage() {
  const { me } = useAuth();
  const owner = !!me?.is_owner;
  const qc = useQueryClient();
  const refresh = useRefreshAfterWrite();
  const current = useCurrentShift();
  const [payout, setPayout] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState<Shift | null>(null);

  const setShift = (s: Shift | null) => qc.setQueryData(qk.shift, s);

  if (closed) return <ShiftClosedResult s={closed} onDone={() => setClosed(null)} />;

  const s = current.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Shift" subtitle="Open the till at the start of the day, record cash taken out, and close the till at the end." />

      {current.isLoading ? (
        <Spinner />
      ) : current.error ? (
        <Banner tone="error" title="Can't load the shift" action={<Button variant="secondary" onClick={() => current.refetch()}>Try again</Button>}>
          {current.error.message}
        </Banner>
      ) : !s ? (
        <OpenShiftCard
          onOpened={(sh) => {
            setShift(sh);
            refresh();
          }}
        />
      ) : (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5">
            <div>
              <h2 className="text-lg font-semibold">The till is open</h2>
              <p className="text-ink-soft">
                {s.cashier_name} · since {shiftTime(s.opened_at)} · started with {kes(s.opening_float)} · {s.sales_count} {s.sales_count === 1 ? "sale" : "sales"} so far
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="lg" onClick={() => setPayout(true)}>
                Record cash taken out
              </Button>
              {(s.is_mine || owner) && (
                <Button size="lg" onClick={() => setClosing(true)}>
                  Close the till
                </Button>
              )}
            </div>
          </div>

          {owner && s.expected_cash !== undefined && (
            <div className="border-b border-line p-5">
              <h3 className="mb-2 font-medium">Money in the drawer right now <span className="font-normal text-ink-soft">(only you can see this)</span></h3>
              <div className="max-w-md">
                <ShiftFigures s={s} />
              </div>
            </div>
          )}

          <div className="p-5">
            <h3 className="mb-2 font-medium">Cash taken out</h3>
            {s.payouts.length === 0 ? (
              <p className="text-ink-soft">None yet. Use “Record cash taken out” whenever money leaves the drawer.</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.payouts.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {p.reason}
                      {p.note ? ` · ${p.note}` : ""}
                      <span className="text-ink-soft"> · {shiftTime(p.recorded_at)}</span>
                    </span>
                    <span className="tabular font-medium">{kes(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {owner && <ShiftHistory />}

      <PayoutModal
        open={payout}
        onClose={() => setPayout(false)}
        onSaved={(sh) => {
          setShift(sh);
          setPayout(false);
          void qc.invalidateQueries({ queryKey: qk.shift });
        }}
      />
      {closing && (
        <CloseShiftModal
          open
          onClose={() => setClosing(false)}
          onClosed={(sh) => {
            setClosing(false);
            setClosed(sh);
            setShift(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ShiftHistory() {
  const shifts = useShifts();
  const [open, setOpen] = useState<string | null>(null);
  const rows = (shifts.data ?? []).filter((s) => s.status === "Closed");

  return (
    <Card>
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-lg font-semibold">Past shifts</h2>
        <p className="text-sm text-ink-soft">Open a shift to see its sales and cash, then mark it as checked.</p>
      </div>
      {shifts.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState title="No closed shifts yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th className="px-5 py-2 font-medium">Day</th>
                <th className="px-3 py-2 font-medium">Cashier</th>
                <th className="px-3 py-2 text-right font-medium">Sales</th>
                <th className="px-3 py-2 text-right font-medium">Expected cash</th>
                <th className="px-3 py-2 text-right font-medium">Counted</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.name}>
                  <td className="px-5 py-3">
                    {shiftDay(s.opened_at)}
                    <div className="text-sm text-ink-soft">
                      {shiftTime(s.opened_at)}–{shiftTime(s.closed_at)}
                    </div>
                  </td>
                  <td className="px-3 py-3">{s.cashier_name}</td>
                  <td className="tabular px-3 py-3 text-right">{kes((s.cash_sales ?? 0) + (s.mpesa_sales ?? 0))}</td>
                  <td className="tabular px-3 py-3 text-right">{kes(s.expected_cash)}</td>
                  <td className="tabular px-3 py-3 text-right">{kes(s.counted_cash)}</td>
                  <td className="px-3 py-3">
                    <OverShort diff={s.cash_difference ?? 0} />
                    <div className="text-sm text-ink-soft">{s.reviewed ? "Checked" : "Not checked yet"}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="secondary" onClick={() => setOpen(s.name)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <ShiftDetailModal name={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function ShiftDetailModal({ name, onClose }: { name: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const detail = useQuery({ queryKey: ["shift", name], queryFn: () => api.getShift(name) });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const s = detail.data;

  async function review() {
    setBusy(true);
    setError(null);
    try {
      await api.reviewShift(name, note.trim() || undefined);
      void qc.invalidateQueries({ queryKey: qk.shifts });
      void qc.invalidateQueries({ queryKey: ["shift", name] });
      toast("Shift marked as checked.");
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Not saved.", "server"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="shift-detail" wide>
      {!s ? (
        <Spinner />
      ) : (
        <>
          <h2 id="shift-detail" className="text-lg font-semibold">
            {s.cashier_name} · {shiftDay(s.opened_at)}, {shiftTime(s.opened_at)}–{shiftTime(s.closed_at)}
          </h2>
          <p className="mb-4 text-ink-soft">Closed by {s.closed_by}</p>
          <div className="mb-4">
            <OverShort diff={s.cash_difference ?? 0} big />
          </div>
          {!!s.voided_after_close && (
            <div className="mb-4">
              <Banner tone="warning" title={`${s.voided_after_close} sale(s) were voided after this shift closed`}>
                The figures below are as they were at closing.
              </Banner>
            </div>
          )}
          <div className="max-w-md">
            <ShiftFigures s={s} />
          </div>
          {s.notes && <p className="mt-3 border-l-2 border-line pl-3 text-ink-soft">Cashier's note: {s.notes}</p>}
          {s.payouts.length > 0 && (
            <>
              <h3 className="mb-1 mt-5 font-medium">Cash taken out</h3>
              <ul className="divide-y divide-line">
                {s.payouts.map((p, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span>
                      {p.reason}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                    <span className="tabular">{kes(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h3 className="mb-1 mt-5 font-medium">Sales ({s.sales?.length ?? 0})</h3>
          <div className="max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line">
            {(s.sales ?? []).map((x) => (
              <div key={x.invoice} className="flex justify-between px-3 py-1.5">
                <span className={x.status === "voided" ? "text-ink-faint line-through" : ""}>
                  {x.posting_time.slice(0, 5)} · {x.invoice}
                </span>
                <span className="tabular">{kes(x.total)}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            {s.reviewed ? (
              <p>
                ✓ Checked by {s.reviewed_by}
                {s.review_note ? `: ${s.review_note}` : ""}
              </p>
            ) : (
              <>
                <label className="mb-1 block font-medium" htmlFor="review-note">
                  Your note <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <input
                  id="review-note"
                  placeholder="e.g. Talked to the cashier about the KES 20"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mb-3 h-11 w-full rounded-md border border-line px-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                />
                {error && (
                  <div className="mb-3">
                    <Banner tone="error" title="Not saved">
                      {error.message}
                    </Banner>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="secondary" size="lg" onClick={onClose}>
                    Close
                  </Button>
                  <Button size="lg" loading={busy} onClick={review}>
                    Mark as checked
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
