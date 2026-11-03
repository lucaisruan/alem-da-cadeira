import { useState, type FormEvent } from "react";
import { api, ApiError, fmtDate, toggleTheme } from "../lib";
import { toast, useStore } from "../store";
import { Icon } from "../components/ui";
import TrocarSenha from "../components/TrocarSenha";

const PLAN: Record<string, string> = { mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };

export default function Ajustes() {
  const { me, refreshMe, bump } = useStore();
  const [name, setName] = useState(me.salon?.name || "");
  const [city, setCity] = useState(me.salon?.city || "");
  const [tax, setTax] = useState(((me.salon?.tax_rate ?? 0.067) * 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [code, setCode] = useState("");
  const [kErr, setKErr] = useState("");

  const lic = me.license;
  const days = lic?.expiresAt ? Math.ceil((new Date(lic.expiresAt).getTime() - Date.now()) / 86400000) : 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const t = parseFloat(tax.replace(",", "."));
    if (!(t >= 0 && t <= 40)) {
      setErr("A alíquota precisa ficar entre 0% e 40%.");
      return;
    }
    setBusy(true);
    try {
      await api("/salon", { method: "PATCH", body: { name, city, taxRate: t / 100 } });
      await refreshMe();
      bump();
      toast("Ajustes salvos. Os resultados já usam a nova alíquota.");
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Não deu para salvar.");
    } finally {
      setBusy(false);
    }
  }
  async function renew(e: FormEvent) {
    e.preventDefault();
    setKErr("");
    try {
      await api("/license/renew", { method: "POST", body: { code } });
      await refreshMe();
      setCode("");
      toast("Plano renovado!");
    } catch (ex) {
      setKErr(ex instanceof ApiError ? ex.message : "Não deu para renovar.");
    }
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    history.replaceState(null, "", "/");
    window.dispatchEvent(new CustomEvent("adc:auth"));
  }

  return (
    <div className="page">
      <div className="phead"><div className="t"><h1>Ajustes</h1><p className="sub">Dados do salão, imposto e plano.</p></div></div>
      <div className="grid2" style={{ alignItems: "start" }}>
        <form className="card form" onSubmit={save} noValidate>
          <h3>Seu salão</h3>
          <div><label className="l" htmlFor="sN">Nome do salão</label><input className="inp" id="sN" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="l" htmlFor="sC">Cidade</label><input className="inp" id="sC" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Belo Horizonte" /></div>
          <div>
            <label className="l" htmlFor="sT">Alíquota de imposto (%)</label>
            <input className="inp num" id="sT" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value.replace(/[^\d.,]/g, ""))} style={{ maxWidth: 160 }} />
            <p className="ks" style={{ marginTop: 6 }}>É a alíquota estimada do seu imposto (ex.: 6,7% no Simples). O app calcula o imposto do mês sobre o faturamento, por isso o DAS não é lançado.</p>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <div><button className="cta" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar ajustes"}</button></div>
        </form>

        <div style={{ display: "grid", gap: 14 }}>
          <div className="card">
            <div className="row"><h3>Seu plano</h3><span className={`badge ${days <= 15 ? "b-warn" : "b-good"}`}>{days <= 15 ? `Vence em ${days} dia${days === 1 ? "" : "s"}` : "Ativo"}</span></div>
            <div className="kv">
              <span>Plano</span><span>{PLAN[lic?.plan || ""] || lic?.plan}</span>
              <span>Acesso liberado até</span><span className="num">{lic?.expiresAt ? fmtDate(lic.expiresAt.slice(0, 10)) : "—"}</span>
            </div>
            <form onSubmit={renew} noValidate style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <label className="l" htmlFor="rk" style={{ margin: 0 }}>Renovar com uma nova chave</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="inp keyinp" id="rk" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ADC-XXXX-XXXX-XXXX" style={{ flex: "1 1 220px" }} autoComplete="off" spellCheck={false} />
                <button className="ghost" type="submit" disabled={code.replace(/[^a-z0-9]/gi, "").length < 12}>Renovar</button>
              </div>
              <p className="ks">O tempo da nova chave soma ao que ainda falta.</p>
              {kErr && <p className="err" role="alert">{kErr}</p>}
            </form>
          </div>

          <div className="card">
            <h3>Sua conta</h3>
            <div className="kv"><span>Nome</span><span>{me.user?.name}</span><span>E-mail</span><span style={{ wordBreak: "break-all" }}>{me.user?.email}</span></div>
            <div className="row" style={{ marginTop: 16, justifyContent: "flex-start" }}>
              <TrocarSenha />
              <button className="ghost" type="button" onClick={toggleTheme}>{Icon.moon} Modo claro/escuro</button>
              <button className="ghost danger" type="button" onClick={logout}>{Icon.out} Sair</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
