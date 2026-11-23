// Small per-device conveniences (cart draft, cached product list, receipt width).
// Storage can be unavailable (private mode, blocked): never let that break the app.

export function load<T>(key: string, fallback: T, store: "local" | "session" = "local"): T {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown, store: "local" | "session" = "local"): void {
  try {
    const s = store === "local" ? window.localStorage : window.sessionStorage;
    if (value === null || value === undefined) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const KEYS = {
  cart: "tijao.cart.v1",
  products: "tijao.products.v1",
  paper: "tijao.receiptWidth",
};
