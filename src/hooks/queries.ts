import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { KEYS, load, save } from "@/lib/storage";
import type { Period, Product } from "@/lib/types";

export const qk = {
  products: ["products"] as const,
  stock: ["stock"] as const,
  buyingPrices: ["buyingPrices"] as const,
  recentSales: ["recentSales"] as const,
  summary: (p: Period) => ["summary", p] as const,
  shift: ["shift"] as const,
  shifts: ["shifts"] as const,
  counts: (status?: string) => ["counts", status ?? "all"] as const,
};

/** The open shift (or null). Polled so every screen agrees on whether the till is open. */
export function useCurrentShift() {
  return useQuery({ queryKey: qk.shift, queryFn: api.currentShift, staleTime: 10_000, refetchInterval: 60_000 });
}

export function useShifts(enabled = true) {
  return useQuery({ queryKey: qk.shifts, queryFn: api.listShifts, enabled, staleTime: 15_000 });
}

export function useCounts(status?: "Pending" | "Approved" | "Rejected") {
  return useQuery({ queryKey: qk.counts(status), queryFn: () => api.listCounts(status), staleTime: 10_000, refetchInterval: 60_000 });
}

/** Products, served instantly from the last copy on this device, then refreshed. */
export function useProducts() {
  return useQuery({
    queryKey: qk.products,
    queryFn: async () => {
      const products = await api.products();
      save(KEYS.products, products);
      return products;
    },
    initialData: () => load<Product[] | undefined>(KEYS.products, undefined),
    initialDataUpdatedAt: 0, // treat the cached copy as stale -> refetch right away
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useStockLevels() {
  return useQuery({ queryKey: qk.stock, queryFn: api.stockLevels, staleTime: 15_000 });
}

export function useBuyingPrices(enabled = true) {
  return useQuery({ queryKey: qk.buyingPrices, queryFn: api.buyingPrices, enabled, staleTime: 60_000 });
}

export function useRecentSales() {
  return useQuery({ queryKey: qk.recentSales, queryFn: () => api.recentSales(50), staleTime: 10_000 });
}

export function useSummary(period: Period) {
  return useQuery({
    queryKey: qk.summary(period),
    queryFn: () => api.summary(period),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** After anything that changes stock or sales. */
export function useRefreshAfterWrite() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.products });
    void qc.invalidateQueries({ queryKey: qk.stock });
    void qc.invalidateQueries({ queryKey: qk.recentSales });
    void qc.invalidateQueries({ queryKey: ["summary"] });
    void qc.invalidateQueries({ queryKey: qk.shift });
    void qc.invalidateQueries({ queryKey: qk.shifts });
    void qc.invalidateQueries({ queryKey: ["counts"] });
  };
}
