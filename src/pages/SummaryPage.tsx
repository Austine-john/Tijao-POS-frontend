import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useSummary } from "@/hooks/queries";
import { kes, niceName, shortDate } from "@/lib/format";
import type { Period, Summary } from "@/lib/types";
import { Banner, Button, Card, EmptyState, PageHeader, Segmented, Spinner, Stat, cx } from "@/components/ui";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export default function SummaryPage() {
  const [period, setPeriod] = useState<Period>("today");
  const q = useSummary(period);
  const s = q.data;

  return (
    <div>
      <PageHeader
        title="Summary"
        subtitle={s ? `${shortDate(s.from_date)}${s.from_date !== s.to_date ? ` – ${shortDate(s.to_date)}` : ""}` : undefined}
        actions={
          <Segmented label="Period" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        }
      />

      {q.error && (
        <div className="mb-4">
          <Banner tone="error" title="Can't load the summary" action={<Button onClick={() => q.refetch()}>Try again</Button>}>
            {q.error.message}
          </Banner>
        </div>
      )}

      {!s ? (
        q.isLoading && <Spinner />
      ) : (
        <div className={cx("transition-opacity", q.isFetching && "opacity-60")}>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total sales" value={kes(s.net_sales)} note={`${s.sales_count} ${s.sales_count === 1 ? "sale" : "sales"}`} />
            <Stat label="Cash" value={kes(s.payments.cash)} note="Should be in the drawer" />
            <Stat label="M-Pesa" value={kes(s.payments.mpesa)} note="Check against the till" />
            <Stat
              label="Profit"
              value={kes(Math.round(s.gross_profit))}
              note={s.net_sales ? `${s.margin_pct}% of sales · cost ${kes(Math.round(s.cogs))}` : "No sales yet"}
            />
          </div>

          {s.voided_count > 0 && (
            <div className="mb-5">
              <Banner tone="warning" title={`${s.voided_count} voided ${s.voided_count === 1 ? "sale" : "sales"} in this period`}>
                Voided sales are not counted in the numbers above.
              </Banner>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <DailyChart s={s} />
            <TopSellers s={s} />
          </div>
        </div>
      )}
    </div>
  );
}

// Single series -> one hue, no legend (the title names it). Grid and axes stay quiet.
const BAR = "#3a70ee"; // brand-500
const BAR_TODAY = "#1c3c94"; // brand-800, same hue, emphasises today
const GRID = "#e8edf4";
const AXIS = "#556275";

function DailyChart({ s }: { s: Summary }) {
  const [asTable, setAsTable] = useState(false);
  const data = s.daily.map((d) => ({ ...d, label: shortDate(d.date) }));
  const last = data.length - 1;
  const avg = data.length ? s.net_sales / data.length : 0;

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Sales per day</h2>
          <p className="text-ink-soft">Daily average {kes(Math.round(avg))}</p>
        </div>
        <button onClick={() => setAsTable((t) => !t)} className="rounded-lg px-3 py-1.5 font-semibold text-brand-800 hover:bg-canvas">
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      {s.sales_count === 0 ? (
        <EmptyState title="No sales in this period yet" />
      ) : asTable ? (
        <table className="w-full text-left text-lg">
          <thead>
            <tr className="border-b border-line text-sm text-ink-soft">
              <th className="py-2">Day</th>
              <th className="py-2 text-right">Sales</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-b border-line">
                <td className="py-2">{d.label}</td>
                <td className="tabular py-2 text-right">{d.sales_count}</td>
                <td className="tabular py-2 text-right font-semibold">{kes(d.net_sales)}</td>
                <td className="tabular py-2 text-right">{kes(Math.round(d.profit))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="h-72" role="img" aria-label={`Bar chart of sales per day, ${data.length} days`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 13 }} interval="preserveStartEnd" minTickGap={8} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 13 }} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<DayTooltip />} />
              <Bar
                dataKey="net_sales"
                radius={[4, 4, 0, 0]}
                maxBarSize={56}
                shape={(props: any) => <rect x={props.x} y={props.y} width={props.width} height={props.height} rx={4} fill={props.index === last ? BAR_TODAY : BAR} />}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function DayTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Summary["daily"][number] & { label: string };
  return (
    <div className="rounded-md border border-line bg-white px-4 py-3">
      <div className="mb-1 font-semibold text-ink">{d.label}</div>
      <div className="tabular text-lg font-semibold text-ink">{kes(d.net_sales)}</div>
      <div className="text-ink-soft">
        {d.sales_count} {d.sales_count === 1 ? "sale" : "sales"} · profit {kes(Math.round(d.profit))}
      </div>
    </div>
  );
}

function TopSellers({ s }: { s: Summary }) {
  return (
    <Card className="p-5">
      <h2 className="mb-1 text-xl font-semibold">Best sellers</h2>
      <p className="mb-4 text-ink-soft">By money taken</p>
      {s.top_items.length === 0 ? (
        <EmptyState title="Nothing sold yet" />
      ) : (
        <ol className="space-y-2">
          {s.top_items.map((t, i) => (
            <li key={t.item_code} className="flex items-center gap-4 rounded-lg bg-canvas p-3">
              <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold", i === 0 ? "bg-brand-800 text-white" : "bg-white text-ink")}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{niceName(t.item_name)}</div>
                <div className="text-sm text-ink-soft">
                  {t.qty} sold · profit {kes(Math.round(t.profit))}
                </div>
              </div>
              <div className="tabular text-lg font-semibold text-brand-800">{kes(t.net_sales)}</div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
