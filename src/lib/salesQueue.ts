// The seam for offline selling.
//
// Today every sale goes straight to the server (OnlineSalesQueue): if there is no
// connection the sale fails and the UI says so clearly. Later, an OfflineSalesQueue
// can implement the same interface (store the sale + its client_ref locally, replay
// when back online; the server already ignores duplicate client_refs).

import { api } from "./api";
import type { PaymentMode, Sale } from "./types";

export interface PendingSale {
  client_ref: string;
  items: { item_code: string; qty: number }[];
  payment_mode: PaymentMode;
  mpesa_ref?: string;
}

export interface SalesQueue {
  /** Resolve only when the server confirmed the sale. */
  submit(sale: PendingSale): Promise<Sale>;
  /** Sales waiting to be sent (always 0 for the online queue). */
  pendingCount(): number;
}

export class OnlineSalesQueue implements SalesQueue {
  submit(sale: PendingSale): Promise<Sale> {
    return api.makeSale({
      items: sale.items,
      payment_mode: sale.payment_mode,
      client_ref: sale.client_ref,
      mpesa_ref: sale.mpesa_ref || undefined,
    });
  }

  pendingCount() {
    return 0;
  }
}

export const salesQueue: SalesQueue = new OnlineSalesQueue();

export function newClientRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
