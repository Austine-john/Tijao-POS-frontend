// Cart maths and state. Pure (no React) so it is unit tested directly.

export interface CartLine {
  item_code: string;
  item_name: string;
  price: number;
  qty: number;
  /** Stock left when added; the cart never goes above it. */
  max: number;
}

export interface CartState {
  lines: CartLine[];
  /** Idempotency key for the next make_sale. Reset whenever the cart changes. */
  clientRef: string | null;
  /** Short message when something was capped, e.g. "Only 3 Fanta left". */
  notice: string | null;
}

export type CartAction =
  | { type: "add"; item: { item_code: string; item_name: string; price: number; in_stock: number } }
  | { type: "inc"; item_code: string }
  | { type: "dec"; item_code: string }
  | { type: "set"; item_code: string; qty: number }
  | { type: "remove"; item_code: string }
  | { type: "refreshStock"; stock: Record<string, number> }
  | { type: "clear" }
  | { type: "ensureRef"; ref: string }
  | { type: "dismissNotice" };

export const emptyCart: CartState = { lines: [], clientRef: null, notice: null };

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const { item } = action;
      if (item.in_stock <= 0) return { ...state, notice: `${item.item_name} is out of stock.` };
      const existing = state.lines.find((l) => l.item_code === item.item_code);
      if (existing) return bump(state, item.item_code, +1, item.in_stock);
      return changed(state, [
        ...state.lines,
        { item_code: item.item_code, item_name: item.item_name, price: item.price, qty: 1, max: item.in_stock },
      ]);
    }
    case "inc":
      return bump(state, action.item_code, +1);
    case "dec":
      return bump(state, action.item_code, -1);
    case "set": {
      const line = state.lines.find((l) => l.item_code === action.item_code);
      if (!line) return state;
      const wanted = Math.max(0, Math.floor(action.qty));
      return bump(state, action.item_code, wanted - line.qty);
    }
    case "remove":
      return changed(
        state,
        state.lines.filter((l) => l.item_code !== action.item_code),
      );
    case "refreshStock": {
      // Fresh stock from the server: lower caps (and quantities) if stock dropped meanwhile.
      let notice: string | null = state.notice;
      let touched = false;
      const lines = state.lines.map((l) => {
        const max = action.stock[l.item_code];
        if (max === undefined || max === l.max) return l;
        touched = true;
        if (l.qty > max) {
          notice = max > 0 ? `Only ${max} ${l.item_name} left. Cart updated.` : `${l.item_name} just ran out.`;
          return { ...l, max, qty: Math.max(max, 0) };
        }
        return { ...l, max };
      });
      if (!touched) return state;
      const kept = lines.filter((l) => l.qty > 0);
      const qtyChanged = kept.length !== state.lines.length || kept.some((l, i) => l.qty !== state.lines[i]?.qty);
      return { lines: kept, clientRef: qtyChanged ? null : state.clientRef, notice };
    }
    case "clear":
      return emptyCart;
    case "ensureRef":
      return state.clientRef ? state : { ...state, clientRef: action.ref };
    case "dismissNotice":
      return { ...state, notice: null };
  }
}

function bump(state: CartState, code: string, delta: number, newMax?: number): CartState {
  let notice: string | null = null;
  const lines = state.lines
    .map((l) => {
      if (l.item_code !== code) return l;
      const max = newMax ?? l.max;
      let qty = l.qty + delta;
      if (qty > max) {
        qty = max;
        notice = `Only ${max} ${l.item_name} left.`;
      }
      return { ...l, qty, max };
    })
    .filter((l) => l.qty > 0);
  const same = lines.length === state.lines.length && lines.every((l, i) => l.qty === state.lines[i].qty);
  if (same) return { ...state, notice };
  return { lines, clientRef: null, notice };
}

function changed(_state: CartState, lines: CartLine[]): CartState {
  return { lines, clientRef: null, notice: null };
}

export function cartTotal(lines: CartLine[]): number {
  return round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Change to give back, or null if the customer gave too little. */
export function changeDue(total: number, given: number): number | null {
  if (!Number.isFinite(given) || given < total) return null;
  return round2(given - total);
}

const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

/** 150 -> [{value:100,count:1},{value:50,count:1}] (Kenyan notes and coins). */
export function changeBreakdown(amount: number): { value: number; count: number }[] {
  let left = Math.round(amount);
  const out: { value: number; count: number }[] = [];
  for (const value of DENOMINATIONS) {
    const count = Math.floor(left / value);
    if (count > 0) {
      out.push({ value, count });
      left -= count * value;
    }
  }
  return out;
}

/** Likely amounts a customer hands over: exact, then round notes above the total. */
export function quickAmounts(total: number): number[] {
  if (total <= 0) return [];
  const out = new Set<number>([total]);
  for (const step of [50, 100, 500, 1000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
