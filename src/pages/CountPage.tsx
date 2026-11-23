import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCounts, useRefreshAfterWrite, useStockLevels } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, api } from "@/lib/api";
import { describeQty, kes, niceName, splitUnits, toSaleUnits } from "@/lib/format";
import { COUNT_REASONS, type CountReason, type StockCount, type StockLevel } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { Swatch, Banner, Button, Card, Chip, EmptyState, Modal, PageHeader, QtyInput, SearchBox, Segmented, Spinner, Status, Steps, cx } from "@/components/ui";
import { flavourColor } from "@/lib/flavour";
import { shiftDay, shiftTime } from "./shift/ShiftParts";

type Tab = "new" | "pending" | "history";

export default function CountPage() {
  const pending = useCounts("Pending");
  const [tab, setTab] = useState<Tab>("new");
  const n = pending.data?.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Stock count"
        subtitle="Count what is really on the shelf. The stock only changes after the owner approves."
        actions={
          <Segmented
            label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: "new", label: "New count" },
              { value: "pending", label: n ? `Waiting for approval (${n})` : "Waiting for approval" },
              { value: "history", label: "History" },
            ]}
          />
        }
      />
      {tab === "new" && <NewCount onSaved={() => setTab("pending")} />}
      {tab === "pending" && <CountList status="Pending" />}
      {tab === "history" && <CountList />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New count
// ---------------------------------------------------------------------------

interface Counted {
  bulk: number;
  loose: number;
}

function NewCount({ onSaved }: { onSaved: () => void }) {
  const { me } = useAuth();
  const stock = useStockLevels();
  const refresh = useRefreshAfterWrite();
  const toast = useToast();
  const [counts, setCounts] = useState<Record<string, Counted>>({});
  const [search, setSearch] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<CountReason | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState<StockCount | null>(null);

  const rows = stock.data ?? [];

  // Every row starts at what the system says; only the ones you change are sent.
  useEffect(() => {
    if (!stock.data) return;
    setCounts((prev) => {
      const next = { ...prev };
      for (const r of stock.data) if (!next[r.item_code]) next[r.item_code] = systemSplit(r);
      return next;
    });
  }, [stock.data]);

  const diffs = useMemo(
    () =>
      rows.map((r) => {
        const c = counts[r.item_code] ?? systemSplit(r);
        const counted = toSaleUnits(c.bulk, c.loose, r.per_bulk);
        const diff = counted - r.qty;
        return { r, c, counted, diff, value: diff * (r.valuation_rate || 0) };
      }),
    [rows, counts],
  );
  const changed = diffs.filter((d) => d.diff !== 0);
  const net = changed.reduce((s, d) => s + d.diff, 0);
  const netValue = changed.reduce((s, d) => s + d.value, 0);
  const visible = diffs.filter((d) => (!onlyChanged || d.diff !== 0) && (!search.trim() || d.r.item_name.toLowerCase().includes(search.trim().toLowerCase())));
  const needNote = reason === "Other" && !notes.trim();

  async function save() {
    if (!reason || needNote) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.saveCount(
        changed.map((d) => ({ item_code: d.r.item_code, bulk_qty: d.r.bulk_uom ? d.c.bulk : 0, loose_qty: d.r.bulk_uom ? d.c.loose : d.counted })),
        reason,
        notes.trim() || undefined,
      );
      setConfirming(false);
      setCounts({});
      setReason(null);
      setNotes("");
      refresh();
      if (res.count) setSaved(res.count);
      else toast(res.message);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Something went wrong. Nothing was saved.", "server"));
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <Card className="mx-auto max-w-xl p-6">
        <Steps steps={["Count", "Send to owner", "Owner approves"]} current={2} />
        <h2 className="text-xl font-semibold">Count sent to the owner</h2>
        <p className="mt-1 text-ink-soft">
          {saved.items_changed} {saved.items_changed === 1 ? "product is" : "products are"} different ({saved.total_difference > 0 ? "+" : ""}
          {saved.total_difference}, {kes(Math.round(saved.total_value))}). The stock will change when the owner approves.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {me?.is_owner && <ApproveButtons count={saved} onDone={() => setSaved(null)} />}
          {!me?.is_owner && (
            <Button size="lg" onClick={() => (setSaved(null), onSaved())}>
              OK
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Steps steps={["Count", "Send to owner", "Owner approves"]} current={0} />
      <p className="mb-4 text-ink-soft">
        Type what you see on the shelf. Example: 3 full crates and 5 loose bottles → type <b className="text-ink">3</b> and <b className="text-ink">5</b>. Press Enter to jump to the next box. You can count just part of the shop; anything you don't change stays as it is.
      </p>

      {error && (
        <div className="mb-4">
          <Banner tone={error.kind === "network" ? "offline" : "error"} title="Count not saved" onClose={() => setError(null)}>
            {error.message}
          </Banner>
        </div>
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Find a product" />
        <div className="flex gap-2">
          <Chip active={!onlyChanged} onClick={() => setOnlyChanged(false)}>All ({rows.length})</Chip>
          <Chip active={onlyChanged} onClick={() => setOnlyChanged(true)}>Different ({changed.length})</Chip>
        </div>
      </div>

      {stock.isLoading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState title={onlyChanged ? "Everything matches so far" : "No products"} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">System says</th>
                <th className="px-3 py-2 font-medium">Full crates</th>
                <th className="px-3 py-2 font-medium">Loose</th>
                <th className="px-4 py-2 font-medium">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map(({ r, c, diff, value }) => (
                <tr key={r.item_code} className={diff !== 0 ? "bg-warn-50/60" : ""}>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Swatch color={flavourColor(r.item_name)} />
                      {niceName(r.item_name)}
                    </div>
                    {r.bulk_uom && (
                      <div className="text-sm text-ink-soft">
                        {r.per_bulk} per {r.bulk_uom.toLowerCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{r.stock_text}</td>
                  <td className="px-3 py-2">
                    {r.bulk_uom ? (
                      <QtyInput label={`Full ${r.bulk_uom.toLowerCase()}s of ${r.item_name}`} value={c.bulk} onChange={(v) => setCounts((s) => ({ ...s, [r.item_code]: { ...c, bulk: v } }))} />
                    ) : (
                      <span className="text-sm text-ink-faint">no crates</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <QtyInput label={`Loose ${r.uom.toLowerCase()}s of ${r.item_name}`} value={c.loose} onChange={(v) => setCounts((s) => ({ ...s, [r.item_code]: { ...c, loose: v } }))} />
                  </td>
                  <td className="px-4 py-2">
                    <Difference diff={diff} value={value} uom={r.uom} onReset={() => setCounts((s) => ({ ...s, [r.item_code]: systemSplit(r) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="sticky bottom-20 mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white px-4 py-3 md:bottom-4">
        <div className="flex-1">
          {changed.length === 0 ? (
            <span className="text-ink-soft">Everything matches the system so far.</span>
          ) : (
            <span>
              <b>{changed.length}</b> {changed.length === 1 ? "product is" : "products are"} different ·{" "}
              <span className={net < 0 ? "text-danger-700" : "text-warn-700"}>
                {net < 0 ? `${-net} missing` : net > 0 ? `${net} extra` : "missing and extra cancel out"} · worth {kes(Math.abs(Math.round(netValue)))}
              </span>
            </span>
          )}
        </div>
        <Button size="lg" disabled={changed.length === 0} onClick={() => setConfirming(true)}>
          Next: send to owner
        </Button>
      </div>

      <Modal open={confirming} onClose={() => !saving && setConfirming(false)} labelledBy="count-confirm" wide>
        <Steps steps={["Count", "Send to owner", "Owner approves"]} current={1} />
        <h2 id="count-confirm" className="text-lg font-semibold">
          Check and send
        </h2>
        <p className="mb-3 text-ink-soft">These products are different from the system:</p>
        <ul className="mb-5 max-h-60 divide-y divide-line overflow-y-auto rounded-md border border-line">
          {changed.map(({ r, counted, diff, value }) => (
            <li key={r.item_code} className="flex flex-wrap justify-between gap-2 px-3 py-2">
              <span className="font-medium">{niceName(r.item_name)}</span>
              <span>
                {r.stock_text} → <b>{describeQty(counted, r.uom, r.bulk_uom, r.per_bulk)}</b>{" "}
                <span className={diff < 0 ? "text-danger-700" : "text-warn-700"}>
                  ({diff > 0 ? "+" : ""}
                  {diff}, {kes(Math.round(value))})
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mb-1 font-medium">Why is it different?</div>
        <div className="mb-3 flex flex-wrap gap-2">
          {COUNT_REASONS.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={reason === x}
              onClick={() => setReason(x)}
              className={cx("h-10 rounded-md border px-3 text-sm font-medium", reason === x ? "border-ink bg-ink text-white" : "border-line text-ink hover:bg-canvas")}
            >
              {x}
            </button>
          ))}
        </div>
        <textarea
          aria-label="Notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={reason === "Other" ? "Explain what happened (required)" : "Notes (optional), e.g. 2 bottles broke when the crate fell"}
          className="mb-5 w-full rounded-md border border-line p-3 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
        {error && (
          <div className="mb-4">
            <Banner tone="error" title="Count not saved">
              {error.message}
            </Banner>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => setConfirming(false)} disabled={saving}>
            Back to counting
          </Button>
          <Button size="lg" className="flex-1" loading={saving} disabled={!reason || needNote} onClick={save}>
            {reason ? "Send to owner" : "Choose a reason first"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function systemSplit(r: StockLevel): Counted {
  const qty = Math.max(0, r.qty);
  if (!r.bulk_uom) return { bulk: 0, loose: qty };
  const s = splitUnits(qty, r.per_bulk);
  return { bulk: s.bulk, loose: s.loose };
}

function Difference({ diff, value, uom, onReset }: { diff: number; value: number; uom: string; onReset: () => void }) {
  if (diff === 0) return <span className="text-ink-soft">Matches</span>;
  const n = Math.abs(diff);
  const unit = n === 1 ? uom.toLowerCase() : `${uom.toLowerCase()}s`;
  return (
    <span className="flex flex-col">
      <span className={cx("font-medium", diff < 0 ? "text-danger-700" : "text-warn-700")}>
        {diff < 0 ? `${n} ${unit} missing` : `${n} ${unit} extra`} · {kes(Math.round(Math.abs(value)))}
      </span>
      <button onClick={onReset} className="self-start text-sm text-ink-soft underline-offset-2 hover:underline">
        Undo
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Waiting / history
// ---------------------------------------------------------------------------

const STATUS_TONE = { Pending: "warn", Approved: "ok", Rejected: "muted" } as const;
const STATUS_LABEL = { Pending: "Waiting for approval", Approved: "Approved", Rejected: "Rejected" } as const;

function CountList({ status }: { status?: "Pending" }) {
  const counts = useCounts(status);
  const [open, setOpen] = useState<string | null>(null);
  const rows = counts.data ?? [];

  if (counts.isLoading) return <Spinner />;
  if (counts.error)
    return (
      <Banner tone="error" title="Can't load counts">
        {counts.error.message}
      </Banner>
    );
  if (!rows.length)
    return (
      <Card>
        <EmptyState title={status ? "Nothing is waiting for approval" : "No counts yet"}>{status ? "Counts sent to the owner appear here." : ""}</EmptyState>
      </Card>
    );

  return (
    <Card>
      <ul className="divide-y divide-line">
        {rows.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center gap-4 px-4 py-3">
            <div className="min-w-[240px] flex-1">
              <div className="font-medium">
                {c.reason} · {c.items_changed} {c.items_changed === 1 ? "product" : "products"}
              </div>
              <div className="text-sm text-ink-soft">
                {c.counted_by}, {shiftDay(c.counted_at)} {shiftTime(c.counted_at)}
                {c.reviewed_by && ` · ${c.status === "Approved" ? "approved" : "rejected"} by ${c.reviewed_by}`}
              </div>
            </div>
            <Status tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Status>
            <div className={cx("tabular w-36 text-right font-medium", c.total_value < 0 ? "text-danger-700" : "text-warn-700")}>
              {c.total_difference > 0 ? "+" : ""}
              {c.total_difference} · {kes(Math.round(c.total_value))}
            </div>
            <Button variant={c.status === "Pending" ? "primary" : "secondary"} onClick={() => setOpen(c.name)}>
              {c.status === "Pending" ? "Review" : "View"}
            </Button>
          </li>
        ))}
      </ul>
      {open && <CountDetail name={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function CountDetail({ name, onClose }: { name: string; onClose: () => void }) {
  const { me } = useAuth();
  const detail = useQuery({ queryKey: ["count", name], queryFn: () => api.getCount(name) });
  const c = detail.data;
  return (
    <Modal open onClose={onClose} labelledBy="count-detail" wide>
      {!c ? (
        <Spinner />
      ) : (
        <>
          <h2 id="count-detail" className="text-lg font-semibold">
            {c.reason}
          </h2>
          <p className="mb-1 text-ink-soft">
            Counted by {c.counted_by}, {shiftDay(c.counted_at)} {shiftTime(c.counted_at)}
          </p>
          <div className="mb-4">
            <Status tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Status>
          </div>
          {c.notes && <p className="mb-4 border-l-2 border-line pl-3 text-ink-soft">“{c.notes}”</p>}
          <table className="mb-4 w-full text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium">System said</th>
                <th className="py-2 font-medium">Counted</th>
                <th className="py-2 text-right font-medium">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.rows?.map((r) => (
                <tr key={r.item_code}>
                  <td className="py-2 font-medium">{niceName(r.item_name)}</td>
                  <td className="py-2 text-ink-soft">{r.system_text}</td>
                  <td className="py-2">{r.counted_text}</td>
                  <td className={cx("tabular py-2 text-right font-medium", r.difference < 0 ? "text-danger-700" : "text-warn-700")}>
                    {r.difference > 0 ? "+" : ""}
                    {r.difference} · {kes(Math.round(r.value))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {c.status !== "Pending" && c.review_note && <p className="mb-4 text-ink-soft">Owner's note: {c.review_note}</p>}
          {c.status === "Pending" && me?.is_owner ? (
            <ApproveButtons count={c} onDone={onClose} />
          ) : c.status === "Pending" ? (
            <Banner tone="info" title="Waiting for the owner">
              The stock will change when the owner approves this count.
            </Banner>
          ) : null}
        </>
      )}
    </Modal>
  );
}

function ApproveButtons({ count, onDone }: { count: StockCount; onDone: () => void }) {
  const qc = useQueryClient();
  const refresh = useRefreshAfterWrite();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function act(kind: "approve" | "reject") {
    setBusy(kind);
    setError(null);
    try {
      const res = kind === "approve" ? await api.approveCount(count.name, note.trim() || undefined) : await api.rejectCount(count.name, note.trim() || undefined);
      refresh();
      void qc.invalidateQueries({ queryKey: ["count", count.name] });
      toast(res.message);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Not saved.", "server"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full border-t border-line pt-4">
      <p className="mb-3 text-ink-soft">Approve to change the stock to what was counted. Sales made since the count are taken into account automatically.</p>
      <input
        aria-label="Note to the cashier"
        placeholder="Note to the cashier (optional)"
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
        <Button variant="secondary" size="lg" loading={busy === "reject"} disabled={!!busy} onClick={() => act("reject")}>
          Reject
        </Button>
        <Button size="lg" className="flex-1" loading={busy === "approve"} disabled={!!busy} onClick={() => act("approve")}>
          Approve and update stock
        </Button>
      </div>
    </div>
  );
}
