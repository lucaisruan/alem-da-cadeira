import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { FIXED_GROUPS, GROUP_LABEL, MONTHS, MONTHS_SHORT, health, kindOf, type DreGroup } from "../../shared/dre";
import { api, ApiError, brl, brl2, buildYear, fmtDate, pct, toggleTheme, type Category, type Me, type ReportRow } from "../lib";
import { navigate, toast, usePath } from "../store";
import { Confirm, Icon, Link, Logo, Skeleton } from "../components/ui";

type Key = { id: string; code: string; plan: string; status: string; label: string; salon: string | null; activated_at: string | null; expires_at: string | null; note: string | null; created_at: string };
type Client = { id: string; name: string; city: string | null; owner: string | null; email: string | null; last_seen: string | null; entries_month: number; key_id: string | null; plan: string | null; label: string; expires_at: string | null };
type Log = { id?: number; created_at: string; event: string; device: string | null; is_failure: number; salon: string | null };

const BADGE: Record<string, string> = { Ativa: "b-good", Disponível: "b-info", Expirada: "b-mute", Bloqueada: "b-bad", "Vence em breve": "b-warn", "Sem chave": "b-mute" };
const PLAN: Record<string, string> = { mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" };
const d10 = (iso: string | null) => (iso ? fmtDate(iso.slice(0, 10)) : "—");
function when(iso: string) {
  const d = new Date(iso.length === 16 ? iso + ":00Z" : iso);
  const today = new Date();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `hoje, ${time}`;
  const y = new Date(today.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return `ontem, ${time}`;
  return `${d.toLocaleDateString("pt-BR")} ${time}`;
}
function hm(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const I = {
  key: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 8.7-8.7M17 6l2.5 2.5M14.5 8.5 16 10" /></svg>,
  users: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2" /></svg>,
  cal: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  log: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>,
  clock: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
};

const TABS = [
  { to: "/", label: "Visão geral", icon: Icon.home },
  { to: "/chaves", label: "Chaves de ativação", short: "Chaves", icon: I.key },
  { to: "/clientes", label: "Clientes", icon: I.users },
  { to: "/vencimentos", label: "Vencimentos", icon: I.cal },
  { to: "/logs", label: "Logs de acesso", short: "Logs", icon: I.log },
  { to: "/uso", label: "Tempo de uso", short: "Uso", icon: I.clock },
];

export default function Admin({ me, onOut }: { me: Me; onOut: () => void }) {
  const path = usePath();
  const cm = /^\/clientes\/([\w-]+)$/.exec(path);
  let page: ReactNode;
  if (path === "/") page = <Geral />;
  else if (path === "/chaves") page = <Chaves />;
  else if (path === "/clientes") page = <Clientes />;
  else if (cm) page = <Painel key={cm[1]} id={cm[1]} />;
  else if (path === "/vencimentos") page = <Vencimentos />;
  else if (path === "/logs") page = <Logs />;
  else if (path === "/uso") page = <Uso />;
  else page = <div className="empty"><h3>Página não encontrada</h3><Link to="/" className="cta">Voltar</Link></div>;
  const active = (to: string) => (to === path || (to === "/clientes" && cm) ? ("page" as const) : undefined);
  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    history.replaceState(null, "", "/");
    onOut();
  };

  return (
    <div className="shell admin">
      <aside className="side" aria-label="Menu do painel">
        <Link to="/" aria-label="Visão geral"><img className="logo" src="/logo-escuro.png" alt="Além da Cadeira" /></Link>
        <p className="eyebrow" style={{ padding: "0 12px 10px", color: "var(--rose-mid)" }}>Painel da administradora</p>
        {TABS.map((t) => <Link key={t.to} to={t.to} className="navbtn" aria-current={active(t.to)}>{t.icon}{t.label}</Link>)}
        <div className="foot">
          <div className="who"><b>{me.user?.name}</b>{me.user?.email}</div>
          <button type="button" className="navbtn" onClick={toggleTheme}>{Icon.moon}Modo claro/escuro</button>
          <button type="button" className="navbtn" onClick={logout}>{Icon.out}Sair</button>
        </div>
      </aside>
      <div>
        <header className="topbar">
          <Logo className="logo" />
          <span className="salon">Painel</span>
          <button className="iconbtn" type="button" onClick={toggleTheme} aria-label="Alternar modo claro e escuro">{Icon.moon}</button>
          <button className="iconbtn" type="button" onClick={logout} aria-label="Sair">{Icon.out}</button>
        </header>
        <nav className="atabs" aria-label="Seções do painel">
          {TABS.map((t) => <Link key={t.to} to={t.to} className="chip" aria-current={active(t.to)}>{t.short || t.label}</Link>)}
        </nav>
        <main className="main">{page}</main>
      </div>
    </div>
  );
}

function useLoad<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const reload = useCallback(() => {
    api<T>(path).then(setData).catch((e) => setErr(e instanceof ApiError ? e.message : "Não deu para carregar."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { data, err, reload };
}

function Head({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="phead">
      <div className="t"><h1>{title}</h1>{sub && <p className="sub" style={{ maxWidth: "72ch" }}>{sub}</p>}</div>
      <div className="row" style={{ gap: 10 }}>{children}</div>
    </div>
  );
}

/* ---------- visão geral ---------- */
function Geral() {
  const { data } = useLoad<{ active: number; available: number; expiring: number; expired: number; usageMinutes: number; usageSalons: number; attention: { text: string; sub: string; tab: string }[]; recent: Log[] }>("/admin/overview");
  return (
    <div className="page">
      <Head title="Visão geral" sub="Suas clientes, chaves e o que precisa de atenção."><GenKeyButton /></Head>
      {!data ? <Skeleton h={300} /> : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="k">Clientes ativas</div><div className="v num">{data.active}</div></div>
            <div className="kpi"><div className="k">Chaves disponíveis</div><div className="v num">{data.available}</div></div>
            <div className="kpi"><div className="k">Vencem em 30 dias</div><div className="v num">{data.expiring}</div></div>
            <div className="kpi"><div className="k">Uso médio por salão no mês</div><div className="v num">{data.usageSalons ? hm(Math.round(data.usageMinutes / data.usageSalons)) : "—"}</div></div>
          </div>
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Precisa de atenção</h3>
              {data.attention.length ? data.attention.map((a, i) => (
                <div className="row" key={i} style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div><b style={{ fontSize: 14 }}>{a.text}</b><div className="ks">{a.sub}</div></div>
                  <Link to={`/${a.tab}`} className="sbtn">{a.tab === "logs" ? "Ver logs" : a.tab === "chaves" ? "Ver chave" : "Ver clientes"}</Link>
                </div>
              )) : <p className="hint">Tudo em dia por aqui.</p>}
            </div>
            <div className="card">
              <div className="row"><h3>Agora há pouco</h3><Link to="/logs" className="sbtn">Ver todos</Link></div>
              {data.recent.length ? data.recent.map((l, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 14 }}>
                  <span className="num muted" style={{ minWidth: 96 }}>{when(l.created_at)}</span>
                  <span style={l.is_failure ? { color: "var(--bad)" } : undefined}><b>{l.salon || "Painel"}</b> · {l.event}</span>
                </div>
              )) : <p className="hint" style={{ marginTop: 10 }}>Nenhum acesso ainda.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- gerar chave ---------- */
function GenKeyButton({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState("anual");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  async function gen(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ codes: string[] }>("/admin/keys", { method: "POST", body: { plan, qty, note } });
      setCodes(r.codes);
      onDone?.();
    } catch (ex) {
      toast(ex instanceof ApiError ? ex.message : "Não deu para gerar.");
    } finally {
      setBusy(false);
    }
  }
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast("Copiado."), () => toast(t));
  const link = (c: string) => `${location.origin}/?chave=${c}`;
  return (
    <>
      <button className="cta" type="button" onClick={() => { setCodes(null); setOpen(true); }}>{Icon.plus} Gerar chave</button>
      {open && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Gerar chave" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="card form" style={{ width: "min(480px,100%)" }}>
            {!codes ? (
              <form className="form" onSubmit={gen}>
                <h3>Gerar chave de ativação</h3>
                <p className="sub">A chave libera o app para a cliente pelo tempo do plano, contado a partir do dia em que ela ativar.</p>
                <div>
                  <span className="l">Plano</span>
                  <div className="chips">{Object.keys(PLAN).map((p) => <button key={p} type="button" className="chip" aria-pressed={plan === p} onClick={() => setPlan(p)}>{PLAN[p]}</button>)}</div>
                </div>
                <div className="fieldrow">
                  <div><label className="l" htmlFor="gq">Quantidade</label><input className="inp num" id="gq" type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, +e.target.value || 1)))} /></div>
                  <div><label className="l" htmlFor="gn">Anotação (opcional)</label><input className="inp" id="gn" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: vendida para Carla" /></div>
                </div>
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button>
                  <button className="cta" type="submit" disabled={busy}>{busy ? "Gerando…" : "Gerar"}</button>
                </div>
              </form>
            ) : (
              <div className="form">
                <h3>{codes.length > 1 ? `${codes.length} chaves criadas` : "Chave criada"}</h3>
                <p className="sub">Envie a chave para a cliente. O link já abre a tela de ativação com a chave preenchida.</p>
                {codes.map((c) => (
                  <div key={c} className="keybox">
                    <span className="mono">{c}</span>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="sbtn" type="button" onClick={() => copy(c)}>Copiar chave</button>
                      <button className="sbtn" type="button" onClick={() => copy(`Sua chave do app Além da Cadeira: ${c}\nPara ativar: ${link(c)}`)}>Copiar mensagem</button>
                    </div>
                  </div>
                ))}
                <div className="row" style={{ justifyContent: "flex-end" }}><button className="cta" type="button" onClick={() => setOpen(false)}>Pronto</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- chaves ---------- */
function Chaves() {
  const { data, reload } = useLoad<{ keys: Key[] }>("/admin/keys");
  const [filter, setFilter] = useState("Todas");
  const [ask, setAsk] = useState<{ k: Key; action: string } | null>(null);
  const keys = data?.keys.filter((k) => filter === "Todas" || k.label === filter) || [];
  async function act(k: Key, action: string) {
    try {
      await api(`/admin/keys/${k.id}/${action}`, { method: "POST", body: {} });
      toast(action === "bloquear" ? `Acesso de ${k.salon || "chave"} bloqueado.` : action === "liberar" ? `Acesso de ${k.salon || "chave"} liberado.` : action === "renovar" ? `Plano de ${k.salon} renovado.` : "Chave apagada.");
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Não deu.");
    }
  }
  return (
    <div className="page">
      <Head title="Chaves de ativação" sub="A chave é o acesso da cliente ao app. No primeiro acesso ela digita a chave e o app fica liberado pelo tempo do plano. Se o plano vencer ou você bloquear, o acesso para na hora."><GenKeyButton onDone={reload} /></Head>
      <div className="filters">
        {["Todas", "Disponível", "Ativa", "Vence em breve", "Expirada", "Bloqueada"].map((f) => <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
      </div>
      {!data ? <Skeleton h={300} /> : !keys.length ? <p className="hint">Nenhuma chave {filter === "Todas" ? "ainda. Gere a primeira no botão acima." : "com essa situação."}</p> : (
        <div className="card tbl" style={{ padding: "6px 12px" }}>
          <table style={{ minWidth: 780 }}>
            <thead><tr><th>Chave</th><th>Plano</th><th>Situação</th><th>Salão</th><th>Ativada em</th><th>Vence em</th><th className="r"><span className="sr">Ações</span></th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td className="mono">{k.code}{k.note && <div className="ks" style={{ fontFamily: "var(--f-body)" }}>{k.note}</div>}</td>
                  <td>{PLAN[k.plan] || k.plan}</td>
                  <td><span className={`badge ${BADGE[k.label]}`}>{k.label}</span></td>
                  <td style={{ fontWeight: 700 }}>{k.salon || "—"}</td>
                  <td className="num muted">{d10(k.activated_at)}</td>
                  <td className="num muted">{d10(k.expires_at)}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {k.label === "Disponível" && <><button className="sbtn" type="button" onClick={() => navigator.clipboard?.writeText(k.code).then(() => toast("Chave copiada."), () => toast(k.code))}>Copiar</button> <button className="sbtn" type="button" onClick={() => setAsk({ k, action: "apagar" })}>Apagar</button></>}
                    {(k.label === "Ativa" || k.label === "Vence em breve") && <><button className="sbtn" type="button" onClick={() => setAsk({ k, action: "renovar" })}>Renovar</button> <button className="sbtn" type="button" onClick={() => setAsk({ k, action: "bloquear" })}>Bloquear</button></>}
                    {k.label === "Expirada" && <button className="sbtn" type="button" onClick={() => setAsk({ k, action: "renovar" })}>Renovar</button>}
                    {k.label === "Bloqueada" && <button className="sbtn" type="button" onClick={() => act(k, "liberar")}>Liberar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Confirm
        open={!!ask}
        title={ask?.action === "bloquear" ? `Bloquear ${ask.k.salon}?` : ask?.action === "renovar" ? `Renovar ${ask.k.salon}?` : "Apagar esta chave?"}
        text={ask?.action === "bloquear" ? "A cliente sai do app na hora e não consegue entrar até você liberar. Os lançamentos dela continuam guardados." : ask?.action === "renovar" ? `Soma mais um plano ${PLAN[ask.k.plan]?.toLowerCase()} ao acesso dela, a partir do vencimento atual (ou de hoje, se já venceu).` : "Ela ainda não foi usada. Não dá para desfazer."}
        okLabel={ask?.action === "bloquear" ? "Bloquear" : ask?.action === "renovar" ? "Renovar" : "Apagar"}
        danger={ask?.action !== "renovar"}
        onClose={(ok) => { const a = ask; setAsk(null); if (ok && a) act(a.k, a.action); }}
      />
    </div>
  );
}

/* ---------- clientes ---------- */
function Clientes() {
  const { data } = useLoad<{ clients: Client[] }>("/admin/clients");
  const [q, setQ] = useState("");
  const list = (data?.clients || []).filter((c) => !q || `${c.name} ${c.owner} ${c.city} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <Head title="Clientes" sub="Toque em uma cliente para abrir o painel dela. Você vê tudo, mas não altera nada." />
      <div className="filters"><input className="inp search" type="search" placeholder="Buscar salão, responsável ou cidade" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" /></div>
      {!data ? <Skeleton h={300} /> : !list.length ? <p className="hint">{data.clients.length ? "Ninguém com essa busca." : "Nenhuma cliente ativou uma chave ainda."}</p> : (
        <div className="card tbl" style={{ padding: "6px 12px" }}>
          <table style={{ minWidth: 760 }}>
            <thead><tr><th>Salão</th><th>Responsável</th><th>Cidade</th><th>Plano</th><th>Último acesso</th><th className="r">Lançamentos no mês</th><th>Situação</th><th><span className="sr">Painel</span></th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td style={{ fontWeight: 800 }}>{c.name}</td>
                  <td>{c.owner}<div className="ks">{c.email}</div></td>
                  <td>{c.city || "—"}</td>
                  <td>{c.plan ? PLAN[c.plan] : "—"}</td>
                  <td className="num muted">{c.last_seen ? when(c.last_seen) : "nunca"}</td>
                  <td className="r num">{c.entries_month}</td>
                  <td><span className={`badge ${BADGE[c.label]}`}>{c.label}</span></td>
                  <td className="r"><Link to={`/clientes/${c.id}`} className="sbtn">Ver painel</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- painel da cliente (somente leitura) ---------- */
type PanelData = {
  salon: { id: string; name: string; city: string | null; tax_rate: number; created_at: string };
  owner: { name: string; email: string; last_login_at: string | null } | null;
  license: { plan: string; label: string; expires_at: string | null } | null;
  categories: Category[];
  year: number;
  rows: ReportRow[];
  recent: { id: string; date: string; description: string; amountCents: number; categoryName: string; group: DreGroup }[];
};
function Painel({ id }: { id: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data, err } = useLoad<PanelData>(`/admin/clients/${id}?year=${year}&month=${month}`);
  const catMap = useMemo(() => new Map((data?.categories || []).map((c) => [c.id, c])), [data]);
  const y = useMemo(() => (data && data.year === year ? buildYear(data.rows, catMap, data.salon.tax_rate) : null), [data, catMap, year]);
  const go = (d: number) => {
    let m = month + d, yy = year;
    if (m < 1) { m = 12; yy--; }
    if (m > 12) { m = 1; yy++; }
    setMonth(m);
    setYear(yy);
  };
  if (err) return <div className="empty"><h3>{err}</h3><Link to="/clientes" className="cta">Voltar</Link></div>;
  if (!data || !y) return <div className="page"><Skeleton h={120} /><div style={{ height: 14 }} /><Skeleton h={360} /></div>;
  const c = y.months[month - 1];
  const hl = health(c.margin, c.revenue);
  const TONE: Record<string, string> = { good: "b-good", warn: "b-warn", bad: "b-bad", info: "b-info", mute: "b-mute" };
  const rows: [string, number, boolean?][] = [
    ["Faturamento", c.revenue, true],
    ["(−) Impostos", c.tax],
    ["(−) Comissões", c.groups["Comissões"]],
    ["(−) Fornecedores e insumos", c.groups["Fornecedores/Insumos"]],
    ["= Margem de contribuição", c.contribution, true],
    ...FIXED_GROUPS.map((g) => [`(−) ${GROUP_LABEL[g]}`, c.groups[g]] as [string, number]),
    ["= Lucro líquido", c.profit, true],
  ];
  return (
    <div className="page">
      <div className="phead">
        <div className="t">
          <Link to="/clientes" className="sbtn">{Icon.left} Clientes</Link>
          <h1 style={{ marginTop: 10 }}>{data.salon.name}</h1>
          <p className="sub">{data.owner?.name} · {data.owner?.email}{data.salon.city ? ` · ${data.salon.city}` : ""}{data.license ? ` · plano ${PLAN[data.license.plan]?.toLowerCase()} até ${d10(data.license.expires_at)}` : ""}</p>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className="badge b-info">Somente leitura</span>
          <div className="mpick" role="group" aria-label="Mês">
            <button type="button" onClick={() => go(-1)} aria-label="Mês anterior">{Icon.left}</button>
            <span>{MONTHS[month - 1]} {year}</span>
            <button type="button" onClick={() => go(1)} aria-label="Próximo mês">{Icon.right}</button>
          </div>
        </div>
      </div>
      {!c.hasData && <p className="hint" style={{ marginBottom: 14 }}>Nenhum lançamento em {MONTHS[month - 1].toLowerCase()} de {year}.</p>}
      <div className="kpis">
        <div className="kpi"><div className="k">Entrou</div><div className="v num">{brl(c.revenue)}</div></div>
        <div className="kpi"><div className="k">Saiu</div><div className="v num">{brl(c.out)}</div></div>
        <div className="kpi hl"><div className="k">Sobrou</div><div className="v num">{brl(c.profit)}</div></div>
        <div className="kpi"><div className="k">Lucratividade</div><div className="v num">{c.revenue ? pct(c.margin) : "—"}</div><span><span className={`badge ${TONE[hl.tone]}`}>{hl.label}</span></span></div>
      </div>
      <div className="grid2" style={{ marginTop: 14, alignItems: "start" }}>
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>DRE de {MONTHS[month - 1].toLowerCase()}</h3>
          <div className="tbl"><table><tbody>
            {rows.map(([l, v, b]) => (
              <tr key={l}><td style={b ? { fontWeight: 800 } : undefined}>{l}</td><td className="r num" style={b ? { fontWeight: 800 } : undefined}>{brl(v)}</td><td className="r num muted">{c.revenue ? pct(v / c.revenue) : "—"}</td></tr>
            ))}
          </tbody></table></div>
          <div style={{ marginTop: 14 }}>
            <span className="l">Ano de {year}</span>
            <div className="minibars" aria-label="Faturamento e lucro por mês">
              {y.months.map((m, i) => {
                const max = Math.max(1, ...y.months.map((x) => x.revenue));
                return (
                  <button key={i} type="button" className={i === month - 1 ? "sel" : ""} onClick={() => setMonth(i + 1)} aria-label={`${MONTHS[i]}: entrou ${brl(m.revenue)}, sobrou ${brl(m.profit)}`}>
                    <i style={{ height: `${(m.revenue / max) * 100}%` }} /><b style={{ height: `${(Math.max(0, m.profit) / max) * 100}%` }} />
                    <span>{MONTHS_SHORT[i]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Últimos lançamentos de {MONTHS[month - 1].toLowerCase()}</h3>
          {data.recent.length ? data.recent.map((e) => {
            const isIn = kindOf(e.group) === "in";
            return (
              <div className="eitem" key={e.id} style={{ cursor: "default" }}>
                <b>{e.description}</b>
                <b className={`num ${isIn ? "amt-in" : ""}`}>{isIn ? "+ " : "− "}{brl2(e.amountCents / 100)}</b>
                <span className="ks">{fmtDate(e.date)} · {e.categoryName}</span>
              </div>
            );
          }) : <p className="hint">Nada lançado neste mês.</p>}
          <p className="ks" style={{ marginTop: 8 }}>Você vê tudo o que ela lança, mas não consegue alterar nada.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- vencimentos ---------- */
function Vencimentos() {
  const { data } = useLoad<{ items: { salon_id: string; name: string; email: string; key_id: string; plan: string; label: string; expires_at: string }[] }>("/admin/billing");
  const items = data?.items || [];
  const soon = items.filter((i) => i.label === "Vence em breve").length;
  const late = items.filter((i) => i.label === "Expirada").length;
  return (
    <div className="page">
      <Head title="Vencimentos" sub="Primeira versão da cobrança: quem vence e quando. A forma de cobrar (Pix, cartão ou boleto) e os valores dos planos entram quando você definir." />
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><div className="k">Planos em dia</div><div className="v num">{items.filter((i) => i.label === "Ativa").length}</div></div>
        <div className="kpi"><div className="k">Vencem em 30 dias</div><div className="v num">{soon}</div></div>
        <div className="kpi"><div className="k">Vencidos</div><div className="v num">{late}</div></div>
      </div>
      {!data ? <Skeleton h={260} /> : !items.length ? <p className="hint">Nenhuma cliente com plano ainda.</p> : (
        <div className="card tbl" style={{ padding: "6px 12px" }}>
          <table style={{ minWidth: 620 }}>
            <thead><tr><th>Salão</th><th>Plano</th><th>Vencimento</th><th>Situação</th><th><span className="sr">Ação</span></th></tr></thead>
            <tbody>
              {items.map((i) => {
                const days = Math.ceil((Date.parse(i.expires_at) - Date.now()) / 86400000);
                return (
                  <tr key={i.key_id}>
                    <td style={{ fontWeight: 800 }}>{i.name}<div className="ks">{i.email}</div></td>
                    <td>{PLAN[i.plan]}</td>
                    <td className="num">{d10(i.expires_at)}<div className="ks">{days >= 0 ? `em ${days} dia${days === 1 ? "" : "s"}` : `há ${-days} dia${days === -1 ? "" : "s"}`}</div></td>
                    <td><span className={`badge ${BADGE[i.label]}`}>{i.label === "Ativa" ? "Em dia" : i.label === "Expirada" ? "Vencido" : i.label}</span></td>
                    <td className="r"><Link to="/chaves" className="sbtn">Renovar</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- logs ---------- */
function Logs() {
  const [onlyFail, setOnlyFail] = useState(false);
  const { data } = useLoad<{ logs: Log[] }>(`/admin/logs${onlyFail ? "?falhas=1" : ""}`);
  return (
    <div className="page">
      <Head title="Logs de acesso" sub="Só acessos e vencimentos. Os lançamentos das clientes não aparecem aqui." />
      <div className="filters">
        <button type="button" className="chip" aria-pressed={!onlyFail} onClick={() => setOnlyFail(false)}>Tudo</button>
        <button type="button" className="chip" aria-pressed={onlyFail} onClick={() => setOnlyFail(true)}>Só falhas</button>
      </div>
      {!data ? <Skeleton h={300} /> : !data.logs.length ? <p className="hint">Nada registrado ainda.</p> : (
        <div className="card tbl" style={{ padding: "6px 12px" }}>
          <table style={{ minWidth: 620 }}>
            <thead><tr><th>Quando</th><th>Salão</th><th>Acesso ou vencimento</th><th>Origem</th></tr></thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id}>
                  <td className="num muted" style={{ whiteSpace: "nowrap" }}>{when(l.created_at)}</td>
                  <td style={{ fontWeight: 700 }}>{l.salon || "Painel"}</td>
                  <td style={l.is_failure ? { color: "var(--bad)", fontWeight: 800 } : undefined}>{l.event}</td>
                  <td className="muted">{l.device || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- tempo de uso ---------- */
function Uso() {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const key = `${ym.y}-${String(ym.m).padStart(2, "0")}`;
  const { data } = useLoad<{ usage: { id: string; name: string; minutes: number; days: number }[] }>(`/admin/usage?month=${key}`);
  const list = data?.usage || [];
  const total = list.reduce((s, u) => s + u.minutes, 0);
  const used = list.filter((u) => u.minutes > 0).length;
  const max = Math.max(1, ...list.map((u) => u.minutes));
  const go = (d: number) => {
    let m = ym.m + d, y = ym.y;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setYm({ y, m });
  };
  return (
    <div className="page">
      <Head title="Tempo de uso" sub="Contado em minutos com o app aberto na tela.">
        <div className="mpick" role="group" aria-label="Mês">
          <button type="button" onClick={() => go(-1)} aria-label="Mês anterior">{Icon.left}</button>
          <span>{MONTHS[ym.m - 1]} {ym.y}</span>
          <button type="button" onClick={() => go(1)} aria-label="Próximo mês">{Icon.right}</button>
        </div>
      </Head>
      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><div className="k">Tempo total no mês</div><div className="v num">{hm(total)}</div></div>
        <div className="kpi"><div className="k">Média por salão que usou</div><div className="v num">{used ? hm(Math.round(total / used)) : "—"}</div></div>
        <div className="kpi"><div className="k">Salões que usaram</div><div className="v num">{used} de {list.length}</div></div>
      </div>
      {!data ? <Skeleton h={260} /> : !list.length ? <p className="hint">Nenhuma cliente ainda.</p> : (
        <div className="card">
          <h3 style={{ marginBottom: 6 }}>Tempo de uso por salão</h3>
          {list.map((u) => (
            <div className="ubar" key={u.id}>
              <Link to={`/clientes/${u.id}`} className="" aria-label={`Abrir painel de ${u.name}`}><b style={{ color: "var(--ink)" }}>{u.name}</b></Link>
              <div className="prog"><div style={{ width: `${(u.minutes / max) * 100}%`, ...(u.minutes < 60 ? { background: "var(--bad)" } : {}) }} /></div>
              <span className="num r" style={{ fontWeight: 800 }}>{hm(u.minutes)}<div className="ks">{u.days} dia{u.days === 1 ? "" : "s"}</div></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
