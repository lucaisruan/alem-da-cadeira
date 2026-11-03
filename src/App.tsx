import { useCallback, useEffect, useState } from "react";
import { api, toggleTheme, type Me } from "./lib";
import { StoreProvider, navigate, usePath, useStore } from "./store";
import { Icon, Link, Logo } from "./components/ui";
import Auth from "./screens/Auth";
import Inicio from "./screens/Inicio";
import Lancar from "./screens/Lancar";
import Lancamentos from "./screens/Lancamentos";
import Dre from "./screens/Dre";
import Contas from "./screens/Contas";
import Ajustes from "./screens/Ajustes";
import Suspenso from "./screens/Suspenso";

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<Me>("/me"));
    } catch {
      setMe((m) => m ?? { user: null, salon: null, license: null });
    }
  }, []);
  useEffect(() => {
    refreshMe();
    const on = () => refreshMe();
    window.addEventListener("adc:auth", on);
    return () => window.removeEventListener("adc:auth", on);
  }, [refreshMe]);

  if (!me) return <div className="center"><Logo className="boot" /></div>;
  if (!me.user) return <Auth onDone={refreshMe} />;
  if (me.user.role === "admin") return <AdminSoon me={me} onOut={refreshMe} />;
  if (me.license?.state !== "ativa") return <Suspenso me={me} onDone={refreshMe} />;
  return (
    <StoreProvider me={me} refreshMe={refreshMe}>
      <Shell />
    </StoreProvider>
  );
}

const NAV = [
  { to: "/", label: "Início", icon: Icon.home },
  { to: "/lancamentos", label: "Lançamentos", icon: Icon.list },
  { to: "/resultado", label: "DRE do mês", short: "DRE", icon: Icon.dre },
  { to: "/contas", label: "Plano de contas", short: "Contas", icon: Icon.tags },
];

function Shell() {
  const path = usePath();
  const { me } = useStore();
  const editMatch = /^\/lancar\/([\w-]+)$/.exec(path);
  let page;
  if (path === "/") page = <Inicio />;
  else if (path === "/lancar") page = <Lancar key="novo" />;
  else if (editMatch) page = <Lancar key={editMatch[1]} id={editMatch[1]} />;
  else if (path === "/lancamentos") page = <Lancamentos />;
  else if (path === "/resultado") page = <Dre />;
  else if (path === "/contas") page = <Contas />;
  else if (path === "/ajustes") page = <Ajustes />;
  else page = <NotFound />;
  const cur = (to: string) => (to === path ? ("page" as const) : undefined);

  return (
    <div className="shell">
      <aside className="side" aria-label="Menu">
        <Link to="/" aria-label="Início"><Logo className="logo" /></Link>
        <Link to="/lancar" className="cta new">{Icon.plus} Novo lançamento</Link>
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="navbtn" aria-current={cur(n.to)}>{n.icon}{n.label}</Link>
        ))}
        <div className="foot">
          <div className="who"><b>{me.salon?.name}</b>{me.user?.name}</div>
          <Link to="/ajustes" className="navbtn" aria-current={cur("/ajustes")}>{Icon.cog}Ajustes</Link>
          <button type="button" className="navbtn" onClick={toggleTheme}>{Icon.moon}Modo claro/escuro</button>
        </div>
      </aside>

      <div>
        <header className="topbar">
          <Link to="/" aria-label="Início"><Logo className="logo" /></Link>
          <span className="salon">{me.salon?.name}</span>
          <button className="iconbtn" type="button" onClick={toggleTheme} aria-label="Alternar modo claro e escuro">{Icon.moon}</button>
          <Link to="/ajustes" className="iconbtn" aria-label="Ajustes">{Icon.cog}</Link>
        </header>
        <main className="main" id="conteudo">{page}</main>
      </div>

      <nav className="tabbar" aria-label="Navegação">
        <Link to="/" className="tab" aria-current={cur("/")}>{Icon.home}Início</Link>
        <Link to="/lancamentos" className="tab" aria-current={cur("/lancamentos")}>{Icon.list}Lançamentos</Link>
        <Link to="/lancar" className="tab plus" aria-label="Novo lançamento"><span>{Icon.plus}</span></Link>
        <Link to="/resultado" className="tab" aria-current={cur("/resultado")}>{Icon.dre}DRE</Link>
        <Link to="/contas" className="tab" aria-current={cur("/contas")}>{Icon.tags}Contas</Link>
      </nav>
    </div>
  );
}

function NotFound() {
  return (
    <div className="empty page">
      <h3>Página não encontrada</h3>
      <button className="cta" type="button" onClick={() => navigate("/")}>Voltar ao início</button>
    </div>
  );
}

function AdminSoon({ me, onOut }: { me: Me; onOut: () => void }) {
  return (
    <div className="center" style={{ padding: 16 }}>
      <div className="empty" style={{ maxWidth: 520 }}>
        <Logo className="mlogo" />
        <h3>Olá, {me.user?.name}</h3>
        <p>O painel administrativo chega na próxima fase. Sua conta de administradora já está pronta.</p>
        <button className="ghost" type="button" onClick={async () => { await api("/auth/logout", { method: "POST" }); onOut(); }}>Sair</button>
      </div>
    </div>
  );
}
