import { useEffect, useMemo, useState } from "react";
import { MONTHS, kindOf } from "../../shared/dre";
import { api, brl2, fmtDate, fmtDay, type Entry } from "../lib";
import { navigate, useStore } from "../store";
import { Icon, Link, MonthPicker, Skeleton } from "../components/ui";

type Filter = "all" | "in" | "out";

export default function Lancamentos() {
  const { period, version, flashId, setFlashId } = useStore();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const ym = `${period.year}-${String(period.month).padStart(2, "0")}`;

  useEffect(() => {
    let alive = true;
    setEntries(null);
    api<{ entries: Entry[] }>(`/entries?month=${ym}&limit=500`).then((r) => alive && setEntries(r.entries)).catch(() => alive && setEntries([]));
    return () => { alive = false; };
  }, [ym, version]);

  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1800);
    return () => clearTimeout(t);
  }, [flashId, setFlashId]);

  const shown = useMemo(() => {
    if (!entries) return [];
    const term = q.trim().toLowerCase();
    return entries.filter((e) => (filter === "all" || kindOf(e.group) === filter) && (!term || `${e.description} ${e.categoryName} ${e.note || ""}`.toLowerCase().includes(term)));
  }, [entries, filter, q]);
  const totIn = shown.filter((e) => kindOf(e.group) === "in").reduce((s, e) => s + e.amountCents, 0) / 100;
  const totOut = shown.filter((e) => kindOf(e.group) === "out").reduce((s, e) => s + e.amountCents, 0) / 100;

  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of shown) m.set(e.date, [...(m.get(e.date) || []), e]);
    return [...m.entries()];
  }, [shown]);

  return (
    <div className="page">
      <div className="phead">
        <div className="t"><h1>Lançamentos</h1><p className="sub">Toque em um lançamento para editar ou apagar.</p></div>
        <div className="row" style={{ gap: 10 }}>
          <MonthPicker />
          <Link to="/lancar" className="cta hide-m">{Icon.plus} Novo</Link>
        </div>
      </div>

      <div className="filters">
        <div className="seg" role="group" aria-label="Filtrar" style={{ gridTemplateColumns: "repeat(3,auto)" }}>
          {([["all", "Tudo"], ["in", "Entradas"], ["out", "Saídas"]] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} style={{ padding: "0 16px", minHeight: 38 }}>{l}</button>
          ))}
        </div>
        <input className="inp search" type="search" placeholder="Buscar por descrição ou categoria" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
      </div>

      {entries === null ? <Skeleton h={320} /> : shown.length === 0 ? (
        <div className="empty">
          <h3>{entries.length ? "Nada encontrado com esse filtro" : `Nenhum lançamento em ${MONTHS[period.month - 1].toLowerCase()}`}</h3>
          <p>{entries.length ? "Tente outra busca ou mostre tudo." : "Lance as vendas e despesas deste mês para ver o resultado."}</p>
          {!entries.length && <Link to="/lancar" className="cta">{Icon.plus} Novo lançamento</Link>}
        </div>
      ) : (
        <>
          <div className="totbar">
            <span>{shown.length} lançamento{shown.length > 1 ? "s" : ""}</span>
            {filter !== "out" && <span>Entradas <b className="num amt-in">{brl2(totIn)}</b></span>}
            {filter !== "in" && <span>Saídas <b className="num">{brl2(totOut)}</b></span>}
            <span className="ks" style={{ alignSelf: "center" }}>O imposto aparece na DRE do mês.</span>
          </div>

          <div className="card etable" style={{ padding: "6px 12px" }}>
            <table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="r">Valor</th></tr></thead>
              <tbody>
                {shown.map((e) => {
                  const isIn = kindOf(e.group) === "in";
                  return (
                    <tr key={e.id} className={e.id === flashId ? "flash" : undefined} style={{ cursor: "pointer" }} onClick={() => navigate(`/lancar/${e.id}`)}>
                      <td className="num muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
                      <td style={{ fontWeight: 700 }}>
                        <Link to={`/lancar/${e.id}`} className="" aria-label={`Editar ${e.description}`}><span style={{ color: "var(--ink)", textDecoration: "none" }}>{e.description}</span></Link>
                        {e.note && <div className="ks">{e.note}</div>}
                      </td>
                      <td><span className="badge b-rose">{e.categoryName}</span></td>
                      <td className={`r num ${isIn ? "amt-in" : ""}`} style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{isIn ? "+ " : "− "}{brl2(e.amountCents / 100)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="elist">
            {byDay.map(([day, list]) => (
              <section key={day}>
                <div className="daysep">{fmtDay(day)}</div>
                <div className="card" style={{ padding: "4px 12px" }}>
                  {list.map((e) => {
                    const isIn = kindOf(e.group) === "in";
                    return (
                      <Link key={e.id} to={`/lancar/${e.id}`} className={`eitem${e.id === flashId ? " flash" : ""}`}>
                        <b>{e.description}</b>
                        <b className={`num ${isIn ? "amt-in" : ""}`}>{isIn ? "+ " : "− "}{brl2(e.amountCents / 100)}</b>
                        <span className="ks">{e.categoryName}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
