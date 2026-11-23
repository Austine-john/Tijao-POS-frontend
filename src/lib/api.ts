// Thin, typed client for the Tijao POS backend (Frappe whitelisted methods).
//
// - Uses the Frappe session cookie (same origin: served at /pos, or via the Vite proxy in dev).
// - Sends X-Frappe-CSRF-Token on every POST.
// - Turns every failure into an ApiError with a short, human message and a `kind`
//   the UI can act on (show login, show "no connection", ...). Never shows tracebacks.

import type {
  CountActionResult,
  CountLine,
  CountReason,
  CountStatus,
  PayoutReason,
  Shift,
  StockCount,
  ImportResult,
  Me,
  PaymentMode,
  Period,
  Product,
  ReceiveLine,
  ReceiveResult,
  RecentSale,
  Sale,
  StockLevel,
  Summary,
} from "./types";

export type ApiErrorKind = "network" | "auth" | "forbidden" | "notfound" | "server";

export class ApiError extends Error {
  constructor(
    message: string,
    public kind: ApiErrorKind,
    public status: number = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const NO_CONNECTION = "No connection to the shop system. Nothing was saved.";
const GENERIC = "Something went wrong and nothing was saved. Please try again.";

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    csrf_token?: string;
  }
}

let csrfToken: string | null = initialCsrf();

function initialCsrf(): string | null {
  const t = typeof window !== "undefined" ? window.csrf_token : undefined;
  // In Vite dev the Jinja placeholder is never rendered.
  return t && !t.includes("{{") ? t : null;
}

export function setCsrfToken(token: string | null | undefined) {
  csrfToken = token || null;
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

type Params = Record<string, unknown>;

async function call<T>(method: "GET" | "POST", path: string, params: Params = {}): Promise<T> {
  let url = `/api/method/${path}`;
  const init: RequestInit = {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  };

  if (method === "GET") {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) qs.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  } else {
    init.headers = {
      ...init.headers,
      "Content-Type": "application/json",
      ...(csrfToken ? { "X-Frappe-CSRF-Token": csrfToken } : {}),
    };
    init.body = JSON.stringify(params);
  }

  return handle<T>(() => fetch(url, init));
}

async function handle<T>(doFetch: () => Promise<Response>): Promise<T> {
  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new ApiError(NO_CONNECTION, "network");
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON (proxy error page, server down behind nginx, ...)
    if (res.status >= 502 && res.status <= 504) throw new ApiError(NO_CONNECTION, "network", res.status);
  }

  // Frappe wraps return values as {"message": ...}; a None return comes back as {} (no key).
  if (res.ok) return (body && typeof body === "object" && "message" in body ? body.message : null) as T;
  throw toApiError(res.status, body);
}

export function toApiError(status: number, body: any): ApiError {
  const message = extractMessage(body);
  const excType: string = body?.exc_type ?? "";

  if (status === 401 || excType === "AuthenticationError" || excType === "SessionExpired") {
    return new ApiError(message && !/^Not permitted$/i.test(message) ? message : "Please log in.", "auth", status);
  }
  if (status === 403) {
    // Frappe answers 403 "...Login to access" for a guest/expired session.
    if (/login to access|not whitelisted|session/i.test(message)) {
      return new ApiError("Please log in again.", "auth", status);
    }
    return new ApiError(message || "You are not allowed to do this. Ask the owner.", "forbidden", status);
  }
  if (status === 404) return new ApiError(message || "Not found.", "notfound", status);
  if (status >= 502 && status <= 504) return new ApiError(NO_CONNECTION, "network", status);
  if (status >= 500) return new ApiError(GENERIC, "server", status);
  return new ApiError(message || GENERIC, "server", status);
}

/** Pull the human message out of a Frappe error body. */
export function extractMessage(body: any): string {
  if (!body) return "";
  const raw = body._server_messages;
  if (typeof raw === "string") {
    try {
      const list: unknown[] = JSON.parse(raw);
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        const msg = typeof item === "string" ? safeJson(item)?.message ?? item : (item as any)?.message;
        if (msg) return clean(String(msg));
      }
    } catch {
      /* fall through */
    }
  }
  if (typeof body.message === "string") return clean(body.message);
  return "";
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function clean(s: string): string {
  // Guest 403s wrap the text in <details><summary>; keep the summary text.
  const summary = /<summary>(.*?)<\/summary>/i.exec(s);
  const text = (summary ? summary[1] : s).replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  return text.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function login(usr: string, pwd: string): Promise<void> {
  try {
    await call<unknown>("POST", "login", { usr, pwd });
  } catch (e) {
    if (e instanceof ApiError && (e.kind === "auth" || e.status === 401 || e.status === 417)) {
      throw new ApiError("Wrong username or password. Try again.", "auth", e.status);
    }
    throw e;
  }
}

export async function logout(): Promise<void> {
  try {
    await call<unknown>("POST", "logout");
  } finally {
    setCsrfToken(null);
  }
}

// ---------------------------------------------------------------------------
// Endpoints (tijao_pos.api.<module>.<fn>)
// ---------------------------------------------------------------------------

const M = "tijao_pos.api";

export const api = {
  me: async () => {
    const me = await call<Me>("GET", `${M}.auth.me`);
    setCsrfToken(me.csrf_token);
    return me;
  },

  products: () => call<Product[]>("GET", `${M}.catalog.get_products`),

  makeSale: (args: {
    items: { item_code: string; qty: number }[];
    payment_mode: PaymentMode;
    client_ref: string;
    mpesa_ref?: string;
  }) => call<Sale>("POST", `${M}.sales.make_sale`, args),

  recentSales: (limit = 50) => call<RecentSale[]>("GET", `${M}.sales.recent_sales`, { limit }),
  getSale: (invoice: string) => call<Sale>("GET", `${M}.sales.get_sale`, { invoice }),
  voidSale: (invoice: string) => call<Sale>("POST", `${M}.sales.void_sale`, { invoice }),

  stockLevels: () => call<StockLevel[]>("GET", `${M}.stock.get_stock_levels`),
  buyingPrices: () => call<Record<string, number>>("GET", `${M}.stock.get_buying_prices`),
  receiveStock: (items: ReceiveLine[], supplier?: string) =>
    call<ReceiveResult>("POST", `${M}.stock.receive_stock`, { items, supplier }),

  // Stock counts: anyone saves, the owner approves or rejects.
  saveCount: (counts: CountLine[], reason: CountReason, notes?: string) =>
    call<CountActionResult>("POST", `${M}.stock.save_stock_count`, { counts, reason, notes }),
  listCounts: (status?: CountStatus) => call<StockCount[]>("GET", `${M}.stock.list_stock_counts`, { status, limit: 50 }),
  getCount: (name: string) => call<StockCount>("GET", `${M}.stock.get_stock_count`, { name }),
  approveCount: (name: string, note?: string) => call<CountActionResult>("POST", `${M}.stock.approve_stock_count`, { name, note }),
  rejectCount: (name: string, note?: string) => call<CountActionResult>("POST", `${M}.stock.reject_stock_count`, { name, note }),

  // Shifts (one cash drawer -> one open shift).
  currentShift: () => call<Shift | null>("GET", `${M}.shift.current`),
  openShift: (opening_float: number) => call<Shift>("POST", `${M}.shift.open_shift`, { opening_float }),
  addPayout: (amount: number, reason: PayoutReason, note?: string) => call<Shift>("POST", `${M}.shift.add_payout`, { amount, reason, note }),
  closeShift: (counted_cash: number, notes?: string) => call<Shift>("POST", `${M}.shift.close_shift`, { counted_cash, notes }),
  listShifts: () => call<Shift[]>("GET", `${M}.shift.list_shifts`, { limit: 60 }),
  getShift: (name: string) => call<Shift>("GET", `${M}.shift.get_shift`, { name }),
  reviewShift: (name: string, note?: string) => call<Shift>("POST", `${M}.shift.review_shift`, { name, note }),

  summary: (period: Period) => call<Summary>("GET", `${M}.dashboard.get_summary`, { period }),

  importMasterData: (file_url: string, dry_run: boolean) =>
    call<ImportResult>("POST", `${M}.catalog.import_master_data`, { file_url, dry_run: dry_run ? 1 : 0 }),

  /** Upload via Frappe's standard endpoint (private file). Returns the file_url. */
  uploadFile: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("is_private", "1");
    form.append("folder", "Home");
    const res = await handle<{ file_url: string }>(() =>
      fetch("/api/method/upload_file", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", ...(csrfToken ? { "X-Frappe-CSRF-Token": csrfToken } : {}) },
        body: form,
      }),
    );
    return res.file_url;
  },
};
