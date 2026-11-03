import { useEffect, useRef, useState } from "react";
import { MONTHS, metaScenario, proLabore, reserve, yearAverages, type Settings } from "../../shared/dre";
import { api, ApiError, brl, pct } from "../lib";
import { toast, useStore } from "../store";
import { Icon, Link, Skeleton } from "../components/ui";

const TONE: Record<string, string> = { good: "b-good", warn: "b-warn", bad: "b-bad", info: "b-info", mute: "b-mute" };
const big = { fontFamily: "var(--f-display)", fontWeight: 800 } as const;

/* ---------- utilidades comuns ---------- */
function useSettings() {
  const { me, refreshMe } = useStore();
  const settings = me.salon!.settings;
  const save = async (patch: Partial<Settings>, msg?: string) => {
    try {
      await api("/settings", { method: "PUT", body: patch });
      await refreshMe();
      if (msg) toast(msg);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Não deu para salvar.");
    }
  };
  return { settings, save };
}

function YearPicker() {
  const { period, setPeriod } = useStore();
  const now = new Date().getFullYear();
  return (
    <div className="mpick" role="group" aria-label="Ano analisado">
      <button type="button" onClick={() => setPeriod({ year: period.year - 1, month: 12 })} aria-label="Ano anterior">{Icon.left}</button>
      <span>Ano de {period.year}</span>
      <button type="button" onClick={() => setPeriod({ year: period.year + 1, month: period.year + 1 === now ? new Date().getMonth() + 1 : 1 })} disabled={period.year >= now} aria-label="Próximo ano">{Icon.right}</button>
    </div>
  );
}

/** Campo de percentual que só salva ao sair do campo (ou Enter). */
function PctInput({ id, value, max, onCommit }: { id: string; value: number; max: number; onCommit: (v: number) => void }) {
  const fmt = (v: number) => String(+(v * 100).toFixed(2)).replace(".", ",");
  const [txt, setTxt] = useState(fmt(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setTxt(fmt(value));
    }
  }, [value]);
  const commit = () => {
    const n = parseFloat(txt.replace(",", "."));
    if (!(n >= 0 && n <= max * 100)) {
      toast(`Use um valor entre 0% e ${max * 100}%.`);
      setTxt(fmt(value));
      return;
    }
    if (Math.abs(n / 100 - value) > 1e-9) onCommit(n / 100);
  };
  return (
    <div className="pctin">
      <input className="inp num" id={id} inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value.replace(/[^\d.,]/g, ""))} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      <span aria-hidden="true">%</span>
    </div>
  );
}

function BaseNote({ n, year }: { n: number; year: number }) {
  return (
    <p className="hint" style={{ marginBottom: 14 }}>
      Base automática: média dos <b>{n} {n === 1 ? "mês" : "meses"}</b> com faturamento em {year}, vinda da sua DRE.
      {n === 0 && <> Ainda não há vendas lançadas neste ano. <Link to="/lancar">Lançar agora</Link></>}
    </p>
  );
}

/* ---------- Pró-labore ---------- */
export function ProLabore() {
  const { year, period } = useStore();
  const { settings, save } = useSettings();
  const head = (
    <div className="phead">
      <div className="t"><h1>Quanto você pode tirar de pró-labore</h1><p className="sub" style={{ maxWidth: "70ch" }}>Parte do lucro médio real da DRE e calcula quanto pode virar um pró-labore fixo sem o salão cair abaixo do lucro que você escolher.</p></div>
      <YearPicker />
    </div>
  );
  if (!year) return <div className="page">{head}<Skeleton h={420} /></div>;
  const avg = yearAverages(year.months);
  const { keep1, keep2 } = settings.proLabore;
  const r = proLabore(avg, keep1, keep2);
  const opts = [["Opção 1", "Maior pró-labore", r.option1], ["Opção 2", "Mais conservadora", r.option2]] as const;

  return (
    <div className="page">
      {head}
      <BaseNote n={avg.n} year={period.year} />
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><div className="k">Faturamento médio</div><div className="v num">{brl(avg.avgRevenue)}</div></div>
        <div className="kpi"><div className="k">Lucro médio antes do pró-labore</div><div className="v num">{brl(avg.avgProfit)}</div></div>
        <div className="kpi"><div className="k">Margem média</div><div className="v num">{avg.avgRevenue ? pct(avg.margin) : "—"}</div></div>
        <div className="kpi"><div className="k">Situação</div><div style={{ marginTop: 8 }}><span className={`badge ${TONE[r.situation.tone]}`}>{r.situation.label}</span></div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <b>Quanto o salão deve lucrar antes do seu pró-labore?</b>
        <p className="sub">Escolha as duas opções que quer comparar. A opção 1 também é o mínimo: se a margem média ficar abaixo dela, o app não recomenda pró-labore.</p>
        <div className="fieldrow" style={{ marginTop: 12 }}>
          <div><label className="l" htmlFor="kp1">Opção 1: lucro que fica no salão</label><PctInput id="kp1" value={keep1} max={0.5} onCommit={(v) => save({ proLabore: { keep1: v, keep2 } }, "Opção 1 atualizada.")} /></div>
          <div><label className="l" htmlFor="kp2">Opção 2: lucro que fica no salão</label><PctInput id="kp2" value={keep2} max={0.5} onCommit={(v) => save({ proLabore: { keep1, keep2: v } }, "Opção 2 atualizada.")} /></div>
        </div>
      </div>

      <div className="grid2">
        {opts.map(([t, sub, o], i) => (
          <div key={t} className="card" style={i === 0 ? { border: "2px solid var(--rose-fill)" } : undefined}>
            <div className="row"><div><b>{t}</b><div className="ks">{sub}</div></div><span className="badge b-rose">salão guarda {pct(o.keep)}</span></div>
            <div className="num" style={{ ...big, fontSize: 34, marginTop: 8 }}>{brl(o.gross)}</div>
            <div className="muted" style={{ fontSize: 14 }}>bruto por mês · <span className={`badge ${o.reading === "Possível" ? "b-good" : "b-warn"}`}>{o.reading}</span></div>
            <div className="kv">
              <span>INSS estimado (11%, até o teto)</span><span className="num">{brl(o.inss)}</span>
              <span>Líquido para você</span><span className="num">{brl(o.net)}</span>
              <span>Lucro mensal preservado no salão</span><span className="num">{brl(o.preserved)}</span>
              <span>Margem final do salão</span><span className="num">{avg.avgRevenue ? pct(o.finalMargin) : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ marginTop: 14, alignItems: "start" }}>
        <div className="card">
          <h3>Como ler</h3>
          <p className="sub" style={{ marginTop: 6 }}>
            {avg.n < 6
              ? "Ainda não há histórico suficiente para transformar o resultado em um salário fixo. São precisos pelo menos 6 meses com faturamento. Continue lançando."
              : avg.margin < keep1
                ? `O salão ainda não gera a margem mínima de ${pct(keep1)} antes do pró-labore. Agora a prioridade é fortalecer a operação, por isso as duas opções ficam zeradas.`
                : "A opção 1 calcula o maior pró-labore possível preservando o lucro mínimo. A opção 2 paga menos ao sócio e mantém mais lucro dentro do salão. Escolha pensando em estabilidade, caixa e numa remuneração compatível com a sua função."}
          </p>
          <p className="ks" style={{ marginTop: 10 }}>Exemplo: faturamento médio de R$ 100.000 com 15% de lucro (R$ 15.000). Guardando 10% no salão (R$ 10.000), cabem R$ 5.000 de pró-labore bruto. Guardando 12%, cabem R$ 3.000.</p>
        </div>
        <div className="card">
          <h3>Meses que formam a média</h3>
          <div className="tbl" style={{ marginTop: 6 }}>
            <table>
              <thead><tr><th>Mês</th><th className="r">Faturamento</th><th className="r">Lucro</th><th className="r">Margem</th></tr></thead>
              <tbody>
                {year.months.map((m, i) => (
                  <tr key={i} style={m.revenue ? undefined : { color: "var(--muted)" }}>
                    <td>{MONTHS[i]}</td><td className="r num">{m.revenue ? brl(m.revenue) : "—"}</td><td className="r num">{m.revenue ? brl(m.profit) : "—"}</td><td className="r num">{m.revenue ? pct(m.margin) : "fora"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Metas e prêmios ---------- */
export function Metas() {
  const { year, period } = useStore();
  const { settings, save } = useSettings();
  const [team, setTeam] = useState(settings.equipe);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setTeam(settings.equipe); }, [settings.equipe, dirty]);

  const head = (
    <div className="phead">
      <div className="t"><h1>Meta que paga o próprio prêmio</h1><p className="sub" style={{ maxWidth: "70ch" }}>A meta sai dos custos da sua DRE. Quanto maior o prêmio da equipe, maior o faturamento necessário para manter o lucro que você quer.</p></div>
      <YearPicker />
    </div>
  );
  if (!year) return <div className="page">{head}<Skeleton h={420} /></div>;
  const avg = yearAverages(year.months);
  const names = ["Sem meta", "Meta", "Super meta"];
  const sc = settings.meta.scenarios;
  const res = sc.map((s) => metaScenario(avg, s.lucro, s.premio));
  const setSc = (i: number, k: "lucro" | "premio", v: number) => save({ meta: { scenarios: sc.map((s, j) => (j === i ? { ...s, [k]: v } : s)) } });
  const totalBase = team.reduce((s, p) => s + p.base, 0);

  async function saveTeam() {
    await save({ equipe: team.filter((p) => p.nome.trim()) }, "Equipe salva.");
    setDirty(false);
  }

  return (
    <div className="page">
      {head}
      <BaseNote n={avg.n} year={period.year} />
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><div className="k">Faturamento médio</div><div className="v num">{brl(avg.avgRevenue)}</div></div>
        <div className="kpi"><div className="k">Custos variáveis médios</div><div className="v num">{avg.avgRevenue ? pct(avg.variablePct) : "—"}</div><div className="ks">Imposto, comissões e insumos</div></div>
        <div className="kpi"><div className="k">Custos fixos médios</div><div className="v num">{brl(avg.avgFixed)}</div></div>
        <div className="kpi"><div className="k">Margem de contribuição</div><div className="v num">{avg.avgRevenue ? pct(1 - avg.variablePct) : "—"}</div></div>
      </div>

      <div className="scen">
        {res.map((r, i) => (
          <div key={i} className={`card${i === 1 ? " hlcard" : ""}`}>
            <div className="row"><h3>{names[i]}</h3>{i > 0 && <span className="badge b-rose">prêmio {pct(sc[i].premio)}</span>}</div>
            <div className="fieldrow" style={{ marginTop: 12, gridTemplateColumns: "1fr 1fr" }}>
              <div><label className="l" htmlFor={`sl${i}`}>Lucro desejado</label><PctInput id={`sl${i}`} value={sc[i].lucro} max={0.6} onCommit={(v) => setSc(i, "lucro", v)} /></div>
              <div><label className="l" htmlFor={`sp${i}`}>Prêmio da equipe</label><PctInput id={`sp${i}`} value={sc[i].premio} max={0.3} onCommit={(v) => setSc(i, "premio", v)} /></div>
            </div>
            <div className="ks" style={{ marginTop: 14 }}>Faturamento necessário</div>
            <div className="num" style={{ ...big, fontSize: 30 }}>{r.viable ? brl(r.needed) : "Inviável"}</div>
            <div className="prog" style={{ margin: "10px 0 6px" }}><div style={{ width: `${r.needed ? Math.min(100, (avg.avgRevenue / r.needed) * 100) : 0}%` }} /></div>
            {r.viable ? (
              <div className="kv" style={{ marginTop: 8 }}>
                <span>Lucro preservado</span><span className="num">{brl(r.profit)}</span>
                <span>Prêmio total da equipe</span><span className="num">{brl(r.prize)}</span>
                <span>Crescimento vs média</span><span className="num">{pct(r.growth)}</span>
              </div>
            ) : <p className="sub">A margem não cobre o prêmio e o lucro desejado. Reduza um dos dois.</p>}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div><h3>Meta e prêmio de cada profissional</h3><p className="sub" style={{ maxWidth: "70ch" }}>Informe quanto cada profissional faturou num mês de referência. O peso dela na equipe divide a meta e o prêmio.</p></div>
          {dirty && <button className="cta" type="button" onClick={saveTeam}>Salvar equipe</button>}
        </div>
        <div className="team">
          {team.map((p, i) => (
            <div className="trow" key={i}>
              <input className="inp" aria-label="Nome da profissional" placeholder="Nome" value={p.nome} maxLength={40} onChange={(e) => { setDirty(true); setTeam(team.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x))); }} />
              <div className="money"><span className="pre" style={{ fontSize: 15 }}>R$</span><input className="inp num" aria-label="Faturamento no mês de referência" inputMode="decimal" value={p.base ? Math.round(p.base).toLocaleString("pt-BR") : ""} placeholder="0" onChange={(e) => { setDirty(true); const v = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0; setTeam(team.map((x, j) => (j === i ? { ...x, base: v } : x))); }} style={{ paddingLeft: 44 }} /></div>
              <button className="iconbtn" type="button" aria-label={`Remover ${p.nome || "profissional"}`} onClick={() => { setDirty(true); setTeam(team.filter((_, j) => j !== i)); }}>{Icon.x}</button>
            </div>
          ))}
          <button className="chip add" type="button" style={{ justifySelf: "start" }} onClick={() => { setDirty(true); setTeam([...team, { nome: "", base: 0 }]); }}>+ Adicionar profissional</button>
        </div>
        {team.some((p) => p.nome && p.base) && (
          <div className="tbl" style={{ marginTop: 16 }}>
            <table style={{ minWidth: 640 }}>
              <thead><tr><th>Profissional</th><th className="r">Peso</th><th className="r">Meta individual</th><th className="r">Prêmio na meta</th><th className="r">Super meta</th><th className="r">Prêmio na super meta</th></tr></thead>
              <tbody>
                {team.filter((p) => p.nome).map((p, i) => {
                  const w = totalBase ? p.base / totalBase : 0;
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{p.nome}</td><td className="r num">{pct(w)}</td>
                      <td className="r num">{res[1].viable ? brl(res[1].needed * w) : "—"}</td><td className="r num">{res[1].viable ? brl(res[1].prize * w) : "—"}</td>
                      <td className="r num">{res[2].viable ? brl(res[2].needed * w) : "—"}</td><td className="r num">{res[2].viable ? brl(res[2].prize * w) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Reserva ---------- */
export function Reserva() {
  const { year, period } = useStore();
  const { settings, save } = useSettings();
  const [txt, setTxt] = useState(settings.reserva.guardado ? settings.reserva.guardado.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "");
  const head = (
    <div className="phead">
      <div className="t"><h1>Reserva de segurança</h1><p className="sub" style={{ maxWidth: "70ch" }}>Calculada sobre o custo fixo médio do salão. A referência é ter de 3 a 6 meses de despesas fixas guardados.</p></div>
      <YearPicker />
    </div>
  );
  if (!year) return <div className="page">{head}<Skeleton h={360} /></div>;
  const avg = yearAverages(year.months);
  const saved = settings.reserva.guardado;
  const r = reserve(avg.avgFixed, saved);
  const commit = () => {
    const v = parseFloat(txt.replace(/\./g, "").replace(",", ".")) || 0;
    if (v !== saved) save({ reserva: { guardado: v } }, "Valor guardado atualizado.");
  };
  return (
    <div className="page">
      {head}
      <BaseNote n={avg.n} year={period.year} />
      <div className="grid2">
        <div className="card">
          <label className="l" htmlFor="rgG">Quanto já tenho guardado</label>
          <div className="money"><span className="pre">R$</span><input className="inp big num" id="rgG" inputMode="decimal" value={txt} placeholder="0" onChange={(e) => setTxt(e.target.value.replace(/[^\d.,]/g, ""))} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /></div>
          <div className="kv">
            <span>Custo fixo médio mensal</span><span className="num">{brl(avg.avgFixed)}</span>
            <span>Mínimo (3 meses)</span><span className="num">{brl(r.min)}</span>
            <span>Recomendado (6 meses)</span><span className="num">{brl(r.rec)}</span>
          </div>
        </div>
        <div className="card">
          <div className="row"><div className="ks" style={{ fontWeight: 700, fontSize: 13 }}>Meses protegidos</div><span className={`badge ${TONE[r.status.tone]}`}>{r.status.label}</span></div>
          <div className="num" style={{ ...big, fontSize: 36 }}>{r.months.toFixed(1).replace(".", ",")} de 6</div>
          <div style={{ display: "flex", gap: 4, margin: "12px 0" }} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const f = Math.max(0, Math.min(1, r.months - i)) * 100;
              return <div key={i} style={{ flex: 1, height: 12, borderRadius: 4, background: `linear-gradient(90deg,var(--rose-fill) ${f}%,var(--sunk) ${f}%)` }} />;
            })}
          </div>
          <p className="muted" style={{ fontSize: 14 }}>Faltam <b style={{ color: "var(--ink)" }}>{brl(r.missingMin)}</b> para o mínimo e <b style={{ color: "var(--ink)" }}>{brl(r.missingRec)}</b> para o recomendado.</p>
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <p className="hint">A reserva não inclui comissões, impostos ou produtos, porque esses custos caem junto com o faturamento numa crise. O foco é proteger a estrutura fixa do salão.</p>
        <p className="hint">Com os 6 meses completos, o que passar disso pode ser avaliado para retirada ou investimento, desde que impostos, dívidas, capital de giro e compromissos estejam cobertos.</p>
      </div>
    </div>
  );
}

/* ---------- menu "Mais" no celular ---------- */
export function Mais() {
  const items = [
    ["/pro-labore", "Pró-labore", "Quanto você pode tirar por mês"],
    ["/metas", "Metas e prêmios", "Meta que paga o prêmio da equipe"],
    ["/reserva", "Reserva", "Quantos meses de custo fixo estão protegidos"],
    ["/contas", "Plano de contas", "Categorias e grupos da DRE"],
    ["/ajustes", "Ajustes", "Salão, alíquota, plano e conta"],
  ];
  return (
    <div className="page">
      <div className="phead"><div className="t"><h1>Mais</h1></div></div>
      <div className="card" style={{ padding: "4px 14px" }}>
        {items.map(([to, t, s]) => (
          <Link key={to} to={to} className="eitem"><b>{t}</b><span className="muted">{Icon.right}</span><span className="ks">{s}</span></Link>
        ))}
      </div>
    </div>
  );
}
