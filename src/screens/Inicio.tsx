import { useEffect, useState } from "react";
import { MONTHS, MONTHS_SHORT, health, kindOf } from "../../shared/dre";
import { api, brl, fmtDate, pct, type Entry } from "../lib";
import { useStore } from "../store";
import { Delta, Icon, Link, MonthPicker, Skeleton, Spark } from "../components/ui";

const TONE: Record<string, string> = { good: "b-good", warn: "b-warn", bad: "b-bad", info: "b-info", mute: "b-mute" };

export default function Inicio() {
  const { me, period, setPeriod, year, catMap, version } = useStore();
  const [recent, setRecent] = useState<Entry[] | null>(null);
  const ym = `${period.year}-${String(period.month).padStart(2, "0")}`;

  useEffect(() => {
    let alive = true;
    setRecent(null);
    api<{ entries: Entry[] }>(`/entries?month=${ym}&limit=5`).then((r) => alive && setRecent(r.entries)).catch(() => alive && setRecent([]));
    return () => { alive = false; };
  }, [ym, version]);

  const first = me.user?.name.split(" ")[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const monthName = MONTHS[period.month - 1];

  if (!year) {
    return (
      <div className="page">
        <Head hello={`${hello}, ${first}`} title={`Como foi ${monthName.toLowerCase()}`} />
        <div className="kpis kp4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={130} />)}</div>
        <div className="dstack"><Skeleton h={140} /><Skeleton h={300} /></div>
      </div>
    );
  }

  const i = period.month - 1;
  const c = year.months[i];
  const prev = i > 0 && year.months[i - 1].hasData ? year.months[i - 1] : null;
  const prevLabel = i > 0 ? MONTHS_SHORT[i - 1] : "";
  const anyData = year.months.some((m) => m.hasData);
  const upto = year.months.slice(0, i + 1).filter((m) => m.hasData);
  const hl = health(c.margin, c.revenue);

  if (!anyData) {
    return (
      <div className="page">
        <Head hello={`${hello}, ${first}`} title="Boas-vindas ao Além da Cadeira" />
        <div className="empty">
          <h3>Comece lançando o que entrou e o que saiu</h3>
          <p>Lance as vendas e as despesas com a data em que aconteceram. A data define o mês em que cada valor entra no resultado. O imposto é calculado sozinho pela alíquota (você ajusta em Ajustes).</p>
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <Link to="/lancar" className="cta">{Icon.plus} Fazer o primeiro lançamento</Link>
            <Link to="/contas" className="ghost">Ver o plano de contas</Link>
          </div>
        </div>
        {period.year === new Date().getFullYear() ? null : <p className="sub" style={{ marginTop: 12 }}>Não há lançamentos em {period.year}. Use as setas para trocar o mês.</p>}
        <div style={{ marginTop: 14 }}><MonthPicker /></div>
      </div>
    );
  }

  const cats = year.byCat[i];
  const ins = [...cats.entries()].filter(([id]) => catMap.get(id)?.group === "Receita").sort((a, b) => b[1] - a[1]);
  const outs = [...cats.entries()].filter(([id]) => catMap.get(id)?.group !== "Receita").sort((a, b) => b[1] - a[1]).slice(0, 6);

  const g = c.groups;
  const slices: [string, number, string][] = [
    ["Comissões", g["Comissões"], "var(--rose-strong)"],
    ["Equipe", g.Equipe, "var(--rose-fill)"],
    ["Estrutura", g.Estrutura, "var(--rose-mid)"],
    ["Insumos", g["Fornecedores/Insumos"], "var(--d4)"],
    ["Impostos", c.tax, "var(--d5)"],
    ["Outros custos", g.Marketing + g.Administrativo + g.Financeiro + g["Outras Despesas"], "var(--d6)"],
    ["Lucro", Math.max(0, c.profit), "var(--good)"],
  ];
  const sliceTotal = slices.reduce((s, x) => s + x[1], 0) || 1;
  let acc = 0;
  const stops = slices.map((s) => { const a = acc; acc += (s[1] / sliceTotal) * 100; return `${s[2]} ${a.toFixed(2)}% ${Math.min(100, acc).toFixed(2)}%`; }).join(",");
  const maxF = Math.max(1, ...year.months.map((m) => Math.max(m.revenue, m.out)));
  const gp = Math.max(0, Math.min(1, c.margin / 0.4));

  return (
    <div className="page">
      <Head hello={`${hello}, ${first}`} title={`Como foi ${monthName.toLowerCase()}`} />

      {!c.hasData && (
        <div className="hint rose" style={{ marginBottom: 14 }}>Ainda não há lançamentos em {monthName.toLowerCase()} de {period.year}. <Link to="/lancar">Lançar agora</Link></div>
      )}

      <div className="kpis kp4">
        <div className="kpi"><div className="k">Quanto entrou</div><div className="v num">{brl(c.revenue)}</div><Delta cur={c.revenue} prev={prev?.revenue ?? null} label={prevLabel} /><Spark values={upto.map((m) => m.revenue)} /><div className="ks">Serviços, produtos e outras receitas</div></div>
        <div className="kpi"><div className="k">Quanto saiu</div><div className="v num">{brl(c.out)}</div><Delta cur={c.out} prev={prev?.out ?? null} invert label={prevLabel} /><Spark values={upto.map((m) => m.out)} /><div className="ks">Já com imposto estimado de {pct(me.salon?.tax_rate ?? 0)}</div></div>
        <div className="kpi hl"><div className="k">Quanto sobrou</div><div className="v num">{brl(c.profit)}</div><Delta cur={c.profit} prev={prev?.profit ?? null} label={prevLabel} /><Spark values={upto.map((m) => m.profit)} /><div className="ks">Lucro líquido do mês</div></div>
        <div className="kpi"><div className="k">Lucratividade</div><div className="v num">{c.revenue ? pct(c.margin) : "—"}</div><Delta cur={c.margin} prev={prev && prev.revenue ? prev.margin : null} points label={prevLabel} /><Spark values={upto.filter((m) => m.revenue).map((m) => m.margin)} /><div className="ks">Quanto sobra de cada venda</div></div>
      </div>

      <div className="dstack">
        <div className="card">
          <div className="row">
            <div><h3>Termômetro do lucro</h3><p className="sub">No método, a faixa saudável vai de 10% a 30% de lucratividade.</p></div>
            <span className={`badge ${TONE[hl.tone]}`}>{hl.label}</span>
          </div>
          <div className="gtrack" role="img" aria-label={`Lucratividade de ${pct(c.margin)}, ${hl.label}`}>
            <div className="gz z1" style={{ width: "25%" }}>Abaixo</div>
            <div className="gz z2" style={{ width: "50%" }}>Saudável</div>
            <div className="gz z3" style={{ width: "25%" }}>Muito alto</div>
            {c.revenue > 0 && <div className="gmark" style={{ left: `${gp * 100}%` }}><span>{pct(c.margin)}</span></div>}
          </div>
          <div className="gscale" aria-hidden="true"><span style={{ left: 0 }}>0%</span><span style={{ left: "25%" }}>10%</span><span style={{ left: "75%" }}>30%</span><span style={{ left: "100%" }}>40%+</span></div>
        </div>

        <div className="dash2">
          <div className="card">
            <div className="row">
              <div><h3>Mês a mês em {period.year}</h3><p className="sub">Toque em um mês para ver os números dele.</p></div>
              <div className="legend"><span><i style={{ background: "var(--rose-mid)" }} />Entrou</span><span><i style={{ background: "var(--rose-fill)" }} />Sobrou</span></div>
            </div>
            <div className="tbl">
              <div style={{ minWidth: 520 }}>
                <div className="chart">
                  {year.months.map((m, k) => (
                    <button key={k} type="button" className={`col${k === i ? " sel" : ""}`} aria-pressed={k === i} onClick={() => setPeriod({ year: period.year, month: k + 1 })}
                      aria-label={`${MONTHS[k]}: entrou ${brl(m.revenue)}, sobrou ${brl(m.profit)}`}>
                      <span className="bar" style={{ height: `${(m.revenue / maxF) * 100}%`, background: "var(--rose-mid)" }} />
                      <span className="bar" style={{ height: `${(Math.max(0, m.profit) / maxF) * 100}%`, background: m.profit < 0 ? "var(--bad)" : "var(--rose-fill)" }} />
                    </button>
                  ))}
                </div>
                <div className="xl">{year.months.map((m, k) => <span key={k}>{MONTHS_SHORT[k]}<small className="num">{m.revenue ? Math.round(m.margin * 100) + "%" : "—"}</small></span>)}</div>
              </div>
            </div>
            <div className="msel">
              <b>{monthName}</b>
              <span>Entrou <b className="num">{brl(c.revenue)}</b></span>
              <span>Saiu <b className="num">{brl(c.out)}</b></span>
              <span>Sobrou <b className="num">{brl(c.profit)}</b></span>
              {c.revenue > 0 && <span className={`badge ${TONE[hl.tone]}`}>{pct(c.margin)} · {hl.label}</span>}
            </div>
          </div>

          <div className="card">
            <h3>Para onde foi o dinheiro</h3>
            <p className="sub">Grupos da DRE em % do faturamento do mês.</p>
            {c.revenue > 0 ? (
              <div className="donutwrap">
                <div className="donut" role="img" aria-label="Divisão do faturamento por grupo da DRE" style={{ background: `conic-gradient(${stops})` }}>
                  <div className="hole"><span><b className="num">{pct(c.margin)}</b>de lucratividade</span></div>
                </div>
                <div className="dleg">
                  {slices.map((s) => (
                    <div key={s[0]}><i style={{ background: s[2] }} /><span>{s[0]}</span><span className="p num">{pct(s[1] / c.revenue)}</span><span className="t num">{brl(s[1])}</span></div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="hint" style={{ marginTop: 14 }}>Lance as vendas do mês para ver a divisão.</p>
            )}
          </div>
        </div>

        <div className="grid2">
          <div className="card">
            <h3>De onde veio o dinheiro</h3>
            <p className="sub">Entradas por categoria do plano de contas.</p>
            {ins.length ? ins.map(([id, v]) => (
              <div className="hbar" key={id}><span>{catMap.get(id)?.name}</span><b className="num">{brl(v)} · {pct(v / (c.revenue || 1))}</b><div className="prog"><div style={{ width: `${(v / (c.revenue || 1)) * 100}%` }} /></div></div>
            )) : <p className="hint" style={{ marginTop: 12 }}>Nenhuma entrada neste mês.</p>}
          </div>
          <div className="card">
            <div className="row">
              <div><h3>Maiores gastos do mês</h3><p className="sub">As categorias que mais pesaram.</p></div>
              <Link to="/resultado" className="sbtn">Ver DRE completa</Link>
            </div>
            {outs.length ? outs.map(([id, v]) => {
              const cat = catMap.get(id);
              return (
                <div className="hbar" key={id}>
                  <span>{cat?.name}{cat && cat.group !== cat.name && <> <span className="badge b-mute">{cat.group}</span></>}</span>
                  <b className="num">{brl(v)}</b>
                  <div className="prog"><div style={{ width: `${(v / outs[0][1]) * 100}%` }} /></div>
                </div>
              );
            }) : <p className="hint" style={{ marginTop: 12 }}>Nenhuma despesa neste mês.</p>}
          </div>
        </div>

        <div className="card">
          <div className="row">
            <div><h3>Últimos lançamentos</h3><p className="sub">O que entrou e saiu mais recentemente em {monthName.toLowerCase()}.</p></div>
            <Link to="/lancamentos" className="sbtn">Ver todos</Link>
          </div>
          {recent === null ? <div style={{ marginTop: 12 }}><Skeleton h={160} /></div> : recent.length === 0 ? <p className="hint" style={{ marginTop: 12 }}>Nada lançado neste mês ainda.</p> : (
            <div style={{ marginTop: 8 }}>
              {recent.map((e) => {
                const isIn = kindOf(e.group) === "in";
                return (
                  <Link key={e.id} to={`/lancar/${e.id}`} className="eitem">
                    <b>{e.description}</b>
                    <b className={`num ${isIn ? "amt-in" : ""}`}>{isIn ? "+ " : "− "}{brl(e.amountCents / 100)}</b>
                    <span className="ks">{fmtDate(e.date)} · {e.categoryName}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Head({ hello, title }: { hello: string; title: string }) {
  return (
    <div className="phead">
      <div className="t"><p className="sub" style={{ margin: 0 }}>{hello}</p><h1>{title}</h1></div>
      <div className="row" style={{ gap: 10 }}>
        <MonthPicker />
        <Link to="/lancar" className="cta hide-m">{Icon.plus} Lançar venda ou despesa</Link>
      </div>
    </div>
  );
}
