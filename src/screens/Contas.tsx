import { useState, type FormEvent } from "react";
import { DRE_GROUPS, GROUP_LABEL, kindOf, type DreGroup } from "../../shared/dre";
import { api, ApiError, type Category } from "../lib";
import { toast, useStore } from "../store";
import { Icon, Skeleton } from "../components/ui";

const P = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const };
const plus = <svg width="14" height="14" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

export default function Contas() {
  const { categories, refreshCategories } = useStore();
  const [name, setName] = useState("");
  const [group, setGroup] = useState<DreGroup>("Estrutura");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showOff, setShowOff] = useState(true);

  async function toggle(c: Category, active: boolean) {
    try {
      await api(`/categories/${c.id}`, { method: "PATCH", body: { active } });
      await refreshCategories();
      toast(active ? `"${c.name}" ativada. Já aparece em Novo lançamento.` : `"${c.name}" desligada. Os lançamentos antigos continuam no resultado.`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Não deu para mudar.");
    }
  }
  async function removeManual(c: Category) {
    if (c.uses > 0) return toggle(c, false);
    try {
      await api(`/categories/${c.id}`, { method: "DELETE" });
      await refreshCategories();
      toast(`"${c.name}" apagada.`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Não deu para apagar.");
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (name.trim().length < 2) {
      setErr("Escreva o nome da categoria.");
      return;
    }
    setBusy(true);
    try {
      await api("/categories", { method: "POST", body: { name, group } });
      await refreshCategories();
      toast(`Categoria "${name.trim()}" criada em ${GROUP_LABEL[group]}. Ela já aparece em Novo lançamento.`);
      setName("");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Não deu para criar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="phead">
        <div className="t">
          <h1>Plano de contas</h1>
          <p className="sub" style={{ maxWidth: "70ch" }}>Cada categoria está ligada a um grupo da DRE. As tracejadas são sugestões mais detalhadas: toque no + para usar. Movimentos que não são resultado (empréstimos, aportes, investimentos, transferências entre contas) ficam fora da DRE.</p>
        </div>
        <label className="row" style={{ gap: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          <input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--rose-fill)" }} />
          Mostrar sugestões e desligadas
        </label>
      </div>

      {!categories.length ? <Skeleton h={400} /> : (
        <div className="groups">
          {DRE_GROUPS.flatMap((g) => {
            const list = categories.filter((c) => c.group === g && (showOff || c.active));
            const card = (
              <div className="grp" key={g}>
                <h3><span>{GROUP_LABEL[g]}</span><span className="badge b-mute">{kindOf(g) === "in" ? "entrada" : "saída"}</span></h3>
                <ul>
                  {list.map((c) => (
                    <li key={c.id} className={`pc${!c.active ? " off" : c.source === "manual" ? " man" : ""}`}>
                      {c.name}
                      {!c.active ? (
                        <button type="button" onClick={() => toggle(c, true)} aria-label={`Ativar ${c.name}`} title="Ativar">{plus}</button>
                      ) : c.source === "manual" ? (
                        <button type="button" onClick={() => removeManual(c)} aria-label={c.uses ? `Desligar ${c.name}` : `Apagar ${c.name}`} title={c.uses ? "Desligar" : "Apagar"}>{Icon.x}</button>
                      ) : (
                        <button type="button" onClick={() => toggle(c, false)} aria-label={`Desligar ${c.name}`} title="Desligar">{Icon.x}</button>
                      )}
                    </li>
                  ))}
                  {!list.length && <li className="ks">Nenhuma categoria ativa.</li>}
                </ul>
              </div>
            );
            if (g !== "Receita") return [card];
            return [card, (
              <div className="grp" key="impostos">
                <h3><span>Impostos</span><span className="badge b-mute">automático</span></h3>
                <ul><li className="pc" style={{ paddingRight: 12 }}>Impostos (automático)</li></ul>
                <p className="ks" style={{ marginTop: 10 }}>Não lance o DAS. O app calcula o imposto do mês pela alíquota em Ajustes.</p>
              </div>
            )];
          })}
        </div>
      )}

      <form className="card inline" onSubmit={add} noValidate style={{ marginTop: 16, borderStyle: "solid", borderColor: "var(--line)" }}>
        <div>
          <label className="l" htmlFor="acName">Nova categoria</label>
          <input className="inp" id="acName" maxLength={40} placeholder="Ex.: Uniformes da equipe" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="l" htmlFor="acGroup">Entra na DRE como</label>
          <select className="inp" id="acGroup" value={group} onChange={(e) => setGroup(e.target.value as DreGroup)}>
            {DRE_GROUPS.map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
          </select>
        </div>
        <button className="cta" type="submit" disabled={busy}>Adicionar categoria</button>
        {err && <p className="err" role="alert" style={{ gridColumn: "1 / -1" }}>{err}</p>}
      </form>
    </div>
  );
}
