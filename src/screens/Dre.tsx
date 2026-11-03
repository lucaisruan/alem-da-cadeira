import type { ReactNode } from "react";
import { FIXED_GROUPS, GROUP_LABEL, MONTHS, MONTHS_SHORT, health, type DreGroup } from "../../shared/dre";
import { brl, pct } from "../lib";
import { useStore } from "../store";
import { Delta, Link, MonthPicker, Skeleton } from "../components/ui";

const TONE: Record<string, string> = { good: "b-good", warn: "b-warn", bad: "b-bad", info: "b-info", mute: "b-mute" };

export default function Dre() {
  const { period, year, catMap, me } = useStore();
  const monthName = MONTHS[period.month - 1];

  const head = (
    <div className="phead">
      <div className="t"><h1>DRE de {monthName.toLowerCase()}</h1><p className="sub">Toque em cada grupo para ver as categorias do plano de contas.</p></div>
      <MonthPicker />
    </div>
  );
  if (!year) return <div className="page">{head}<Skeleton h={120} /><div style={{ height: 14 }} /><Skeleton h={480} /></div>;

  const i = period.month - 1;
  const c = year.months[i];
  const prev = i > 0 && year.months[i - 1].hasData ? year.months[i - 1] : null;
  const prevLabel = i > 0 ? MONTHS_SHORT[i - 1] : "";
  const cats = year.byCat[i];
  const base = c.revenue || 1;
  const taxRate = me.salon?.tax_rate ?? 0;
  const biggestOut = Math.max(1, c.tax, ...(["Comissões", "Fornecedores/Insumos", ...FIXED_GROUPS] as DreGroup[]).map((g) => c.groups[g]));
  const hl = health(c.margin, c.revenue);

  const cells = (label: string, val: number, w: number, delta: ReactNode) => (
    <>
      <span className="nm">{label}</span>
      <span className="num r" style={{ fontWeight: 700 }}>{brl(val)}</span>
      <span className="bar6"><i style={{ width: `${Math.max(0, Math.min(100, w))}%` }} /></span>
      <span className="num r">{c.revenue ? pct(val / base) : "—"}</span>
      <span className="dlc r">{delta}</span>
    </>
  );

  const grp = (group: DreGroup | "Impostos", val: number, prevVal: number | null) => {
    const isIn = group === "Receita";
    const label = group === "Impostos" ? "Impostos (automático)" : GROUP_LABEL[group];
    const items = group === "Impostos" ? [] : [...cats.entries()].filter(([id]) => catMap.get(id)?.group === group).sort((a, b) => b[1] - a[1]);
    return (
      <details key={group}>
        <summary className="drow">{cells((isIn ? "" : "(−) ") + label, val, isIn ? 100 : (val / biggestOut) * 100, <Delta cur={val} prev={prevVal} invert={!isIn} label={prevLabel} />)}</summary>
        <div className="dsub">
          {group === "Impostos" ? (
            <div><span>Calculado sozinho: faturamento × {pct(taxRate)}. O DAS pago no mês seguinte não é lançado. <Link to="/ajustes">Mudar alíquota</Link></span></div>
          ) : items.length ? items.map(([id, v]) => (
            <div key={id}><span>{catMap.get(id)?.name}</span><span className="num r">{brl(v)}</span><span className="num r">{pct(v / (val || 1))} do grupo</span></div>
          )) : <div><span>Nada lançado neste grupo.</span></div>}
        </div>
      </details>
    );
  };
  const tot = (label: string, val: number, prevVal: number | null, cls = "") => (
    <div className={`drow dtot ${cls}`}>{cells(label, val, (val / base) * 100, <Delta cur={val} prev={prevVal} label={prevLabel} />)}</div>
  );

  return (
    <div className="page">
      {head}
      {!c.hasData && <div className="hint rose" style={{ marginBottom: 14 }}>Nenhum lançamento em {monthName.toLowerCase()} de {period.year}. <Link to="/lancar">Lançar agora</Link></div>}

      <div className="flow">
        <div className="fstep"><div className="k">Faturamento</div><div className="v num">{brl(c.revenue)}</div><div className="ks">100% do que entrou</div></div>
        <div className="fop">menos custos variáveis<b className="num">− {brl(c.variable)}</b></div>
        <div className="fstep"><div className="k">Margem de contribuição</div><div className="v num">{brl(c.contribution)}</div><div className="ks">{c.revenue ? pct(c.contribution / base) : "—"} do faturamento</div></div>
        <div className="fop">menos custos fixos<b className="num">− {brl(c.fixed)}</b></div>
        <div className={`fstep last${c.profit < 0 ? " neg" : ""}`}><div className="k">Lucro líquido</div><div className="v num">{brl(c.profit)}</div><div className="ks">{c.revenue ? pct(c.margin) + " do faturamento" : "—"}</div></div>
      </div>

      <div className="dre">
        <div className="drow dhead"><span className="nm">Grupo da DRE</span><span className="r">Valor</span><span className="bar6" style={{ background: "transparent" }} /><span className="r">% fat.</span><span className="dlc r">vs {prevLabel || "mês anterior"}</span></div>
        {grp("Receita", c.revenue, prev?.revenue ?? null)}
        {grp("Impostos", c.tax, prev?.tax ?? null)}
        {grp("Comissões", c.groups["Comissões"], prev?.groups["Comissões"] ?? null)}
        {grp("Fornecedores/Insumos", c.groups["Fornecedores/Insumos"], prev?.groups["Fornecedores/Insumos"] ?? null)}
        {tot("= Margem de contribuição", c.contribution, prev?.contribution ?? null)}
        {FIXED_GROUPS.map((g) => grp(g, c.groups[g], prev?.groups[g] ?? null))}
        {tot("= Lucro líquido", c.profit, prev?.profit ?? null, `lucro${c.profit < 0 ? " neg" : ""}`)}
      </div>

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card"><div className="k muted" style={{ fontSize: 13, fontWeight: 700 }}>Custos variáveis</div><div className="num" style={{ fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 800 }}>{c.revenue ? pct(c.variable / base) : "—"}</div><p className="sub">Imposto, comissões e insumos. Sobem e descem junto com as vendas.</p></div>
        <div className="card"><div className="k muted" style={{ fontSize: 13, fontWeight: 700 }}>Custos fixos</div><div className="num" style={{ fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 800 }}>{brl(c.fixed)}</div><p className="sub">Equipe, estrutura, marketing, administrativo, financeiro e outras. Existem mesmo num mês fraco.</p></div>
        <div className="card"><div className="row"><div className="k muted" style={{ fontSize: 13, fontWeight: 700 }}>Lucratividade</div><span className={`badge ${TONE[hl.tone]}`}>{hl.label}</span></div><div className="num" style={{ fontFamily: "var(--f-display)", fontSize: 26, fontWeight: 800 }}>{c.revenue ? pct(c.margin) : "—"}</div><p className="sub">A faixa saudável do método vai de 10% a 30%.</p></div>
      </div>
    </div>
  );
}
