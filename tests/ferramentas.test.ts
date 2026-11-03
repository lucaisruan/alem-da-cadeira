import { describe, expect, it } from "vitest";
import { emptyGroups, metaScenario, monthResult, normalizeSettings, proLabore, reserve, yearAverages } from "../shared/dre";

function month(rev: number, varc: number, fixed: number) {
  const g = emptyGroups();
  g.Receita = rev;
  g["Comissões"] = varc;
  g.Estrutura = fixed;
  return monthResult(g, 0, rev > 0);
}

describe("pró-labore (exemplo da própria planilha)", () => {
  // faturamento médio 100.000 e lucro médio 15.000
  const months = Array.from({ length: 6 }, () => month(100000, 60000, 25000));
  const avg = yearAverages(months);
  it("opção que preserva 10% comporta 5.000; a de 12% comporta 3.000", () => {
    const r = proLabore(avg, 0.1, 0.12);
    expect(r.option1.gross).toBeCloseTo(5000);
    expect(r.option2.gross).toBeCloseTo(3000);
    expect(r.option1.inss).toBeCloseTo(550);
    expect(r.option1.net).toBeCloseTo(4450);
    expect(r.situation.label).toBe("Saudável e confortável");
  });
  it("com menos de 6 meses zera e pede mais histórico", () => {
    const r = proLabore(yearAverages(months.slice(0, 5)), 0.1, 0.12);
    expect(r.option1.gross).toBe(0);
    expect(r.situation.label).toBe("Base ainda curta");
  });
  it("margem abaixo da opção 1 não recomenda pró-labore", () => {
    const r = proLabore(avg, 0.16, 0.18);
    expect(r.option1.gross).toBe(0);
    expect(r.situation.label).toBe("Sem capacidade para pró-labore");
  });
  it("INSS respeita o teto", () => {
    const big = yearAverages(Array.from({ length: 6 }, () => month(500000, 100000, 100000)));
    expect(proLabore(big, 0.1, 0.12).option1.inss).toBeCloseTo(8475.55 * 0.11);
  });
});

describe("meta que paga o próprio prêmio", () => {
  const avg = yearAverages(Array.from({ length: 3 }, () => month(50000, 20000, 15000)));
  it("fixos ÷ (margem − prêmio − lucro)", () => {
    const m = metaScenario(avg, 0.1, 0.01);
    expect(m.needed).toBeCloseTo(15000 / (0.6 - 0.01 - 0.1));
    expect(m.prize).toBeCloseTo(m.needed * 0.01);
  });
  it("inviável quando a margem não cobre prêmio e lucro", () => {
    expect(metaScenario(avg, 0.5, 0.2).viable).toBe(false);
  });
});

describe("reserva", () => {
  it("3 e 6 meses de custo fixo", () => {
    const r = reserve(10000, 35000);
    expect(r.min).toBe(30000);
    expect(r.rec).toBe(60000);
    expect(r.months).toBeCloseTo(3.5);
    expect(r.status.label).toBe("Mínimo protegido");
  });
});

describe("ajustes salvos", () => {
  it("apara valores fora da faixa e completa o padrão", () => {
    const s = normalizeSettings({ proLabore: { keep1: 2 }, equipe: [{ nome: "  Ana ", base: -5 }, { nome: "" }] });
    expect(s.proLabore.keep1).toBe(0.5);
    expect(s.proLabore.keep2).toBe(0.12);
    expect(s.equipe).toEqual([{ nome: "Ana", base: 0 }]);
    expect(s.meta.scenarios).toHaveLength(3);
  });
});
