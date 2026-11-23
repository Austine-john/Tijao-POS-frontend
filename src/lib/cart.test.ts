import { describe, expect, it } from "vitest";
import { cartCount, cartReducer, cartTotal, changeBreakdown, changeDue, emptyCart, quickAmounts, type CartState } from "./cart";

const coke = { item_code: "COKE", item_name: "Coke 500ml", price: 60, in_stock: 3 };
const water = { item_code: "WATER", item_name: "Water 500ml", price: 30, in_stock: 10 };

function run(...actions: Parameters<typeof cartReducer>[1][]): CartState {
  return actions.reduce(cartReducer, emptyCart);
}

describe("cart reducer", () => {
  it("adds, merges taps and totals", () => {
    const s = run({ type: "add", item: coke }, { type: "add", item: water }, { type: "add", item: coke });
    expect(s.lines.map((l) => [l.item_code, l.qty])).toEqual([
      ["COKE", 2],
      ["WATER", 1],
    ]);
    expect(cartTotal(s.lines)).toBe(150);
    expect(cartCount(s.lines)).toBe(3);
  });

  it("never goes above the stock left and says so", () => {
    const s = run({ type: "add", item: coke }, { type: "inc", item_code: "COKE" }, { type: "inc", item_code: "COKE" }, { type: "inc", item_code: "COKE" });
    expect(s.lines[0].qty).toBe(3);
    expect(s.notice).toMatch(/Only 3/);
  });

  it("refuses out-of-stock items", () => {
    const s = run({ type: "add", item: { ...coke, in_stock: 0 } });
    expect(s.lines).toHaveLength(0);
    expect(s.notice).toMatch(/out of stock/);
  });

  it("minus to zero removes the line; remove and clear work", () => {
    let s = run({ type: "add", item: coke }, { type: "add", item: water }, { type: "dec", item_code: "COKE" });
    expect(s.lines.map((l) => l.item_code)).toEqual(["WATER"]);
    s = cartReducer(s, { type: "remove", item_code: "WATER" });
    expect(s.lines).toHaveLength(0);
    s = cartReducer(run({ type: "add", item: coke }), { type: "clear" });
    expect(s).toEqual(emptyCart);
  });

  it("set clamps to 0..stock", () => {
    let s = run({ type: "add", item: water }, { type: "set", item_code: "WATER", qty: 7 });
    expect(s.lines[0].qty).toBe(7);
    s = cartReducer(s, { type: "set", item_code: "WATER", qty: 99 });
    expect(s.lines[0].qty).toBe(10);
  });

  it("keeps the client_ref only while the cart is unchanged", () => {
    let s = run({ type: "add", item: coke }, { type: "ensureRef", ref: "abc" });
    expect(s.clientRef).toBe("abc");
    s = cartReducer(s, { type: "ensureRef", ref: "other" });
    expect(s.clientRef).toBe("abc"); // retries reuse it
    s = cartReducer(s, { type: "inc", item_code: "COKE" });
    expect(s.clientRef).toBeNull(); // different cart -> different sale
  });

  it("caps the cart when fresh stock is lower", () => {
    let s = run({ type: "add", item: water }, { type: "set", item_code: "WATER", qty: 5 }, { type: "ensureRef", ref: "r1" });
    s = cartReducer(s, { type: "refreshStock", stock: { WATER: 2 } });
    expect(s.lines[0]).toMatchObject({ qty: 2, max: 2 });
    expect(s.notice).toMatch(/Only 2/);
    expect(s.clientRef).toBeNull();
    s = cartReducer(s, { type: "refreshStock", stock: { WATER: 0 } });
    expect(s.lines).toHaveLength(0);
  });
});

describe("cash maths", () => {
  it("change due", () => {
    expect(changeDue(350, 500)).toBe(150);
    expect(changeDue(350, 350)).toBe(0);
    expect(changeDue(350, 300)).toBeNull();
    expect(changeDue(350, Number.NaN)).toBeNull();
  });

  it("breaks change into Kenyan notes and coins", () => {
    expect(changeBreakdown(150)).toEqual([
      { value: 100, count: 1 },
      { value: 50, count: 1 },
    ]);
    expect(changeBreakdown(785)).toEqual([
      { value: 500, count: 1 },
      { value: 200, count: 1 },
      { value: 50, count: 1 },
      { value: 20, count: 1 },
      { value: 10, count: 1 },
      { value: 5, count: 1 },
    ]);
    expect(changeBreakdown(0)).toEqual([]);
  });

  it("suggests exact amount and round notes", () => {
    expect(quickAmounts(350)).toEqual([350, 400, 500, 1000]);
    expect(quickAmounts(1000)).toEqual([1000]);
    expect(quickAmounts(0)).toEqual([]);
  });
});
