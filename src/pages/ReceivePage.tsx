import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useBuyingPrices, useProducts, useRefreshAfterWrite } from "@/hooks/queries";
import { ApiError, api } from "@/lib/api";
import { describeQty, kes, niceName, toSaleUnits } from "@/lib/format";
import type { Product, ReceiveResult } from "@/lib/types";
import { Banner, Button, Card, EmptyState, PageHeader, QtyInput, SearchBox, Spinner, Steps } from "@/components/ui";

interface Row {
  item_code: string;
  bulk: number;
  loose: number;
  /** Cost per crate/carton (or per bottle if no bulk unit). "" = use the saved buying price. */
  cost: string;
}

const STEPS = ["Enter what arrived", "Check and save"];

export default function ReceivePage() {
  const products = useProducts();
  const prices = useBuyingPrices();
  const refresh = useRefreshAfterWrite();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<Row[]>([]);
  const [step, setStep] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<ReceiveResult | null>(null);

  const byCode = useMemo(() => Object.fromEntries((products.data ?? []).map((p) => [p.item_code, p])), [products.data]);

  // Coming from Stock -> "Add delivery" for one product.
  useEffect(() => {
    const code = params.get("item");
    if (code && byCode[code]) {
      addRow(code);
      setParams({}, { replace: true });
    }
  }, [params, byCode]); // eslint-disable-line react-hooks/exhaustive-deps

  function addRow(code: string) {
    setRows((r) => (r.some((x) => x.item_code === code) ? r : [...r, { item_code: code, bulk: 0, loose: 0, cost: "" }]));
  }
  const update = (code: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.item_code === code ? { ...x, ...patch } : x)));

  const lines = rows
    .map((r) => {
      const p = byCode[r.item_code];
      if (!p) return null;
      const hasBulk = !!p.bulk_uom;
      const savedCost = prices.data?.[r.item_code] ?? null;
      const cost = r.cost.trim() === "" ? savedCost : Number(r.cost);
      const units = toSaleUnits(r.bulk, r.loose, p.per_bulk);
      const subtotal = cost != null && Number.isFinite(cost) ? (hasBulk ? r.bulk * cost + r.loose * (cost / p.per_bulk) : r.loose * cost) : null;
      return { r, p, hasBulk, cost, savedCost, units, subtotal };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const problems = lines.flatMap((l) => {
    const out: string[] = [];
    if (l.units <= 0) out.push(`Type how many ${niceName(l.p.item_name)} came.`);
    if (l.cost == null || !Number.isFinite(l.cost) || l.cost <= 0) out.push(`Type the cost of ${niceName(l.p.item_name)}.`);
    return out;
  });
  const totalCost = lines.reduce((s, l) => s + (l.subtotal ?? 0), 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await api.receiveStock(
        lines.map((l) => ({
          item_code: l.p.item_code,
          bulk_qty: l.hasBulk ? l.r.bulk : 0,
          loose_qty: l.r.loose,
          ...(l.r.cost.trim() !== "" ? { bulk_rate: Number(l.r.cost) } : {}),
        })),
      );
      setResult(res);
      setRows([]);
      setStep(0);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("Something went wrong. Nothing was saved.", "server"));
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <Card className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-semibold">✓ Delivery saved</h1>
        <p className="mt-1 text-ink-soft">
          The stock is updated. Total cost {kes(result.total)} (ref {result.receipt}).
        </p>
        <ul className="my-4 divide-y divide-line rounded-md border border-line">
          {result.stock.map((s) => (
            <li key={s.item_code} className="flex justify-between gap-3 px-3 py-2">
              <span>{niceName(s.item_name)}</span>
              <span className="text-ink-soft">now {s.stock_text}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Button size="lg" onClick={() => setResult(null)}>
            Record another delivery
          </Button>
          <Link to="/stock" className="inline-flex h-12 items-center rounded-md border border-line px-5 font-medium hover:bg-canvas">
            Go to stock
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Delivery" subtitle="Record what the distributor brought. The stock goes up when you save." />
      <Steps steps={STEPS} current={step} />

      {error && (
        <div className="mb-4">
          <Banner tone={error.kind === "network" ? "offline" : "error"} title="Delivery not saved" onClose={() => setError(null)}>
            {error.message}
          </Banner>
        </div>
      )}

      {products.isLoading ? (
        <Spinner />
      ) : step === 0 ? (
        <>
          <ProductPicker products={products.data ?? []} exclude={rows.map((r) => r.item_code)} onPick={addRow} />

          {lines.length === 0 ? (
            <Card>
              <EmptyState title="No products added yet">Search above and choose each product that came on the delivery.</EmptyState>
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-line text-sm text-ink-soft">
                    <th className="px-4 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Full crates</th>
                    <th className="px-3 py-2 font-medium">Loose</th>
                    <th className="px-3 py-2 font-medium">Cost per crate (KES)</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lines.map(({ r, p, hasBulk, savedCost, subtotal, units }) => (
                    <tr key={r.item_code}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{niceName(p.item_name)}</div>
                        <div className="text-sm text-ink-soft">
                          {hasBulk ? `${p.per_bulk} per ${p.bulk_uom!.toLowerCase()}` : `bought per ${p.uom.toLowerCase()}`} · now {p.stock_text}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {hasBulk ? (
                          <QtyInput label={`Full ${p.bulk_uom!.toLowerCase()}s of ${p.item_name}`} value={r.bulk} onChange={(v) => update(r.item_code, { bulk: v })} />
                        ) : (
                          <span className="text-sm text-ink-faint">no crates</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <QtyInput label={`Loose ${p.uom.toLowerCase()}s of ${p.item_name}`} value={r.loose} onChange={(v) => update(r.item_code, { loose: v })} />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          aria-label={`Cost per ${(p.bulk_uom ?? p.uom).toLowerCase()} of ${p.item_name}`}
                          inputMode="decimal"
                          value={r.cost}
                          placeholder={savedCost != null ? String(savedCost) : "Type cost"}
                          onChange={(e) => update(r.item_code, { cost: e.target.value.replace(/[^\d.]/g, "") })}
                          className="tabular h-10 w-32 rounded-md border border-line px-3 text-right font-medium outline-none placeholder:font-normal placeholder:text-ink-faint focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                        />
                        {!hasBulk && <div className="text-xs text-ink-soft">per {p.uom.toLowerCase()}</div>}
                      </td>
                      <td className="tabular px-3 py-2 text-right">
                        {subtotal != null ? kes(Math.round(subtotal * 100) / 100) : "—"}
                        <div className="text-xs text-ink-soft">{units ? describeQty(units, p.uom, p.bulk_uom, p.per_bulk) : ""}</div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => setRows((rs) => rs.filter((x) => x.item_code !== r.item_code))} className="text-sm text-ink-soft hover:text-danger-700">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <p className="mt-2 text-sm text-ink-soft">The cost box shows the usual price in grey. Leave it as it is if the price has not changed.</p>

          <div className="sticky bottom-20 mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white px-4 py-3 md:bottom-4">
            <div className="flex-1">
              {lines.length > 0 && problems.length > 0 ? (
                <span className="text-warn-700">{problems[0]}</span>
              ) : (
                <span>
                  Total cost <b className="tabular">{kes(Math.round(totalCost))}</b>
                </span>
              )}
            </div>
            <Button size="lg" disabled={!lines.length || problems.length > 0} onClick={() => setStep(1)}>
              Next: check delivery
            </Button>
          </div>
        </>
      ) : (
        <Card className="max-w-3xl p-5">
          <h2 className="text-lg font-semibold">Check before saving</h2>
          <p className="mb-4 text-ink-soft">Compare with what came off the truck. Saving adds it to the stock straight away.</p>
          <table className="mb-4 w-full text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th className="py-2 font-medium">Product</th>
                <th className="py-2 font-medium">Quantity</th>
                <th className="py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l) => (
                <tr key={l.p.item_code}>
                  <td className="py-2">{niceName(l.p.item_name)}</td>
                  <td className="py-2">{describeQty(l.units, l.p.uom, l.p.bulk_uom, l.p.per_bulk)}</td>
                  <td className="tabular py-2 text-right">{l.subtotal != null ? kes(Math.round(l.subtotal * 100) / 100) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-3 font-semibold">
                  Total
                </td>
                <td className="tabular pt-3 text-right text-xl font-semibold">{kes(Math.round(totalCost))}</td>
              </tr>
            </tfoot>
          </table>
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={() => setStep(0)} disabled={saving}>
              Back to edit
            </Button>
            <Button size="lg" className="flex-1" loading={saving} onClick={save}>
              Save delivery and update stock
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ProductPicker({ products, exclude, onPick }: { products: Product[]; exclude: string[]; onPick: (code: string) => void }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return products.filter((p) => !exclude.includes(p.item_code) && p.item_name.toLowerCase().includes(s)).slice(0, 8);
  }, [q, products, exclude]);
  return (
    <div className="mb-4">
      <SearchBox value={q} onChange={setQ} placeholder="Type a product name to add it to this delivery" />
      {matches.length > 0 && (
        <ul className="mt-1 divide-y divide-line rounded-md border border-line bg-white">
          {matches.map((p) => (
            <li key={p.item_code}>
              <button
                onClick={() => {
                  onPick(p.item_code);
                  setQ("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-canvas"
              >
                <span>{niceName(p.item_name)}</span>
                <span className="text-sm text-ink-soft">now {p.stock_text} · Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && matches.length === 0 && <p className="mt-2 text-ink-soft">No product matches “{q}”.</p>}
    </div>
  );
}
