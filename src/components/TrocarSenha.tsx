import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib";
import { toast } from "../store";

export default function TrocarSenha() {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setErr("");
    if (f.get("next") !== f.get("next2")) {
      setErr("As duas senhas novas estão diferentes.");
      return;
    }
    setBusy(true);
    try {
      await api("/me/password", { method: "POST", body: { current: f.get("current"), next: f.get("next") } });
      toast("Senha trocada.");
      setOpen(false);
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : "Não deu para trocar.");
    } finally {
      setBusy(false);
    }
  }
  if (!open) return <button className="ghost" type="button" onClick={() => setOpen(true)}>Trocar senha</button>;
  return (
    <form className="form" onSubmit={submit} noValidate style={{ marginTop: 12, width: "100%" }}>
      <div><label className="l" htmlFor="pwc">Senha atual</label><input className="inp" id="pwc" name="current" type="password" autoComplete="current-password" /></div>
      <div className="fieldrow">
        <div><label className="l" htmlFor="pwn">Nova senha</label><input className="inp" id="pwn" name="next" type="password" autoComplete="new-password" minLength={8} /></div>
        <div><label className="l" htmlFor="pwn2">Repita a nova senha</label><input className="inp" id="pwn2" name="next2" type="password" autoComplete="new-password" minLength={8} /></div>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ justifyContent: "flex-start" }}>
        <button className="cta" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
        <button className="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
