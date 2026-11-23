// Formatting helpers. Pure: no React, no network.

const intFmt = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1250 -> "KES 1,250"; 32.5 -> "KES 32.50". */
export function kes(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return `KES ${Number.isInteger(n) ? intFmt.format(n) : decFmt.format(n)}`;
}

/** Number only, for big displays where "KES" is a separate element. */
export function money(amount: number | null | undefined): string {
  return kes(amount).slice(4);
}

export function plural(uom: string, count: number): string {
  const w = (uom || "").trim().toLowerCase();
  if (!w || count === 1) return w;
  if (w.endsWith("s")) return w;
  if (/(x|ch|sh|z)$/.test(w)) return `${w}es`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

export function splitUnits(qty: number, perBulk: number | null | undefined) {
  const per = perBulk && perBulk > 1 ? perBulk : 0;
  if (!per || qty <= 0) return { bulk: 0, loose: Math.max(qty, 0) };
  const bulk = Math.floor(qty / per);
  return { bulk, loose: qty - bulk * per };
}

export function toSaleUnits(bulk: number, loose: number, perBulk: number | null | undefined): number {
  const per = perBulk && perBulk > 1 ? perBulk : 1;
  return (bulk || 0) * per + (loose || 0);
}

/** Mirrors the backend: "3 crates + 7 bottles", "1 crate", "5 bottles". */
export function describeQty(qty: number, saleUom: string, bulkUom?: string | null, perBulk?: number | null): string {
  if (bulkUom && perBulk && perBulk > 1) {
    const { bulk, loose } = splitUnits(qty, perBulk);
    const parts: string[] = [];
    if (bulk) parts.push(`${bulk} ${plural(bulkUom, bulk)}`);
    if (loose || parts.length === 0) parts.push(`${loose} ${plural(saleUom, loose)}`);
    return parts.join(" + ");
  }
  return `${qty} ${plural(saleUom, qty)}`;
}

/** "Sprite pet 500ml" -> "500ml", "Ital Water 1.5L" -> "1.5L". Used for the size filter chips. */
export function sizeOf(name: string): string | null {
  const m = /(\d+(?:\.\d+)?)\s*(ml|l|ltr|litre|liter)\b/i.exec(name || "");
  if (!m) return null;
  const unit = m[2].toLowerCase() === "ml" ? "ml" : "L";
  return `${m[1]}${unit}`;
}

/** For sorting sizes: millilitres. */
export function sizeMl(size: string): number {
  const m = /^(\d+(?:\.\d+)?)(ml|L)$/.exec(size);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return m[2] === "ml" ? Number(m[1]) : Number(m[1]) * 1000;
}

/** "SPRITE PET 500ML" / "coke 300 ml" -> "Coke 300 ml" (first letter capitalised, rest kept). */
export function niceName(name: string): string {
  const s = (name || "").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function longDate(d: Date = new Date()): string {
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

export function shortTime(hms: string): string {
  return (hms || "").slice(0, 5);
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function todayIso(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
