// Regras do método Além da Cadeira, tiradas da planilha DRE 2026.
// Este arquivo é usado pelo app (telas) e pela API (plano de contas padrão).

export type Kind = "in" | "out";

export const DRE_GROUPS = [
  "Receita",
  "Comissões",
  "Fornecedores/Insumos",
  "Equipe",
  "Estrutura",
  "Marketing",
  "Administrativo",
  "Financeiro",
  "Outras Despesas",
] as const;
export type DreGroup = (typeof DRE_GROUPS)[number];

export const VARIABLE_GROUPS: DreGroup[] = ["Comissões", "Fornecedores/Insumos"];
export const FIXED_GROUPS: DreGroup[] = ["Equipe", "Estrutura", "Marketing", "Administrativo", "Financeiro", "Outras Despesas"];
export const OUT_GROUPS: DreGroup[] = [...VARIABLE_GROUPS, ...FIXED_GROUPS];

export function kindOf(group: DreGroup): Kind {
  return group === "Receita" ? "in" : "out";
}

export const GROUP_LABEL: Record<DreGroup, string> = {
  Receita: "Faturamento",
  "Comissões": "Comissões",
  "Fornecedores/Insumos": "Fornecedores e insumos",
  Equipe: "Equipe",
  Estrutura: "Estrutura",
  Marketing: "Marketing",
  Administrativo: "Administrativo",
  Financeiro: "Financeiro",
  "Outras Despesas": "Outras despesas",
};

/** As categorias padrão da aba Plano de Contas da DRE 2026 (o imposto é automático e não entra aqui). */
export const DEFAULT_CATEGORIES: { name: string; group: DreGroup; hint: string }[] = [
  { name: "Serviços", group: "Receita", hint: "Receita de serviços do salão" },
  { name: "Produtos / Home Care", group: "Receita", hint: "Venda de produtos" },
  { name: "Outras Receitas", group: "Receita", hint: "Outras entradas operacionais" },
  { name: "Comissões", group: "Comissões", hint: "Comissões dos profissionais" },
  { name: "Fornecedores/Insumos", group: "Fornecedores/Insumos", hint: "Produtos usados nos atendimentos" },
  { name: "Equipe", group: "Equipe", hint: "Salários, benefícios, encargos" },
  { name: "Aluguel", group: "Estrutura", hint: "Aluguel do espaço" },
  { name: "Condomínio", group: "Estrutura", hint: "Condomínio" },
  { name: "Água", group: "Estrutura", hint: "Conta de água" },
  { name: "Luz", group: "Estrutura", hint: "Energia elétrica" },
  { name: "Internet", group: "Estrutura", hint: "Internet / telefone" },
  { name: "Manutenção", group: "Estrutura", hint: "Manutenções do espaço e equipamentos" },
  { name: "Marketing", group: "Marketing", hint: "Tráfego, agência, criação" },
  { name: "Contabilidade", group: "Administrativo", hint: "Contador / escritório contábil" },
  { name: "Sistemas", group: "Administrativo", hint: "Software de gestão" },
  { name: "Material de Escritório", group: "Administrativo", hint: "Itens administrativos" },
  { name: "Taxas de Cartão", group: "Financeiro", hint: "Taxas de maquininhas" },
  { name: "Juros / Tarifas Bancárias", group: "Financeiro", hint: "Juros e tarifas" },
  { name: "Outras Despesas", group: "Outras Despesas", hint: "Despesas não classificadas acima" },
];

/** Sugestões mais detalhadas, vindas da planilha Fluxo de Caixa. Ficam desligadas até a dona ativar. */
export const SUGGESTED_CATEGORIES: { name: string; group: DreGroup }[] = [
  { name: "Pacotes e pré-venda", group: "Receita" },
  { name: "Repasse", group: "Comissões" },
  { name: "Lavanderia", group: "Fornecedores/Insumos" },
  { name: "CLT", group: "Equipe" },
  { name: "MEI equipe", group: "Equipe" },
  { name: "FGTS", group: "Equipe" },
  { name: "INSS", group: "Equipe" },
  { name: "13º salário", group: "Equipe" },
  { name: "Férias", group: "Equipe" },
  { name: "Vale-transporte", group: "Equipe" },
  { name: "Alimentação", group: "Equipe" },
  { name: "Plano de saúde", group: "Equipe" },
  { name: "Bonificação", group: "Equipe" },
  { name: "Aluguel de equipamentos", group: "Estrutura" },
  { name: "Segurança", group: "Estrutura" },
  { name: "Seguros", group: "Estrutura" },
  { name: "Taxas da prefeitura", group: "Estrutura" },
  { name: "Brindes", group: "Marketing" },
  { name: "Eventos", group: "Marketing" },
  { name: "Consultoria", group: "Administrativo" },
  { name: "Treinamentos", group: "Administrativo" },
  { name: "Correios e cartórios", group: "Administrativo" },
  { name: "Motoboy e fretes", group: "Outras Despesas" },
  { name: "Estacionamento", group: "Outras Despesas" },
];

export const DEFAULT_TAX_RATE = 0.067;

export type GroupTotals = Record<DreGroup, number>;

export type MonthResult = {
  groups: GroupTotals;
  revenue: number; // faturamento
  tax: number; // imposto automático
  variable: number; // imposto + comissões + insumos
  contribution: number; // margem de contribuição
  fixed: number; // custos fixos
  out: number; // tudo o que saiu, já com imposto
  profit: number; // lucro líquido
  margin: number; // lucratividade (lucro / faturamento)
  hasData: boolean;
};

export function emptyGroups(): GroupTotals {
  return Object.fromEntries(DRE_GROUPS.map((g) => [g, 0])) as GroupTotals;
}

/** A DRE simplificada da aba Resumo Mensal. Valores em reais. */
export function monthResult(groups: GroupTotals, taxRate: number, hasData = true): MonthResult {
  const revenue = groups.Receita;
  const tax = revenue * taxRate;
  const variable = tax + groups["Comissões"] + groups["Fornecedores/Insumos"];
  const contribution = revenue - variable;
  const fixed = FIXED_GROUPS.reduce((s, g) => s + groups[g], 0);
  const profit = contribution - fixed;
  return {
    groups,
    revenue,
    tax,
    variable,
    contribution,
    fixed,
    out: variable + fixed,
    profit,
    margin: revenue ? profit / revenue : 0,
    hasData,
  };
}

/** Faixas do termômetro: no método, o saudável vai de 10% a 30%. */
export function health(margin: number, revenue: number): { label: string; tone: "good" | "warn" | "bad" | "info" | "mute" } {
  if (!revenue) return { label: "Sem vendas lançadas", tone: "mute" };
  if (margin < 0) return { label: "Prejuízo", tone: "bad" };
  if (margin < 0.1) return { label: "Abaixo do saudável", tone: "warn" };
  if (margin <= 0.3) return { label: "Saudável", tone: "good" };
  return { label: "Acima de 30%", tone: "info" };
}

export const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "1.234,56" ou "1234.56" ou "R$ 80" -> centavos. Retorna NaN se não der para ler. */
export function parseMoneyToCents(raw: string): number {
  let s = String(raw).replace(/R\$|\s/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * 100);
}

export function normalizeName(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/* ---------- Fase 3: ferramentas do método (abas Pró-Labore, Meta & Bonificação, Reserva Financeira) ---------- */

export const INSS_RATE = 0.11;
export const INSS_CEILING = 8475.55; // teto previdenciário 2026
export const MIN_HISTORY_MONTHS = 6;

export type Settings = {
  proLabore: { keep1: number; keep2: number };
  meta: { scenarios: { lucro: number; premio: number }[] };
  reserva: { guardado: number };
  equipe: { nome: string; base: number }[];
};
export const DEFAULT_SETTINGS: Settings = {
  proLabore: { keep1: 0.1, keep2: 0.12 },
  meta: { scenarios: [{ lucro: 0.1, premio: 0 }, { lucro: 0.1, premio: 0.01 }, { lucro: 0.1, premio: 0.02 }] },
  reserva: { guardado: 0 },
  equipe: [],
};
const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
/** Junta o que veio salvo com o padrão, aparando valores fora da faixa. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings>;
  const d = DEFAULT_SETTINGS;
  const sc = Array.isArray(r.meta?.scenarios) ? r.meta!.scenarios : d.meta.scenarios;
  return {
    proLabore: { keep1: clamp(r.proLabore?.keep1, 0, 0.5, d.proLabore.keep1), keep2: clamp(r.proLabore?.keep2, 0, 0.5, d.proLabore.keep2) },
    meta: { scenarios: [0, 1, 2].map((i) => ({ lucro: clamp(sc[i]?.lucro, 0, 0.6, d.meta.scenarios[i].lucro), premio: clamp(sc[i]?.premio, 0, 0.3, d.meta.scenarios[i].premio) })) },
    reserva: { guardado: clamp(r.reserva?.guardado, 0, 1e9, 0) },
    equipe: (Array.isArray(r.equipe) ? r.equipe : [])
      .slice(0, 30)
      .map((p) => ({ nome: normalizeName(String(p?.nome ?? "")).slice(0, 40), base: clamp(p?.base, 0, 1e8, 0) }))
      .filter((p) => p.nome),
  };
}

/** Médias do ano, só com os meses que tiveram faturamento (como a planilha). */
export function yearAverages(months: MonthResult[]) {
  const withRev = months.filter((m) => m.revenue > 0);
  const n = withRev.length;
  const sum = (f: (m: MonthResult) => number) => withRev.reduce((s, m) => s + f(m), 0);
  const revenue = sum((m) => m.revenue);
  return {
    n,
    avgRevenue: n ? revenue / n : 0,
    avgProfit: n ? sum((m) => m.profit) / n : 0,
    margin: revenue ? sum((m) => m.profit) / revenue : 0,
    variablePct: revenue ? sum((m) => m.variable) / revenue : 0,
    avgFixed: n ? sum((m) => m.fixed) / n : 0,
  };
}

export type ProLaboreOption = { keep: number; preserved: number; gross: number; inss: number; net: number; finalMargin: number; reading: string };
export function proLabore(avg: ReturnType<typeof yearAverages>, keep1: number, keep2: number) {
  const opt = (keep: number): ProLaboreOption => {
    const preserved = avg.avgRevenue * keep;
    const blocked = avg.n < MIN_HISTORY_MONTHS || avg.margin < keep1;
    const gross = blocked ? 0 : Math.max(0, avg.avgProfit - preserved);
    const inss = Math.min(gross, INSS_CEILING) * INSS_RATE;
    return {
      keep,
      preserved,
      gross,
      inss,
      net: Math.max(0, gross - inss),
      finalMargin: avg.avgRevenue ? (avg.avgProfit - gross) / avg.avgRevenue : 0,
      reading: avg.n < MIN_HISTORY_MONTHS ? "Aguarde mais histórico" : avg.margin < keep1 ? "Operação ainda não suporta" : gross === 0 ? "Sem espaço para pró-labore" : "Possível",
    };
  };
  const situation =
    avg.n < MIN_HISTORY_MONTHS
      ? { label: "Base ainda curta", tone: "warn" as const }
      : avg.margin < keep1
        ? { label: "Sem capacidade para pró-labore", tone: "bad" as const }
        : avg.margin > 0.3
          ? { label: "Margem muito alta, há espaço", tone: "info" as const }
          : avg.margin >= keep2
            ? { label: "Saudável e confortável", tone: "good" as const }
            : { label: "Saudável, mas justa", tone: "good" as const };
  return { option1: opt(keep1), option2: opt(keep2), situation };
}

/** Meta que paga o próprio prêmio: custos fixos ÷ (margem de contribuição − prêmio − lucro desejado). */
export function metaScenario(avg: ReturnType<typeof yearAverages>, lucro: number, premio: number) {
  const contribution = 1 - avg.variablePct - premio;
  const den = contribution - lucro;
  const needed = den <= 0 ? 0 : avg.avgFixed / den;
  return {
    contribution,
    needed,
    viable: den > 0,
    profit: needed * lucro,
    prize: needed * premio,
    growth: avg.avgRevenue ? Math.max(0, needed / avg.avgRevenue - 1) : 0,
  };
}

export function reserve(avgFixed: number, saved: number) {
  const min = avgFixed * 3, rec = avgFixed * 6;
  return {
    min,
    rec,
    months: avgFixed ? saved / avgFixed : 0,
    missingMin: Math.max(0, min - saved),
    missingRec: Math.max(0, rec - saved),
    status: saved >= rec && rec > 0 ? { label: "Reserva completa", tone: "good" as const } : saved >= min && min > 0 ? { label: "Mínimo protegido", tone: "info" as const } : { label: "Em construção", tone: "warn" as const },
  };
}
