import { api, type Me } from "../lib";
import { Logo } from "../components/ui";
import TrocarSenha from "../components/TrocarSenha";

export default function PrimeiraSenha({ me, onDone }: { me: Me; onDone: () => void }) {
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
            <span className="badge b-warn">Primeiro acesso</span>
            <h1 style={{ marginTop: 10 }}>Olá, {me.user?.name?.split(" ")[0]}! Crie sua senha</h1>
            <p className="sub" style={{ marginTop: 6 }}>Você entrou com uma senha provisória. Escolha uma senha só sua, com pelo menos 8 caracteres, para continuar.</p>
          </div>
          <TrocarSenha forced onDone={onDone} />
          <button className="linkbtn" type="button" onClick={logout}>Sair</button>
        </div>
      </div>
    </div>
  );
}
