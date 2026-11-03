import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { GROUP_LABEL, MONTHS, OUT_GROUPS, kindOf, parseMoneyToCents, type DreGroup, type Kind } from "../../shared/dre";
import { api, ApiError, brl2, centsToInput, todayIso, type Entry } from "../lib";
import { navigate, toast, useStore } from "../store";
import { Confirm, Icon, Link, Skeleton } from "../components/ui";

export default function Lancar({ id }: { id?: string }) {
  const { categories, refreshCategories, lastDate, setLastDate, bump, setPeriod, setFlashId, me } = useStore();
  const [loaded, setLoaded] = useState(!id);
  const [kind, setKind] = useState<Kind>("in");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(lastDate || todayIso());
  const [catId, setCatId] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const again = useRef(false);

  useEffect(() => {
    if (!id) amountRef.current?.focus({ preventScroll: true });
  }, [id]);

  // carrega o lançamento para editar
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const r = await api<{ entry: Entry | null }>(`/entries/${id}`).catch(() => ({ entry: null }));
        const e = r.entry;
        if (!alive) return;
        if (!e) {
          toast("Lançamento não encontrado.");
          navigate("/lancamentos", true);
          return;
        }
        setKind(kindOf(e.group));
        setAmount(centsToInput(e.amountCents));
        setDate(e.date);
        setCatId(e.categoryId);
        setDesc(e.description === e.categoryName ? "" : e.description);
        setNote(e.note || "");
        setLoaded(true);
      } catch {
        navigate("/lancamentos", true);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const list = useMemo(
    () => categories.filter((c) => (c.active || c.id === catId) && kindOf(c.group) === kind),
    [categories, kind, catId],
  );
  useEffect(() => {
    if (!list.length) return;
    if (!list.some((c) => c.id === catId)) setCatId(list[0].id);
  }, [list, catId]);
  const cat = categories.find((c) => c.id === catId);
  const cents = parseMoneyToCents(amount);
  const month = /^\d{4}-\d{2}/.test(date) ? `${MONTHS[+date.slice(5, 7) - 1]?.toLowerCase()} de ${date.slice(0, 4)}` : "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!(cents > 0)) {
      setErr("Digite um valor maior que zero.");
      amountRef.current?.focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErr("Escolha a data do lançamento.");
      return;
    }
    if (!cat) {
      setErr("Escolha uma categoria.");
      return;
    }
    setBusy(true);
    try {
      const body = { date, amountCents: cents, categoryId: cat.id, description: desc.trim() || cat.name, note };
      const r = id
        ? await api<{ entry: Entry }>(`/entries/${id}`, { method: "PATCH", body })
        : await api<{ entry: Entry }>("/entries", { method: "POST", body });
      setLastDate(date);
      setFlashId(r.entry.id);
      bump();
      const y = +date.slice(0, 4), m = +date.slice(5, 7);
      setPeriod({ year: y, month: m });
      if (id) {
        toast("Lançamento atualizado.");
        navigate("/lancamentos");
      } else if (again.current) {
        toast(`Lançado em ${MONTHS[m - 1].toLowerCase()}. Pode lançar o próximo.`);
        setAmount("");
        setDesc("");
        setNote("");
        amountRef.current?.focus();
      } else {
        toast(`Lançado! Entra no resultado de ${MONTHS[m - 1].toLowerCase()}.`);
        navigate("/");
      }
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Não deu para salvar. Tente de novo.");
    } finally {
      setBusy(false);
      again.current = false;
    }
  }

  async function remove(ok: boolean) {
    setAskDelete(false);
    if (!ok || !id) return;
    try {
      await api(`/entries/${id}`, { method: "DELETE" });
      bump();
      toast("Lançamento apagado.");
      navigate("/lancamentos");
    } catch (ex) {
      toast(ex instanceof ApiError ? ex.message : "Não deu para apagar.");
    }
  }

  if (!loaded || !categories.length) {
    return <div className="page"><h1 style={{ marginBottom: 16 }}>{id ? "Editar lançamento" : "Novo lançamento"}</h1><Skeleton h={420} /></div>;
  }

  return (
    <div className="page">
      <div className="phead">
        <div className="t">
          <h1>{id ? "Editar lançamento" : "Novo lançamento"}</h1>
          <p className="sub">{id ? "Mude o que precisar e salve." : "Valor, data e categoria. O resto o app faz."}</p>
        </div>
        {id && <Link to="/lancamentos" className="ghost">Voltar</Link>}
      </div>

      <div className="formwrap">
        <form className="form" onSubmit={submit} noValidate>
          <div className="seg" role="group" aria-label="Tipo de lançamento">
            <button type="button" className="in" aria-pressed={kind === "in"} onClick={() => setKind("in")}>Entrou dinheiro</button>
            <button type="button" aria-pressed={kind === "out"} onClick={() => setKind("out")}>Saiu dinheiro</button>
          </div>

          <div className="fieldrow">
            <div>
              <label className="l" htmlFor="lfV">Valor</label>
              <div className="money">
                <span className="pre" aria-hidden="true">R$</span>
                <input ref={amountRef} className="inp big num" id="lfV" inputMode="decimal" autoComplete="off" placeholder="0,00" value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} aria-describedby="lfVh" />
              </div>
              <p className="ks" id="lfVh" style={{ marginTop: 4 }}>{cents > 0 ? brl2(cents / 100) : amount ? "Valor inválido. Ex.: 1.250,00" : "Use vírgula para os centavos."}</p>
            </div>
            <div>
              <label className="l" htmlFor="lfDt">Data do lançamento</label>
              <input className="inp num" id="lfDt" type="date" value={date} min="2000-01-01" max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
              <p className="ks" style={{ marginTop: 4 }}>Entra no resultado de <b>{month}</b>.</p>
            </div>
          </div>

          <div>
            <span className="l" id="catl">{kind === "in" ? "De onde veio" : "Com o que gastou"}</span>
            <div className="chips" role="group" aria-labelledby="catl">
              {list.map((c) => (
                <button key={c.id} type="button" className="chip" aria-pressed={c.id === catId} onClick={() => setCatId(c.id)}>{c.name}</button>
              ))}
              <button type="button" className="chip add" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>+ Nova categoria</button>
            </div>
            {adding && (
              <NewCategory kind={kind} onCreated={async (newId) => { await refreshCategories(); setCatId(newId); setAdding(false); }} />
            )}
          </div>

          <div>
            <label className="l" htmlFor="lfD">Descrição (opcional)</label>
            <input className="inp" id="lfD" maxLength={120} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === "in" ? "Ex.: vendas do dia" : "Ex.: conta de luz"} />
          </div>

          <details>
            <summary className="l" style={{ cursor: "pointer" }}>Observação (opcional)</summary>
            <textarea className="inp" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Observação" />
          </details>

          {cat && <p className="hint rose">Esta categoria entra na DRE como <b>{GROUP_LABEL[cat.group]}</b>.</p>}

          {err && <p className="err" role="alert">{err}</p>}
          <div className="row" style={{ justifyContent: "flex-start" }}>
            <button className="cta" type="submit" disabled={busy}>{busy ? "Salvando…" : id ? "Salvar alterações" : "Salvar lançamento"}</button>
            {!id && <button className="ghost" type="submit" disabled={busy} onClick={() => { again.current = true; }}>Salvar e lançar outro</button>}
            {id && <button className="ghost danger" type="button" onClick={() => setAskDelete(true)}>Apagar</button>}
          </div>
        </form>

        <aside className="aside card">
          <h3>Como lançar certo</h3>
          <div className="kv" style={{ gridTemplateColumns: "1fr" }}>
            {kind === "in" ? (
              <>
                <p>Use a data em que a venda aconteceu, mesmo que receba parcelado.</p>
                <p>O imposto é calculado sozinho: {((me.salon?.tax_rate ?? 0) * 100).toFixed(1).replace(".", ",")}% sobre o faturamento do mês.</p>
              </>
            ) : (
              <>
                <p>Use o mês a que a despesa pertence, mesmo que pague parcelado.</p>
                <p>Não lance o DAS: o app já desconta o imposto pela alíquota.</p>
                <p>Empréstimos, aportes e transferências entre contas não são resultado e ficam fora da DRE.</p>
              </>
            )}
          </div>
        </aside>
      </div>
      <Confirm open={askDelete} title="Apagar este lançamento?" text="Ele sai do resultado do mês. Não dá para desfazer." okLabel="Apagar" danger onClose={remove} />
    </div>
  );
}

export function NewCategory({ kind, onCreated }: { kind: Kind; onCreated: (id: string) => void }) {
  const groups: DreGroup[] = kind === "in" ? ["Receita"] : OUT_GROUPS;
  const [name, setName] = useState("");
  const [group, setGroup] = useState<DreGroup>(groups[0]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    setErr("");
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/categories", { method: "POST", body: { name, group } });
      toast(`Categoria "${name.trim()}" criada.`);
      onCreated(r.id);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Não deu para criar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="inline">
      <div>
        <label className="l" htmlFor="ncN">Nome da categoria</label>
        <input className="inp" id="ncN" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Uniformes da equipe"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } }} autoFocus />
      </div>
      <div>
        <label className="l" htmlFor="ncG">Entra na DRE como</label>
        <select className="inp" id="ncG" value={group} onChange={(e) => setGroup(e.target.value as DreGroup)} disabled={groups.length === 1}>
          {groups.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
      </div>
      <button className="cta" type="button" disabled={busy || name.trim().length < 2} onClick={create}>{Icon.check} Criar</button>
      {err && <p className="err" role="alert" style={{ gridColumn: "1 / -1" }}>{err}</p>}
    </div>
  );
}
