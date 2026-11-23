import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, NO_CONNECTION } from "@/lib/api";
import { PaymentModal, type PaymentModalProps } from "./PaymentModal";

function setup(props: Partial<PaymentModalProps> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<PaymentModal mode="cash" total={350} bottles={5} submitting={false} error={null} onCancel={onCancel} onConfirm={onConfirm} {...props} />);
  return { onConfirm, onCancel, user: userEvent.setup() };
}

describe("PaymentModal: cash", () => {
  it("shows change and its notes, and confirms with the amount given", async () => {
    const { user, onConfirm } = setup();
    await user.type(screen.getByLabelText(/amount given/i), "500");
    expect(screen.getByText("KES 150")).toBeInTheDocument();
    expect(screen.getByText("1 × 100 + 1 × 50")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /complete sale/i }));
    expect(onConfirm).toHaveBeenCalledWith({ cashGiven: 500 });
  });

  it("blank amount means exact money", async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByRole("button", { name: /complete sale/i }));
    expect(onConfirm).toHaveBeenCalledWith({ cashGiven: 350 });
  });

  it("blocks when the customer gave too little", async () => {
    const { user, onConfirm } = setup();
    await user.type(screen.getByLabelText(/amount given/i), "300");
    expect(screen.getByText(/gave less than/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete sale/i })).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("quick amount buttons fill the amount", async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByRole("button", { name: /KES 1,000/ }));
    expect(screen.getByText("KES 650")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /complete sale/i }));
    expect(onConfirm).toHaveBeenCalledWith({ cashGiven: 1000 });
  });

  it("while saving, shows progress and can't be submitted twice", () => {
    setup({ submitting: true });
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("no connection: says the sale was NOT saved and offers Try again", async () => {
    const { user, onConfirm } = setup({ error: new ApiError(NO_CONNECTION, "network") });
    expect(screen.getByRole("alert")).toHaveTextContent(/NOT saved/);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("server refusal shows the friendly message", () => {
    setup({ error: new ApiError("Not enough Fanta: only 3 bottles left.", "server", 417) });
    expect(screen.getByRole("alert")).toHaveTextContent("Not enough Fanta: only 3 bottles left.");
    expect(screen.getByRole("button", { name: /complete sale/i })).toBeEnabled();
  });
});

describe("PaymentModal: M-Pesa", () => {
  it("code is optional", async () => {
    const { user, onConfirm } = setup({ mode: "mpesa" });
    await user.click(screen.getByRole("button", { name: /complete sale/i }));
    expect(onConfirm).toHaveBeenCalledWith({ mpesaRef: undefined });
  });

  it("cleans and validates the code", async () => {
    const { user, onConfirm } = setup({ mode: "mpesa" });
    const input = screen.getByLabelText(/m-pesa code/i);
    await user.type(input, "skl7 q2wp89");
    await user.click(screen.getByRole("button", { name: /complete sale/i }));
    expect(onConfirm).toHaveBeenCalledWith({ mpesaRef: "SKL7Q2WP89" });

    await user.clear(input);
    await user.type(input, "??");
    expect(screen.getByText(/letters and numbers only/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /complete sale/i })).toBeDisabled();
  });
});
