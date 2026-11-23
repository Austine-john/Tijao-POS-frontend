import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { qk, useCurrentShift, useProducts, useRefreshAfterWrite } from "@/hooks/queries";
import { useHotkeys } from "@/hooks/useHotkeys";
import { ApiError } from "@/lib/api";
import { cartCount, cartReducer, cartTotal, emptyCart, type CartState } from "@/lib/cart";
import { kes, niceName, sizeMl, sizeOf } from "@/lib/format";
import { flavourColor } from "@/lib/flavour";
import { newClientRef, salesQueue } from "@/lib/salesQueue";
import { KEYS, load, save } from "@/lib/storage";
import type { PaymentMode, Product, Sale } from "@/lib/types";
import { Banner, Button, Chip, EmptyState, QtyInput, SearchBox, Spinner, cx } from "@/components/ui";
import { PaymentModal } from "./sell/PaymentModal";
import { SaleDone } from "./sell/SaleDone";
import { OpenShiftCard } from "./shift/ShiftParts";

interface Done {
  sale: Sale;
  cashGiven: number | null;
  change: number | null;
}

export default function SellPage() {
  const products = useProducts();
  const shift = useCurrentShift();
  const qc = useQueryClient();
  const refresh = useRefreshAfterWrite();

  // The cart survives a page refresh or a re-login (sessionStorage, this tab only).
  const [cart, dispatch] = useReducer(cartReducer, undefined, () => load<CartState>(KEYS.cart, emptyCart, "session"));
  useEffect(() => save(KEYS.cart, cart.lines.length ? cart : null, "session"), [cart]);

  const [search, setSearch] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [payMode, setPayMode] = useState<PaymentMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const list = products.data ?? [];

  // Keep cart limits in line with the latest stock from the server.
  useEffect(() => {
    if (!products.data) return;
    dispatch({ type: "refreshStock", stock: Object.fromEntries(products.data.map((p) => [p.item_code, p.in_stock])) });
  }, [products.data]);

  const sizes = useMemo(() => {
    const s = new Set<string>();
    list.forEach((p) => {
      const z = sizeOf(p.item_name);
      if (z) s.add(z);
    });
    return [...s].sort((a, b) => sizeMl(a) - sizeMl(b));
  }, [list]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => (!size || sizeOf(p.item_name) === size) && (!q || p.item_name.toLowerCase().includes(q) || p.item_code.toLowerCase().includes(q)));
  }, [list, search, size]);

  const inCart = useMemo(() => Object.fromEntries(cart.lines.map((l) => [l.item_code, l.qty])), [cart.lines]);
  const total = cartTotal(cart.lines);
  const bottles = cartCount(cart.lines);

  const add = (p: Product) => {
    if (p.price == null) return;
    dispatch({ type: "add", item: { item_code: p.item_code, item_name: niceName(p.item_name), price: p.price, in_stock: p.in_stock } });
  };

  const openPay = (mode: PaymentMode) => {
    if (!cart.lines.length) return;
    setSubmitError(null);
    setPayMode(mode);
  };

  async function confirm({ cashGiven, mpesaRef }: { cashGiven?: number; mpesaRef?: string }) {
    if (!payMode || submitting) return;
    // Same client_ref for every retry of this exact cart -> the server never saves it twice.
    const ref = cart.clientRef ?? newClientRef();
    if (!cart.clientRef) dispatch({ type: "ensureRef", ref });
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sale = await salesQueue.submit({
        client_ref: ref,
        items: cart.lines.map((l) => ({ item_code: l.item_code, qty: l.qty })),
        payment_mode: payMode,
        mpesa_ref: mpesaRef,
      });
      const given = payMode === "cash" ? (cashGiven ?? sale.total) : null;
      setDone({ sale, cashGiven: given, change: given != null ? Math.max(0, given - sale.total) : null });
      setPayMode(null);
      dispatch({ type: "clear" });
      refresh();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e : new ApiError("Something went wrong. Nothing was saved.", "server"));
      // The shift may have been closed on another screen.
      if (e instanceof ApiError && /no shift is open/i.test(e.message)) void shift.refetch();
      // Stock may have changed under us; refresh so the cart limits are right.
      void products.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  const next = useCallback(() => {
    setDone(null);
    setSearch("");
    setTimeout(() => searchRef.current?.focus(), 0);
  }, []);

  useHotkeys(
    {
      "/": (e) => (e.preventDefault(), searchRef.current?.focus()),
      F2: (e) => (e.preventDefault(), openPay("cash")),
      F3: (e) => (e.preventDefault(), openPay("mpesa")),
    },
    !done && !payMode && !!shift.data,
  );

  if (done) return <SaleDone sale={done.sale} cashGiven={done.cashGiven} change={done.change} onNext={next} />;

  // One cash drawer: nobody sells until a shift is open.
  if (shift.isSuccess && !shift.data) {
    return (
      <OpenShiftCard
        onOpened={(s) => {
          qc.setQueryData(qk.shift, s);
          refresh();
        }}
      />
    );
  }

  const networkFail = submitError?.kind === "network" && !payMode;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Products */}
      <section aria-label="Products" className="min-w-0">
        {networkFail && (
          <div className="mb-4">
            <Banner tone="offline" title="No connection. The last sale was NOT saved." onClose={() => setSubmitError(null)}>
              The items are still in the sale. Press Cash or M-Pesa again when the connection is back.
            </Banner>
          </div>
        )}
        {products.error && !products.data && (
          <div className="mb-4">
            <Banner tone={products.error instanceof ApiError && products.error.kind === "network" ? "offline" : "error"} title="Can't load products" action={<Button variant="secondary" onClick={() => products.refetch()}>Try again</Button>}>
              {products.error.message}
            </Banner>
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <SearchBox inputRef={searchRef} value={search} onChange={setSearch} placeholder="Search drinks" />
        </div>
        {sizes.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by size">
            <Chip active={size === null} onClick={() => setSize(null)}>
              All sizes
            </Chip>
            {sizes.map((s) => (
              <Chip key={s} active={size === s} onClick={() => setSize(size === s ? null : s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}

        {products.isLoading && !list.length ? (
          <Spinner label="Loading products…" />
        ) : visible.length === 0 ? (
          <EmptyState title={list.length ? "No drinks match your search" : "No products yet"}>
            {list.length ? "Check the spelling or choose All sizes." : "The owner can add products in Settings."}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <ProductTile key={p.item_code} p={p} inCart={inCart[p.item_code] ?? 0} onAdd={() => add(p)} />
            ))}
          </div>
        )}
      </section>

      {/* Current sale */}
      <aside aria-label="Current sale" className="lg:sticky lg:top-[76px] lg:self-start">
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-lift">
          <div className="flex items-baseline justify-between bg-brand-700 px-4 py-3 text-white">
            <h2 className="text-lg font-bold">Current sale</h2>
            {cart.lines.length > 0 && (
              <button onClick={() => dispatch({ type: "clear" })} className="text-sm text-white/80 hover:text-white hover:underline">
                Clear sale
              </button>
            )}
          </div>

          {cart.notice && (
            <div className="px-4 pt-3">
              <Banner tone="warning" title={cart.notice} onClose={() => dispatch({ type: "dismissNotice" })} />
            </div>
          )}

          {cart.lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-ink-soft">Tap a drink to add it to the sale.</p>
          ) : (
            <ul className="max-h-[46vh] divide-y divide-line overflow-y-auto">
              {cart.lines.map((l) => (
                <li key={l.item_code} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: flavourColor(l.item_name) }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium leading-tight">{l.item_name}</div>
                    <div className="text-sm text-ink-soft">
                      {kes(l.price)} each ·{" "}
                      <button onClick={() => dispatch({ type: "remove", item_code: l.item_code })} className="underline-offset-2 hover:text-danger-700 hover:underline">
                        Remove
                      </button>
                    </div>
                  </div>
                  <QtyInput label={`Quantity of ${l.item_name}`} value={l.qty} max={l.max} onChange={(v) => dispatch({ type: "set", item_code: l.item_code, qty: v })} />
                  <div className="tabular w-20 text-right font-semibold">{kes(l.price * l.qty)}</div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-line bg-brand-50 px-4 py-4">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="font-medium text-brand-800">
                Total{bottles ? ` · ${bottles} ${bottles === 1 ? "item" : "items"}` : ""}
              </span>
              <span className="tabular text-[34px] font-bold tracking-tight text-brand-900">{kes(total)}</span>
            </div>
            <p className="mb-2 text-sm text-ink-soft">{cart.lines.length ? "How is the customer paying?" : "Add drinks, then choose how the customer pays."}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="xl" disabled={!cart.lines.length} onClick={() => openPay("cash")}>
                Cash
              </Button>
              <Button variant="mpesa" size="xl" disabled={!cart.lines.length} onClick={() => openPay("mpesa")}>
                M-Pesa
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-2 hidden text-center text-xs text-ink-faint lg:block">Keyboard: / search · F2 cash · F3 M-Pesa</p>
      </aside>

      <PaymentModal mode={payMode} total={total} bottles={bottles} submitting={submitting} error={submitError} onCancel={() => setPayMode(null)} onConfirm={confirm} />
    </div>
  );
}

function ProductTile({ p, inCart, onAdd }: { p: Product; inCart: number; onAdd: () => void }) {
  const out = p.in_stock <= 0;
  const noPrice = p.price == null;
  const disabled = out || noPrice;
  const left = p.in_stock - inCart;
  const size = sizeOf(p.item_name);
  const color = flavourColor(p.item_name);
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className={cx(
        "relative flex min-h-[124px] flex-col overflow-hidden rounded-lg border bg-white p-3 pt-4 text-left shadow-card transition",
        disabled ? "cursor-not-allowed border-line opacity-50 grayscale" : "border-line hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift active:translate-y-0",
        inCart > 0 && "border-brand-600 ring-2 ring-brand-100",
      )}
      aria-label={`${p.item_name}, ${kes(p.price)}, ${out ? "out of stock" : `${p.in_stock} left`}`}
    >
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-snug text-ink">{niceName(p.item_name)}</span>
        {inCart > 0 && <span className="shrink-0 rounded-full bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">×{inCart}</span>}
      </div>
      {size && <span className="mt-1 text-xs font-medium text-ink-faint">{size}</span>}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className="tabular text-xl font-bold text-brand-900">{noPrice ? "No price" : kes(p.price)}</span>
        <span className={cx("text-sm", out ? "font-semibold text-danger-700" : p.is_low || left <= 3 ? "font-medium text-warn-700" : "text-ink-soft")}>
          {out ? "Out" : `${p.in_stock} left`}
        </span>
      </div>
    </button>
  );
}
