import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib";
import { Logo } from "../components/ui";

const PLAN_LABEL: Record<string, string> = { mensal: "mensal (1 mês)", trimestral: "trimestral (3 meses)", semestral: "semestral (6 meses)", anual: "anual (12 meses)" };

export default function Auth({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "key" | "account">(new URLSearchParams(location.search).get("chave") ? "key" : "login");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(new URLSearchParams(location.search).get("chave") || "");
  const [plan, setPlan] = useState("");

  async function run(fn: () => Promise<void>) {
    setErr("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const login = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(async () => {
      await api("/auth/login", { method: "POST", body: { email: f.get("email"), password: f.get("password") } });
      history.replaceState(null, "", "/");
      onDone();
    });
  };
  const checkKey = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ code: string; plan: string }>("/auth/check-key", { method: "POST", body: { code } });
      setCode(r.code);
      setPlan(r.plan);
      setMode("account");
    });
  };
  const activate = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) {
      setErr("As duas senhas estão diferentes.");
      return;
    }
    run(async () => {
      await api("/auth/activate", {
        method: "POST",
        body: { code, salonName: f.get("salonName"), name: f.get("name"), email: f.get("email"), password: f.get("password") },
      });
      history.replaceState(null, "", "/");
      onDone();
    });
  };

  return (
    <div className="auth">
      <section className="brandside" aria-hidden="true">
        <div>
          <Logo className="logo" />
          <h2>Saiba quanto o seu salão <em>realmente</em> lucra.</h2>
          <p className="lead">Lance vendas e despesas em segundos e veja na hora quanto entrou, quanto saiu e quanto sobrou, com a DRE do método Além da Cadeira.</p>
        </div>
        <p className="sig">Método de gestão para salões · por Luize Freire</p>
      </section>

      <section className="formside">
        <div className="box page" key={mode}>
          <Logo className="mlogo" />
          {mode === "login" && (
            <form className="form" onSubmit={login} noValidate>
              <div>
                <h1>Entrar</h1>
                <p className="sub">Use o e-mail e a senha que você criou na ativação.</p>
              </div>
              <div>
                <label className="l" htmlFor="em">E-mail</label>
                <input className="inp" id="em" name="email" type="email" autoComplete="email" inputMode="email" required />
              </div>
              <div>
                <label className="l" htmlFor="pw">Senha</label>
                <input className="inp" id="pw" name="password" type="password" autoComplete="current-password" required />
              </div>
              {err && <p className="err" role="alert">{err}</p>}
              <button className="cta" type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
              <p className="hint">Primeiro acesso? <button type="button" className="linkbtn" onClick={() => { setErr(""); setMode("key"); }}>Ativar com a minha chave</button></p>
            </form>
          )}

          {mode === "key" && (
            <form className="form" onSubmit={checkKey} noValidate>
              <div className="steps" aria-hidden="true"><i className="on" /><i /></div>
              <div>
                <h1>Ativar o app</h1>
                <p className="sub">Digite a chave de ativação que você recebeu. Ela libera o app pelo tempo do seu plano.</p>
              </div>
              <div>
                <label className="l" htmlFor="key">Chave de ativação</label>
                <input className="inp keyinp" id="key" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ADC-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} required />
              </div>
              {err && <p className="err" role="alert">{err}</p>}
              <button className="cta" type="submit" disabled={busy || code.replace(/[^a-z0-9]/gi, "").length < 12}>{busy ? "Conferindo…" : "Continuar"}</button>
              <p className="hint">Já tem conta? <button type="button" className="linkbtn" onClick={() => { setErr(""); setMode("login"); }}>Entrar com e-mail e senha</button></p>
            </form>
          )}

          {mode === "account" && (
            <form className="form" onSubmit={activate} noValidate>
              <div className="steps" aria-hidden="true"><i className="on" /><i className="on" /></div>
              <div>
                <h1>Crie sua conta</h1>
                <p className="sub">Chave <b className="num">{code}</b> válida · plano {PLAN_LABEL[plan] || plan}.</p>
              </div>
              <div>
                <label className="l" htmlFor="sn">Nome do salão</label>
                <input className="inp" id="sn" name="salonName" autoComplete="organization" maxLength={60} required />
              </div>
              <div>
                <label className="l" htmlFor="nm">Seu nome</label>
                <input className="inp" id="nm" name="name" autoComplete="name" maxLength={60} required />
              </div>
              <div>
                <label className="l" htmlFor="em2">E-mail</label>
                <input className="inp" id="em2" name="email" type="email" autoComplete="email" inputMode="email" required />
              </div>
              <div className="fieldrow">
                <div>
                  <label className="l" htmlFor="pw2">Senha</label>
                  <input className="inp" id="pw2" name="password" type="password" autoComplete="new-password" minLength={8} required />
                </div>
                <div>
                  <label className="l" htmlFor="pw3">Repita a senha</label>
                  <input className="inp" id="pw3" name="password2" type="password" autoComplete="new-password" minLength={8} required />
                </div>
              </div>
              <p className="ks">A senha precisa ter pelo menos 8 caracteres.</p>
              {err && <p className="err" role="alert">{err}</p>}
              <button className="cta" type="submit" disabled={busy}>{busy ? "Ativando…" : "Ativar e entrar"}</button>
              <button className="linkbtn" type="button" onClick={() => { setErr(""); setMode("key"); }}>Usar outra chave</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
