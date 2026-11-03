import { useState, type FormEvent } from "react";
import { api, ApiError, fmtDate, type Me } from "../lib";
import { Logo } from "../components/ui";

export default function Suspenso({ me, onDone }: { me: Me; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = me.license?.state === "bloqueada";

  async function renew(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await api("/license/renew", { method: "POST", body: { code } });
      onDone();
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Não deu para renovar.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    onDone();
  }

  return (
    <div className="center" style={{ padding: 16, minHeight: "100dvh" }}>
      <div className="box page" style={{ width: "min(460px,100%)" }}>
        <Logo className="mlogo" />
        <div className="card form">
          <div>
            <span className={`badge ${blocked ? "b-bad" : "b-warn"}`}>{blocked ? "Acesso bloqueado" : "Plano vencido"}</span>
            <h1 style={{ marginTop: 10 }}>{blocked ? "O acesso do salão está pausado" : "Seu plano venceu"}</h1>
            <p className="sub" style={{ marginTop: 6 }}>
              {blocked
                ? "Fale com a Luize para liberar o acesso. Seus lançamentos continuam guardados."
                : `O acesso terminou em ${me.license?.expiresAt ? fmtDate(me.license.expiresAt.slice(0, 10)) : "—"}. Seus lançamentos continuam guardados: é só renovar com uma nova chave.`}
            </p>
          </div>
          {!blocked && (
            <form onSubmit={renew} noValidate className="form">
              <div>
                <label className="l" htmlFor="rk">Nova chave de ativação</label>
                <input className="inp keyinp" id="rk" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ADC-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} />
              </div>
              {err && <p className="err" role="alert">{err}</p>}
              <button className="cta" type="submit" disabled={busy || code.replace(/[^a-z0-9]/gi, "").length < 12}>{busy ? "Renovando…" : "Renovar e entrar"}</button>
            </form>
          )}
          <button className="linkbtn" type="button" onClick={logout}>Sair</button>
        </div>
      </div>
    </div>
  );
}
