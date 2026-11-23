import { describe, expect, it } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QtyInput } from "./ui";

function Harness({ max }: { max?: number }) {
  const [a, setA] = useState(3);
  const [b, setB] = useState(0);
  return (
    <>
      <QtyInput label="A" value={a} max={max} onChange={setA} />
      <QtyInput label="B" value={b} onChange={setB} />
      <output data-testid="out">{`${a},${b}`}</output>
    </>
  );
}

describe("QtyInput (typed quantities, no +/-)", () => {
  it("typing replaces the old number, Enter moves to the next box", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByLabelText("A")); // selects "3"
    await user.keyboard("12{Enter}");
    expect(screen.getByTestId("out")).toHaveTextContent("12,0");
    expect(screen.getByLabelText("B")).toHaveFocus();
    await user.keyboard("7");
    expect(screen.getByTestId("out")).toHaveTextContent("12,7");
  });

  it("ignores letters, empties to 0 and respects max", async () => {
    const user = userEvent.setup();
    render(<Harness max={10} />);
    const a = screen.getByLabelText("A");
    await user.click(a);
    await user.keyboard("{Backspace}");
    expect(screen.getByTestId("out")).toHaveTextContent("0,0");
    await user.keyboard("a5x");
    expect(screen.getByTestId("out")).toHaveTextContent("5,0");
    await user.keyboard("0");
    expect(screen.getByTestId("out")).toHaveTextContent("10,0"); // 50 capped to stock left
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
