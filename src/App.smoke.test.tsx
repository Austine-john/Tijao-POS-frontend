import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

// Logged-in smoke test: every screen must render with a realistic backend.
const ME = {
  user: "owner@x",
  full_name: "Mama Owner",
  roles: ["System Manager"],
  is_owner: true,
  is_cashier: true,
  company: "Tijao Agrovet",
  currency: "KES",
  shop_name: "Tijao Agrovet",
  receipt_footer: "Asante",
  csrf_token: "t",
};
const PRODUCT = {
  item_code: "COKE-500ML",
  item_name: "coke 500ml",
  brand: null,
  price: 60,
  in_stock: 10,
  uom: "Bottle",
  bulk_uom: "Crate",
  per_bulk: 24,
  bulk_qty: 0,
  loose_qty: 10,
  stock_text: "10 bottles",
  is_low: true,
  image: null,
};
const SHIFT = {
  name: "SHIFT-00001",
  status: "Open",
  user: "owner@x",
  cashier_name: "Mama Owner",
  opened_at: "2026-11-23 08:00:00",
  opening_float: 1000,
  is_mine: true,
  payouts: [],
  sales_count: 0,
  cash_sales: 0,
  mpesa_sales: 0,
  payouts_total: 0,
  expected_cash: 1000,
};

function mockBackend(shift: unknown) {
  const routes: Record<string, unknown> = {
    "auth.me": ME,
    "catalog.get_products": [PRODUCT],
    "shift.current": shift,
    "shift.list_shifts": [],
    "stock.list_stock_counts": [],
    "stock.get_stock_levels": [],
    "sales.recent_sales": [],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const key = Object.keys(routes).find((k) => String(url).includes(k));
      const value = key ? routes[key] : null;
      // Like Frappe: a None return is sent as {} with no "message" key.
      const body = value === null || value === undefined ? {} : { message: value };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("logged-in smoke", () => {
  it("no open shift -> Sell asks to open the till", async () => {
    mockBackend(null);
    renderAt("/");
    expect(await screen.findByRole("heading", { name: /open the till/i })).toBeInTheDocument();
    expect(screen.queryByText("Current sale")).not.toBeInTheDocument();
  });

  it("open shift -> Sell shows products", async () => {
    mockBackend(SHIFT);
    renderAt("/");
    expect(await screen.findByText("Coke 500ml")).toBeInTheDocument();
    expect(screen.getByText("Tap a drink to add it to the sale.")).toBeInTheDocument();
  });

  for (const path of ["/stock", "/count", "/sales", "/shift", "/receive", "/settings"]) {
    it(`renders ${path}`, async () => {
      mockBackend(SHIFT);
      renderAt(path);
      expect(await screen.findByText("Tijao POS")).toBeInTheDocument();
    });
  }
});
