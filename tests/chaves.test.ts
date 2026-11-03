import { describe, expect, it } from "vitest";
import { keyStatus } from "../worker/admin";
import { normalizeCode } from "../worker/crypto";

const now = Date.parse("2026-11-03T12:00:00Z");
const inDays = (d: number) => new Date(now + d * 86400000).toISOString();

describe("situação da chave", () => {
  it.each([
    [{ status: "disponivel", expires_at: null }, "Disponível"],
    [{ status: "bloqueada", expires_at: inDays(200) }, "Bloqueada"],
    [{ status: "ativa", expires_at: inDays(-1) }, "Expirada"],
    [{ status: "ativa", expires_at: inDays(10) }, "Vence em breve"],
    [{ status: "ativa", expires_at: inDays(120) }, "Ativa"],
  ])("%o -> %s", (k, label) => expect(keyStatus(k, now)).toBe(label));
});

describe("chave digitada", () => {
  it.each([
    ["adc-g4z2-5q7d-e4ee", "ADC-G4Z2-5Q7D-E4EE"],
    ["ADC G4Z2 5Q7D E4EE", "ADC-G4Z2-5Q7D-E4EE"],
    ["g4z25q7de4ee", "ADC-G4Z2-5Q7D-E4EE"],
    ["ADC-123", ""],
  ])("%s", (raw, out) => expect(normalizeCode(raw)).toBe(out));
});
