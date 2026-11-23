import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStockLevels } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { kes, niceName } from "@/lib/format";
import type { StockLevel } from "@/lib/types";
import { Swatch, Banner, Button, Card, Chip, EmptyState, PageHeader, SearchBox, Spinner, Stat, Status, cx } from "@/components/ui";
import { flavourColor } from "@/lib/flavour";

type Filter = "all" | "low" | "out" | "good";

const statusOf = (s: StockLevel): Exclude<Filter, "all"> => (s.qty <= 0 ? "out" : s.is_low ? "low" : "good");

export default function StockPage() {
  const { me } = useAuth();
  const owner = !!me?.is_owner;
  const stock = useStockLevels();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = stock.data ?? [];
  const counts = useMemo(() => {
    const c = { all: rows.length, low: 0, out: 0, good: 0 };
    rows.forEach((r) => c[statusOf(r)]++);
    return c;
  }, [rows]);
  const value = useMemo(() => rows.reduce((s, r) => s + (r.stock_value || 0), 0), [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Out of stock first, then low, then the rest.
    const order = { out: 0, low: 1, good: 2 };
    return rows
      .filter((r) => (filter === "all" || statusOf(r) === filter) && (!q || r.item_name.toLowerCase().includes(q)))
      .sort((a, b) => order[statusOf(a)] - order[statusOf(b)]);
  }, [rows, search, filter]);

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle="What is in the shop right now. Empty and low items are at the top."
        actions={
          <>
            <Button variant="secondary" onClick={() => stock.refetch()} loading={stock.isFetching}>
              Refresh
            </Button>
            <Link to="/count" className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 font-medium hover:bg-canvas">
              Count stock
            </Link>
          </>
        }
      />

      {stock.error && (
        <div className="mb-4">
          <Banner tone="error" title="Can't load stock" action={<Button variant="secondary" onClick={() => stock.refetch()}>Try again</Button>}>
            {stock.error.message}
          </Banner>
        </div>
      )}

      <div className={cx("mb-5 grid gap-3", owner ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <Stat label="Out of stock" value={String(counts.out)} note="can't be sold" tone={counts.out ? "bad" : undefined} />
        <Stat label="Running low" value={String(counts.low)} note="order more soon" tone={counts.low ? "warn" : undefined} />
        {owner && <Stat label="Value of stock (at cost)" value={kes(Math.round(value))} note={`${rows.length} products`} />}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Search products" />
        <div className="flex gap-2 overflow-x-auto">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All ({counts.all})</Chip>
          <Chip active={filter === "out"} onClick={() => setFilter("out")}>Out ({counts.out})</Chip>
          <Chip active={filter === "low"} onClick={() => setFilter("low")}>Low ({counts.low})</Chip>
          <Chip active={filter === "good"} onClick={() => setFilter("good")}>OK ({counts.good})</Chip>
        </div>
      </div>

      <Card className="overflow-x-auto">
        {stock.isLoading ? (
          <Spinner label="Loading stock…" />
        ) : visible.length === 0 ? (
          <EmptyState title="Nothing to show">{rows.length ? "No products match this search or filter." : "No products yet."}</EmptyState>
        ) : (
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-line text-sm text-ink-soft">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Stock left</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {owner && <th className="px-3 py-2 text-right font-medium">Value</th>}
                {owner && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((r) => {
                const st = statusOf(r);
                return (
                  <tr key={r.item_code}>
                    <td className="px-4 py-2.5">
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
                    <td className="px-3 py-2.5">
                      {r.stock_text}
                      {r.bulk_uom && r.qty > 0 && <div className="text-sm text-ink-soft">{r.qty} in total</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Status tone={st === "out" ? "bad" : st === "low" ? "warn" : "ok"}>{st === "out" ? "Out of stock" : st === "low" ? "Low" : "OK"}</Status>
                    </td>
                    {owner && <td className="tabular px-3 py-2.5 text-right">{kes(Math.round(r.stock_value))}</td>}
                    {owner && (
                      <td className="px-4 py-2.5 text-right">
                        <Link to={`/receive?item=${encodeURIComponent(r.item_code)}`} className="whitespace-nowrap text-sm font-medium text-brand-700 hover:underline">
                          Add delivery
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
