import { describe, expect, it } from "vitest";
import { describeQty, kes, plural, sizeMl, sizeOf, splitUnits, toSaleUnits } from "./format";
import { extractMessage, toApiError } from "./api";

describe("format", () => {
  it("formats KES", () => {
    expect(kes(1250)).toBe("KES 1,250");
    expect(kes(32.5)).toBe("KES 32.50");
    expect(kes(null)).toBe("KES 0");
  });

  it("splits and describes stock like the backend", () => {
    expect(splitUnits(79, 24)).toEqual({ bulk: 3, loose: 7 });
    expect(toSaleUnits(3, 7, 24)).toBe(79);
    expect(toSaleUnits(0, 5, 1)).toBe(5);
    expect(describeQty(79, "Bottle", "Crate", 24)).toBe("3 crates + 7 bottles");
    expect(describeQty(24, "Bottle", "Crate", 24)).toBe("1 crate");
    expect(describeQty(0, "Bottle", "Crate", 24)).toBe("0 bottles");
    expect(describeQty(5, "Bottle")).toBe("5 bottles");
    expect(plural("Box", 2)).toBe("boxes");
    expect(plural("Dozen", 2)).toBe("dozens");
  });

  it("reads bottle sizes from names", () => {
    expect(sizeOf("Sprite pet 500ml")).toBe("500ml");
    expect(sizeOf("coke 300 ml")).toBe("300ml");
    expect(sizeOf("Ital Water 1.5L")).toBe("1.5L");
    expect(sizeOf("Dasani water 1l")).toBe("1L");
    expect(sizeOf("Novida")).toBeNull();
    expect(["2L", "300ml", "1.5L", "500ml"].sort((a, b) => sizeMl(a) - sizeMl(b))).toEqual(["300ml", "500ml", "1.5L", "2L"]);
  });
});

describe("api errors", () => {
  it("extracts our friendly message from _server_messages", () => {
    const body = {
      exc_type: "TijaoError",
      _server_messages: JSON.stringify([JSON.stringify({ message: "Not enough Test Water: only 8 bottles left.", title: "Tijao POS" })]),
    };
    expect(extractMessage(body)).toBe("Not enough Test Water: only 8 bottles left.");
    const err = toApiError(417, body);
    expect(err.kind).toBe("server");
    expect(err.message).toBe("Not enough Test Water: only 8 bottles left.");
  });

  it("treats a guest 403 as logged out, a role 403 as forbidden", () => {
    const guest = {
      exc_type: "PermissionError",
      _server_messages: JSON.stringify([JSON.stringify({ message: "<details><summary>You are not permitted to access this resource. Login to access</summary>Function x is not whitelisted.</details>" })]),
    };
    expect(toApiError(403, guest).kind).toBe("auth");
    const role = { exc_type: "PermissionError", _server_messages: JSON.stringify([JSON.stringify({ message: "You are not allowed to do this. Ask the owner." })]) };
    const e = toApiError(403, role);
    expect(e.kind).toBe("forbidden");
    expect(e.message).toBe("You are not allowed to do this. Ask the owner.");
  });

  it("never shows tracebacks for server crashes", () => {
    const e = toApiError(500, { exception: "Traceback (most recent call last): ..." });
    expect(e.kind).toBe("server");
    expect(e.message).not.toMatch(/Traceback/);
    expect(toApiError(502, null).kind).toBe("network");
  });
});
