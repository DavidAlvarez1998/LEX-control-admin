// Formato de precios de la plataforma (S0.6). Lógica pura.
import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyInput } from "./format";

describe("formatMoney", () => {
  it("agrupa miles con punto, sin decimales (es-CO)", () => {
    expect(formatMoney(1000000)).toBe("1.000.000");
    expect(formatMoney("450000")).toBe("450.000");
    expect(formatMoney(999)).toBe("999");
  });
  it("redondea y tolera entradas inválidas", () => {
    expect(formatMoney(1234.6)).toBe("1.235");
    expect(formatMoney("abc")).toBe("0");
    expect(formatMoney(Number.NaN)).toBe("0");
  });
});

describe("parseMoneyInput", () => {
  it("deja solo dígitos", () => {
    expect(parseMoneyInput("$ 1.000.000")).toBe("1000000");
    expect(parseMoneyInput("45.000 COP")).toBe("45000");
    expect(parseMoneyInput("")).toBe("");
    expect(parseMoneyInput("abc")).toBe("");
  });
});
