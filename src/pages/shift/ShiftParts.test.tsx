import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { denominationTotal } from "@/components/CashCounter";
import type { Shift } from "@/lib/types";

const closeShift = vi.fn();
vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, closeShift: (...a: unknown[]) => closeShift(...a) } };
});

import { CloseShiftModal, OverShort } from "./ShiftParts";

const closed: Shift = {
  name: "SHIFT-00001",
  status: "Closed",
  user: "c@x",
  cashier_name: "Kevin",
  opened_at: "2026-11-23 08:00:00",
  opening_float: 1000,
  is_mine: true,
  payouts: [],
  sales_count: 3,
  cash_sales: 500,
  mpesa_sales: 200,
  payouts_total: 0,
  expected_cash: 1500,
  counted_cash: 1480,
  cash_difference: -20,
};

describe("cash counter", () => {
  it("adds notes and coins", () => {
    expect(denominationTotal({ 1000: 1, 500: 2, 50: 1, 1: 3 })).toBe(2053);
    expect(denominationTotal({})).toBe(0);
  });
});

describe("OverShort", () => {
  it("labels balanced, short and over", () => {
    const { rerender } = render(<OverShort diff={0} />);
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    rerender(<OverShort diff={-20} />);
    expect(screen.getByText("Short KES 20")).toBeInTheDocument();
    rerender(<OverShort diff={50} />);
    expect(screen.getByText("Over KES 50")).toBeInTheDocument();
  });
});

describe("CloseShiftModal (blind close)", () => {
  beforeEach(() => closeShift.mockReset());

  it("never shows expected cash, counts notes, asks to confirm, then closes", async () => {
    closeShift.mockResolvedValue(closed);
    const onClosed = vi.fn();
    const user = userEvent.setup();
    render(<CloseShiftModal open onClose={() => {}} onClosed={onClosed} />);

    expect(screen.queryByText(/expected/i)).not.toBeInTheDocument();

    // Typed, not +/-: Enter jumps to the next box.
    await user.type(screen.getByLabelText("Number of KES 1000 notes"), "1{Enter}");
    expect(screen.getByLabelText("Number of KES 500 notes")).toHaveFocus();
    await user.keyboard("2");
    expect(screen.getAllByText("KES 2,000").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Next: confirm" }));
    expect(closeShift).not.toHaveBeenCalled(); // confirmation first
    await user.click(screen.getByRole("button", { name: /yes, close shift/i }));
    expect(closeShift).toHaveBeenCalledWith(2000, undefined);
    expect(onClosed).toHaveBeenCalledWith(closed);
  });

  it("typed total works too", async () => {
    closeShift.mockResolvedValue(closed);
    const user = userEvent.setup();
    render(<CloseShiftModal open onClose={() => {}} onClosed={() => {}} />);
    await user.click(screen.getByRole("radio", { name: /type the total/i }));
    await user.type(screen.getByLabelText("Total cash"), "1480");
    await user.type(screen.getByLabelText("Notes"), "short 20");
    await user.click(screen.getByRole("button", { name: "Next: confirm" }));
    await user.click(screen.getByRole("button", { name: /yes, close shift/i }));
    expect(closeShift).toHaveBeenCalledWith(1480, "short 20");
  });
});
