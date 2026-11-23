// Shapes returned by tijao_pos.api.* (see apps/tijao_pos/tijao_pos/services).

export type PaymentMode = "cash" | "mpesa";

export interface Me {
  user: string;
  full_name: string;
  roles: string[];
  is_owner: boolean;
  is_cashier: boolean;
  company: string | null;
  currency: string | null;
  shop_name: string | null;
  receipt_footer: string | null;
  csrf_token: string;
}

export interface Product {
  item_code: string;
  item_name: string;
  brand: string | null;
  price: number | null;
  in_stock: number;
  uom: string;
  bulk_uom: string | null;
  per_bulk: number;
  bulk_qty: number;
  loose_qty: number;
  stock_text: string;
  is_low: boolean;
  image: string | null;
}

export interface StockLevel {
  item_code: string;
  item_name: string;
  qty: number;
  uom: string;
  bulk_uom: string | null;
  per_bulk: number;
  bulk_qty: number;
  loose_qty: number;
  stock_text: string;
  stock_value: number;
  valuation_rate: number;
  is_low: boolean;
}

export interface SaleLine {
  item_code: string;
  item_name: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
}

export interface Sale {
  invoice: string;
  client_ref: string | null;
  duplicate: boolean;
  status: "paid" | "voided";
  posting_date: string;
  posting_time: string;
  cashier: string;
  currency: string;
  lines: SaleLine[];
  net_total: number;
  total: number;
  payment: {
    mode: PaymentMode | null;
    mode_of_payment: string | null;
    amount: number;
    mpesa_ref: string | null;
  };
  receipt: { header: string; footer: string | null };
}

export interface RecentSale {
  invoice: string;
  posting_date: string;
  posting_time: string;
  total: number;
  items_count: number;
  payment_mode: PaymentMode | null;
  mpesa_ref: string | null;
  status: "paid" | "voided";
  cashier: string;
}

export interface ReceiveLine {
  item_code: string;
  bulk_qty: number;
  loose_qty?: number;
  bulk_rate?: number;
}

export interface ReceiveResult {
  receipt: string;
  supplier: string;
  total: number;
  stock: StockLevel[];
}

export interface CountLine {
  item_code: string;
  bulk_qty: number;
  loose_qty: number;
}

export interface CountChange {
  item_code: string;
  item_name: string;
  before: number;
  after: number;
  difference: number;
  before_text: string;
  after_text: string;
}

export interface CountResult {
  reconciliation: string | null;
  changes: CountChange[];
  message?: string;
  stock?: StockLevel[];
}

export type Period = "today" | "week" | "month";

export interface Summary {
  period: string;
  from_date: string;
  to_date: string;
  currency: string | null;
  sales_count: number;
  net_sales: number;
  total: number;
  payments: { cash: number; mpesa: number; other: number };
  cogs: number;
  gross_profit: number;
  margin_pct: number;
  voided_count: number;
  top_items: { item_code: string; item_name: string; qty: number; net_sales: number; profit: number }[];
  daily: { date: string; sales_count: number; net_sales: number; profit: number }[];
}

export interface ImportRowError {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

export interface ImportPlanItem {
  row: number;
  item_code: string;
  item_name: string;
  sale_uom: string;
  bulk_uom: string | null;
  units_per_bulk: number;
  selling_price: number;
  buying_price_per_bulk: number;
  opening_qty: number;
  action: "create" | "update";
  opening: "none" | "post" | "skip_has_stock";
}

export interface ImportResult {
  ok: boolean;
  dry_run: boolean;
  errors: ImportRowError[];
  warnings: ImportRowError[];
  items: ImportPlanItem[];
  summary: {
    items_total: number;
    create: number;
    update: number;
    opening_to_post: number;
    opening_skipped: number;
    opening_stock_entry?: string | null;
  };
}

// ---- Shifts -------------------------------------------------------------------

export type PayoutReason = "Paid distributor" | "Transport" | "Owner took cash" | "Shop supplies" | "Other";
export const PAYOUT_REASONS: PayoutReason[] = ["Paid distributor", "Transport", "Owner took cash", "Shop supplies", "Other"];

export interface Payout {
  amount: number;
  reason: PayoutReason;
  note: string | null;
  recorded_at: string;
  recorded_by: string | null;
}

export interface Shift {
  name: string;
  status: "Open" | "Closed";
  user: string;
  cashier_name: string;
  opened_at: string;
  opening_float: number;
  is_mine: boolean;
  payouts: Payout[];
  sales_count: number;
  // Only for owners while open, and for everyone once closed (blind close).
  cash_sales?: number;
  mpesa_sales?: number;
  payouts_total?: number;
  expected_cash?: number;
  voided_count?: number;
  // Closed only
  closed_at?: string;
  closed_by?: string | null;
  counted_cash?: number;
  notes?: string | null;
  cash_difference?: number;
  reviewed?: number;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  // get_shift only
  sales?: { invoice: string; posting_time: string; total: number; status: "paid" | "voided" }[];
  voided_after_close?: number;
}

// ---- Stock counts (cashier counts, owner approves) ---------------------------

export type CountReason = "Routine count" | "Broken" | "Missing" | "Found extra" | "Expired" | "Other";
export const COUNT_REASONS: CountReason[] = ["Routine count", "Broken", "Missing", "Found extra", "Expired", "Other"];
export type CountStatus = "Pending" | "Approved" | "Rejected";

export interface StockCountRow {
  item_code: string;
  item_name: string;
  system_qty: number;
  counted_qty: number;
  difference: number;
  value: number;
  system_text: string;
  counted_text: string;
}

export interface StockCount {
  name: string;
  status: CountStatus;
  reason: CountReason;
  notes: string | null;
  counted_at: string | null;
  counted_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  applied: boolean;
  items_changed: number;
  total_difference: number;
  total_value: number;
  rows?: StockCountRow[];
}

export interface CountActionResult {
  count: StockCount | null;
  message: string;
}
