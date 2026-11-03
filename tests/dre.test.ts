import { describe, expect, it } from "vitest";
import { emptyGroups, health, monthResult, parseMoneyToCents } from "../shared/dre";

describe("DRE do mês (aba Resumo Mensal)", () => {
  it("segue a cascata da planilha", () => {
    const g = emptyGroups();
    g.Receita = 10000;
    g["Comissões"] = 3000;
    g["Fornecedores/Insumos"] = 1000;
    g.Equipe = 1500;
    g.Estrutura = 1200;
    g.Financeiro = 300;
    const r = monthResult(g, 0.067);
    expect(r.tax).toBeCloseTo(670);
    expect(r.contribution).toBeCloseTo(10000 - 670 - 3000 - 1000);
    expect(r.fixed).toBe(3000);
    expect(r.profit).toBeCloseTo(5330 - 3000);
    expect(r.margin).toBeCloseTo(0.233);
    expect(r.out).toBeCloseTo(r.revenue - r.profit);
  });
  it("mês sem faturamento não divide por zero", () => {
    const g = emptyGroups();
    g.Estrutura = 500;
    const r = monthResult(g, 0.067);
    expect(r.margin).toBe(0);
    expect(r.profit).toBe(-500);
  });
});

describe("faixas do termômetro", () => {
  it("usa 10% a 30% como saudável", () => {
    expect(health(-0.1, 1).label).toBe("Prejuízo");
    expect(health(0.05, 1).label).toBe("Abaixo do saudável");
    expect(health(0.1, 1).label).toBe("Saudável");
    expect(health(0.3, 1).label).toBe("Saudável");
    expect(health(0.31, 1).label).toBe("Acima de 30%");
  });
});

describe("valor digitado", () => {
  it.each([
    ["1.234,56", 123456],
    ["80", 8000],
    ["80,5", 8050],
    ["R$ 2.140", 214000],
    ["1234.56", 123456],
    ["0,99", 99],
  ])("%s", (raw, cents) => expect(parseMoneyToCents(raw)).toBe(cents));
  it.each(["", "abc", "1,2,3", "12,345"])("recusa %s", (raw) => expect(parseMoneyToCents(raw)).toBeNaN());
});
