import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { kes, money, niceName } from "@/lib/format";
import { KEYS, load, save } from "@/lib/storage";
import type { Sale } from "@/lib/types";

export type PaperWidth = 58 | 80;

export function usePaperWidth(): [PaperWidth, (w: PaperWidth) => void] {
  const [w, setW] = useState<PaperWidth>(() => load<PaperWidth>(KEYS.paper, 58));
  return [w, (next) => (setW(next), save(KEYS.paper, next))];
}

interface ReceiptProps {
  sale: Sale;
  /** Only known on the device that took the cash (not stored on the server). */
  cashGiven?: number | null;
  change?: number | null;
}

/** Plain monospace slip. Same markup on screen (preview) and on paper. */
export function Receipt({ sale, cashGiven, change }: ReceiptProps) {
  const items = sale.lines.reduce((n, l) => n + l.qty, 0);
  const paidBy = sale.payment.mode === "mpesa" ? "M-PESA" : sale.payment.mode === "cash" ? "CASH" : (sale.payment.mode_of_payment ?? "").toUpperCase();
  return (
    <div className="receipt font-mono text-[12px] leading-snug text-black">
      <div className="text-center">
        <div className="text-[14px] font-bold uppercase tracking-wider">{sale.receipt.header}</div>
        {sale.status === "voided" && <div className="mt-1 border border-black py-0.5 font-bold">*** VOIDED ***</div>}
      </div>
      <Rule />
      <Row left={`Date: ${sale.posting_date} ${sale.posting_time.slice(0, 5)}`} right="" />
      <Row left={`No: ${sale.invoice}`} right="" />
      <Rule />
      {sale.lines.map((l) => (
        <div key={l.item_code} className="mb-1">
          <div>{niceName(l.item_name)}</div>
          <Row left={`  ${l.qty} x ${money(l.rate)}`} right={money(l.amount)} />
        </div>
      ))}
      <Rule />
      <Row left="Items:" right={String(items)} />
      <Row left="TOTAL:" right={kes(sale.total)} bold />
      {cashGiven != null && sale.payment.mode === "cash" && (
        <>
          <Row left="Cash given:" right={kes(cashGiven)} />
          <Row left="Change:" right={kes(change ?? 0)} bold />
        </>
      )}
      <Rule />
      <Row left="Paid by:" right={paidBy} />
      {sale.payment.mpesa_ref && <Row left="M-Pesa code:" right={sale.payment.mpesa_ref} />}
      <Row left="Served by:" right={sale.cashier} />
      <Rule />
      {sale.receipt.footer && <div className="mt-1 text-center font-bold uppercase">{sale.receipt.footer}</div>}
    </div>
  );
}

function Row({ left, right, bold }: { left: string; right: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span className="min-w-0 break-words">{left}</span>
      <span className="shrink-0 text-right">{right}</span>
    </div>
  );
}

function Rule() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}

/** Print any slip (receipt, shift report) on the thermal printer via the browser print dialog. */
export function PrintSlip({ width, onDone, children }: { width: PaperWidth; onDone: () => void; children: ReactNode }) {
  // Print once per mount, even though the parent re-renders (e.g. a countdown).
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const after = () => done.current();
    window.addEventListener("afterprint", after);
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const content = width === 58 ? "48mm" : "72mm";
  return createPortal(
    <div className="print-only">
      <style>{`@media print { @page { size: ${width}mm auto; margin: 3mm 2mm; } .print-only .receipt { width: ${content}; } }`}</style>
      {children}
    </div>,
    document.body,
  );
}

export function PrintReceipt({ sale, cashGiven, change, width, onDone }: ReceiptProps & { width: PaperWidth; onDone: () => void }) {
  return (
    <PrintSlip width={width} onDone={onDone}>
      <Receipt sale={sale} cashGiven={cashGiven} change={change} />
    </PrintSlip>
  );
}

export { Row as SlipRow, Rule as SlipRule };
