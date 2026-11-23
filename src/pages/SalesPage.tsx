import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRecentSales, useRefreshAfterWrite } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, api } from "@/lib/api";
import { kes, shortDate, shortTime, todayIso } from "@/lib/format";
import type { RecentSale } from "@/lib/types";
import { PrintReceipt, Receipt, usePaperWidth } from "@/components/Receipt";
import { useToast } from "@/components/Toast";
import { Badge, Banner, Button, Card, EmptyState, Modal, PageHeader, SearchBox, Spinner, cx } from "@/components/ui";

export default function SalesPage() {
  const { me } = useAuth();
  const owner = !!me?.is_owner;
  const sales = useRecentSales();
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<RecentSale | null>(null);

  const rows = sales.data ?? [];
  const today = todayIso();
  const todays = rows.filter((r) => r.posting_date === today && r.status === "paid");
  const todayTotal = todays.reduce((s, r) => s + r.total, 0);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => !q || r.invoice.toLowerCase().includes(q) || (r.mpesa_ref ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <div>
      <PageHeader
        title="Recent sales"
        subtitle="The last 50 sales. Open a receipt to print it again."
        actions={
          <Button variant="secondary" onClick={() => sales.refetch()} loading={sales.isFetching}>
            Refresh
          </Button>
        }
      />

      <div className={cx("mb-5 grid gap-4", owner && "sm:grid-cols-2")}>
        <Card className="p-5">
          <div className="text-sm text-ink-soft">Sales today</div>
          <div className="tabular text-3xl font-semibold text-brand-800">{todays.length}</div>
        </Card>
        {/* Owner only: a cashier seeing today's money total would defeat the blind shift close. */}
        {owner && (
          <Card className="p-5">
            <div className="text-sm text-ink-soft">Money in today</div>
            <div className="tabular text-3xl font-semibold text-brand-800">{kes(todayTotal)}</div>
          </Card>
        )}
      </div>

      {sales.error && (
        <div className="mb-4">
          <Banner tone="error" title="Can't load sales" action={<Button onClick={() => sales.refetch()}>Try again</Button>}>
            {sales.error.message}
          </Banner>
        </div>
      )}

      <Card className="p-4">
        <div className="mb-4">
          <SearchBox value={search} onChange={setSearch} placeholder="Search by receipt number or M-Pesa code…" />
        </div>
        {sales.isLoading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <EmptyState title={rows.length ? "No sale matches" : "No sales yet"}>
            {rows.length ? "Try another number." : "Sales appear here as soon as they are made."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line text-sm text-ink-soft">
                  <th className="px-3 py-3 font-semibold">Receipt</th>
                  <th className="px-3 py-3 font-semibold">When</th>
                  <th className="px-3 py-3 font-semibold">Items</th>
                  <th className="px-3 py-3 font-semibold">Paid by</th>
                  <th className="px-3 py-3 text-right font-semibold">Amount</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const voided = r.status === "voided";
                  return (
                    <tr key={r.invoice} className={cx("border-b border-line last:border-0", voided && "bg-gray-50 text-ink-faint")}>
                      <td className="px-3 py-4">
                        <div className={cx("font-semibold", voided && "line-through")}>{r.invoice}</div>
                        {voided && <Badge tone="red">Voided</Badge>}
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-semibold">{shortTime(r.posting_time)}</div>
                        <div className="text-sm text-ink-soft">{r.posting_date === today ? "Today" : shortDate(r.posting_date)}</div>
                      </td>
                      <td className="px-3 py-4">{r.items_count}</td>
                      <td className="px-3 py-4">
                        <Badge tone={r.payment_mode === "mpesa" ? "green" : "grey"}>{r.payment_mode === "mpesa" ? "M-Pesa" : "Cash"}</Badge>
                        {r.mpesa_ref && <div className="mt-1 font-mono text-sm">{r.mpesa_ref}</div>}
                      </td>
                      <td className={cx("tabular px-3 py-4 text-right text-lg font-semibold", voided && "line-through")}>{kes(r.total)}</td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => setViewing(r.invoice)}>
                            Receipt
                          </Button>
                          {owner && !voided && (
                            <Button variant="ghost" className="text-danger-700 hover:bg-danger-50" onClick={() => setVoiding(r)}>
                              Void
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {viewing && <ReceiptModal invoice={viewing} onClose={() => setViewing(null)} />}
      {voiding && <VoidModal sale={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
}

function ReceiptModal({ invoice, onClose }: { invoice: string; onClose: () => void }) {
  const sale = useQuery({ queryKey: ["sale", invoice], queryFn: () => api.getSale(invoice) });
  const [width] = usePaperWidth();
  const [printing, setPrinting] = useState(false);
  return (
    <Modal open onClose={onClose} labelledBy="receipt-title">
      <h2 id="receipt-title" className="mb-4 text-2xl font-semibold">
        Receipt {invoice}
      </h2>
      {sale.isLoading ? (
        <Spinner />
      ) : sale.error ? (
        <Banner tone="error" title="Can't open this receipt">
          {sale.error.message}
        </Banner>
      ) : sale.data ? (
        <>
          <div className="mx-auto mb-5 w-[300px] rounded-lg border border-line bg-white p-5">
            <Receipt sale={sale.data} />
          </div>
          {printing && <PrintReceipt sale={sale.data} width={width} onDone={() => setPrinting(false)} />}
        </>
      ) : null}
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onClose}>
          Close
        </Button>
        <Button size="lg" className="flex-1" disabled={!sale.data} onClick={() => setPrinting(true)}>
          Print ({width}mm)
        </Button>
      </div>
    </Modal>
  );
}

function VoidModal({ sale, onClose }: { sale: RecentSale; onClose: () => void }) {
  const refresh = useRefreshAfterWrite();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.voidSale(sale.invoice);
      refresh();
      toast(`Sale ${sale.invoice} voided. Stock returned to the shelf.`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Something went wrong.", "server"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={() => !busy && onClose()} labelledBy="void-title">
      <h2 id="void-title" className="text-lg font-semibold text-danger-700">
        Void sale {sale.invoice}?
      </h2>
      <p className="mb-4 text-sm text-ink-soft">Only the owner can do this.</p>
      <div className="mb-4 flex items-center justify-between rounded-lg bg-canvas p-4 text-lg">
        <b className="text-2xl">{kes(sale.total)}</b>
        <span className="text-ink-soft">
          {sale.items_count} items · {shortTime(sale.posting_time)}
        </span>
      </div>
      <p className="mb-5 text-lg">
        The bottles go back into stock and the money is taken off today's totals. <b>This cannot be undone.</b>
      </p>
      {error && (
        <div className="mb-4">
          <Banner tone="error" title="Not voided">
            {error.message}
          </Banner>
        </div>
      )}
      <div className="flex gap-3">
        <Button variant="secondary" size="xl" className="flex-1" onClick={onClose} disabled={busy}>
          Keep sale
        </Button>
        <Button variant="danger" size="xl" className="flex-1" loading={busy} onClick={confirm}>
          Void sale
        </Button>
      </div>
    </Modal>
  );
}
