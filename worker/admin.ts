import { Hono } from "hono";
import { newLicenseCode, uid } from "./crypto";

type Env = { DB: D1Database };
type User = { id: string; salon_id: string | null; role: "owner" | "admin"; name: string; email: string };
type Vars = { user: User };

export const PLAN_MONTHS: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const DAY = 86400000;
const nowIso = () => new Date().toISOString();
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

/** Situação de uma chave para a Luize. */
export function keyStatus(k: { status: string; expires_at: string | null }, now = Date.now()) {
  if (k.status === "disponivel") return "Disponível";
  if (k.status === "bloqueada") return "Bloqueada";
  if (!k.expires_at || Date.parse(k.expires_at) < now) return "Expirada";
  if (Date.parse(k.expires_at) - now < 30 * DAY) return "Vence em breve";
  return "Ativa";
}

const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

admin.use("*", async (c, next) => {
  const u = c.get("user");
  if (!u) return c.json({ error: "nao_autenticado", message: "Entre de novo para continuar." }, 401);
  if (u.role !== "admin") return c.json({ error: "proibido", message: "Só a administradora acessa esta área." }, 403);
  await next();
});

/* última chave de cada salão */
const LAST_KEY = `SELECT k.* FROM license_keys k WHERE k.salon_id IS NOT NULL AND k.expires_at = (
  SELECT MAX(k2.expires_at) FROM license_keys k2 WHERE k2.salon_id = k.salon_id)`;

admin.get("/overview", async (c) => {
  const db = c.env.DB;
  const month = nowIso().slice(0, 7);
  const [keys, usage, logs, last] = await db.batch([
    db.prepare("SELECT status, expires_at FROM license_keys"),
    db.prepare("SELECT COUNT(*) AS minutes, COUNT(DISTINCT salon_id) AS salons FROM usage_minutes WHERE minute >= ?").bind(month),
    db.prepare(`SELECT l.created_at, l.event, l.device, l.is_failure, s.name AS salon FROM audit_logs l LEFT JOIN salons s ON s.id = l.salon_id ORDER BY l.id DESC LIMIT 6`),
    db.prepare(`SELECT s.id, s.name, lk.expires_at, lk.status,
        (SELECT MAX(minute) FROM usage_minutes u WHERE u.salon_id = s.id) AS last_use,
        (SELECT MAX(last_login_at) FROM users WHERE salon_id = s.id) AS last_login
      FROM salons s JOIN (${LAST_KEY}) lk ON lk.salon_id = s.id`),
  ]);
  const ks = keys.results as { status: string; expires_at: string | null }[];
  const st = ks.map((k) => keyStatus(k));
  const u = usage.results[0] as { minutes: number; salons: number };
  const now = Date.now();
  const attention: { text: string; sub: string; tab: string }[] = [];
  const failsToday = (await db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE is_failure = 1 AND created_at >= ?").bind(nowIso().slice(0, 10)).first<{ n: number }>())?.n || 0;
  for (const s of last.results as { name: string; expires_at: string; status: string; last_use: string | null; last_login: string | null }[]) {
    const ks2 = keyStatus(s);
    if (ks2 === "Vence em breve") {
      const d = Math.ceil((Date.parse(s.expires_at) - now) / DAY);
      attention.push({ text: `${s.name} vence em ${d} dia${d === 1 ? "" : "s"}`, sub: `Acesso até ${s.expires_at.slice(0, 10).split("-").reverse().join("/")}`, tab: "chaves" });
    } else if (ks2 === "Expirada") {
      attention.push({ text: `${s.name} está com o plano vencido`, sub: "O acesso está suspenso até renovar", tab: "chaves" });
    } else if (ks2 === "Ativa") {
      const lastSeen = [s.last_use, s.last_login].filter(Boolean).sort().pop();
      if (!lastSeen || now - Date.parse(lastSeen.length === 16 ? lastSeen + ":00Z" : lastSeen) > 14 * DAY) {
        attention.push({ text: `${s.name} sem usar há mais de 14 dias`, sub: lastSeen ? `Último acesso em ${lastSeen.slice(0, 10).split("-").reverse().join("/")}` : "Ainda não usou", tab: "clientes" });
      }
    }
  }
  if (failsToday) attention.push({ text: `${failsToday} falha${failsToday > 1 ? "s" : ""} de acesso hoje`, sub: "Senha errada, chave bloqueada ou plano vencido", tab: "logs" });
  return c.json({
    active: st.filter((s) => s === "Ativa" || s === "Vence em breve").length,
    available: st.filter((s) => s === "Disponível").length,
    expiring: st.filter((s) => s === "Vence em breve").length,
    expired: st.filter((s) => s === "Expirada").length,
    usageMinutes: u.minutes,
    usageSalons: u.salons,
    attention,
    recent: logs.results,
  });
});

/* ---------- chaves ---------- */
admin.get("/keys", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT k.id, k.code, k.plan, k.months, k.status, k.activated_at, k.expires_at, k.note, k.created_at, s.name AS salon
     FROM license_keys k LEFT JOIN salons s ON s.id = k.salon_id ORDER BY k.created_at DESC LIMIT 500`,
  ).all<{ status: string; expires_at: string | null }>();
  return c.json({ keys: results.map((k) => ({ ...k, label: keyStatus(k) })) });
});

admin.post("/keys", async (c) => {
  const b = await c.req.json<{ plan?: string; qty?: number; note?: string }>().catch(() => ({}) as { plan?: string; qty?: number; note?: string });
  const plan = b.plan || "anual";
  if (!PLAN_MONTHS[plan]) return c.json({ error: "plano", message: "Plano inválido." }, 400);
  const qty = Math.max(1, Math.min(20, Number(b.qty) || 1));
  const note = (b.note || "").trim().slice(0, 80) || null;
  const codes = Array.from({ length: qty }, newLicenseCode);
  await c.env.DB.batch(
    codes.map((code) => c.env.DB.prepare("INSERT INTO license_keys (id, code, plan, months, note) VALUES (?,?,?,?,?)").bind(uid(), code, plan, PLAN_MONTHS[plan], note)),
  );
  return c.json({ codes });
});

admin.post("/keys/:id/:action", async (c) => {
  const action = c.req.param("action");
  const k = await c.env.DB.prepare("SELECT k.*, s.name AS salon FROM license_keys k LEFT JOIN salons s ON s.id = k.salon_id WHERE k.id = ?")
    .bind(c.req.param("id"))
    .first<{ id: string; status: string; salon_id: string | null; salon: string | null; expires_at: string | null; months: number; activated_at: string | null; plan: string }>();
  if (!k) return c.json({ error: "nao_encontrada", message: "Chave não encontrada." }, 404);
  const log = (event: string) =>
    c.env.DB.prepare("INSERT INTO audit_logs (salon_id, user_id, event, device) VALUES (?,?,?,?)").bind(k.salon_id, c.get("user").id, event, "Painel").run();

  if (action === "bloquear") {
    if (k.status === "bloqueada") return c.json({ ok: true });
    await c.env.DB.prepare("UPDATE license_keys SET status = 'bloqueada' WHERE id = ?").bind(k.id).run();
    if (k.salon_id) await c.env.DB.prepare("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE salon_id = ?)").bind(k.salon_id).run();
    await log("Acesso bloqueado pela administradora");
    return c.json({ ok: true });
  }
  if (action === "liberar") {
    await c.env.DB.prepare("UPDATE license_keys SET status = ? WHERE id = ?").bind(k.activated_at ? "ativa" : "disponivel", k.id).run();
    await log("Acesso liberado pela administradora");
    return c.json({ ok: true });
  }
  if (action === "renovar") {
    if (!k.salon_id) return c.json({ error: "sem_salao", message: "Esta chave ainda não foi ativada." }, 400);
    const b = await c.req.json<{ plan?: string }>().catch(() => ({}) as { plan?: string });
    const plan = b.plan && PLAN_MONTHS[b.plan] ? b.plan : k.plan;
    const base = k.expires_at && Date.parse(k.expires_at) > Date.now() ? new Date(k.expires_at) : new Date();
    const until = addMonths(base, PLAN_MONTHS[plan]).toISOString();
    await c.env.DB.prepare("UPDATE license_keys SET expires_at = ?, plan = ?, status = 'ativa' WHERE id = ?").bind(until, plan, k.id).run();
    await log(`Plano renovado até ${until.slice(0, 10).split("-").reverse().join("/")}`);
    return c.json({ ok: true, expiresAt: until });
  }
  if (action === "apagar") {
    if (k.status !== "disponivel" || k.activated_at) return c.json({ error: "em_uso", message: "Só dá para apagar chaves que ainda não foram usadas." }, 400);
    await c.env.DB.prepare("DELETE FROM license_keys WHERE id = ?").bind(k.id).run();
    return c.json({ ok: true });
  }
  return c.json({ error: "acao", message: "Ação inválida." }, 400);
});

/* ---------- clientes ---------- */
admin.get("/clients", async (c) => {
  const month = nowIso().slice(0, 7);
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.city, s.created_at,
       (SELECT name FROM users WHERE salon_id = s.id AND role = 'owner' LIMIT 1) AS owner,
       (SELECT email FROM users WHERE salon_id = s.id AND role = 'owner' LIMIT 1) AS email,
       (SELECT MAX(last_login_at) FROM users WHERE salon_id = s.id) AS last_login,
       (SELECT MAX(minute) FROM usage_minutes WHERE salon_id = s.id) AS last_use,
       (SELECT COUNT(*) FROM entries WHERE salon_id = s.id AND date >= ? AND date <= ?) AS entries_month,
       lk.id AS key_id, lk.plan, lk.status, lk.expires_at
     FROM salons s LEFT JOIN (${LAST_KEY}) lk ON lk.salon_id = s.id ORDER BY s.name COLLATE NOCASE`,
  )
    .bind(`${month}-01`, `${month}-31`)
    .all<{ status: string; expires_at: string | null; last_login: string | null; last_use: string | null }>();
  return c.json({
    clients: results.map((r) => ({
      ...r,
      label: r.status ? keyStatus(r) : "Sem chave",
      last_seen: [r.last_login, r.last_use ? r.last_use + ":00.000Z" : null].filter(Boolean).sort().pop() || null,
    })),
  });
});

/* painel da cliente, somente leitura */
admin.get("/clients/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const year = Number(c.req.query("year")) || new Date().getUTCFullYear();
  const month = Math.min(12, Math.max(1, Number(c.req.query("month")) || new Date().getUTCMonth() + 1));
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  const salon = await db.prepare("SELECT id, name, city, tax_rate, created_at FROM salons WHERE id = ?").bind(id).first();
  if (!salon) return c.json({ error: "nao_encontrado", message: "Cliente não encontrada." }, 404);
  const [owner, key, cats, rows, recent] = await db.batch([
    db.prepare("SELECT name, email, last_login_at FROM users WHERE salon_id = ? AND role = 'owner' LIMIT 1").bind(id),
    db.prepare("SELECT plan, status, expires_at FROM license_keys WHERE salon_id = ? ORDER BY expires_at DESC LIMIT 1").bind(id),
    db.prepare(`SELECT id, name, dre_group AS "group", source, active, sort, 0 AS uses FROM categories WHERE salon_id = ?`).bind(id),
    db.prepare(
      `SELECT CAST(substr(date, 6, 2) AS INTEGER) AS month, category_id AS categoryId, SUM(amount_cents) AS totalCents, COUNT(*) AS count
       FROM entries WHERE salon_id = ? AND date >= ? AND date <= ? GROUP BY month, category_id`,
    ).bind(id, `${year}-01-01`, `${year}-12-31`),
    db.prepare(
      `SELECT e.id, e.date, e.description, e.amount_cents AS amountCents, e.note, c.name AS categoryName, c.dre_group AS "group"
       FROM entries e JOIN categories c ON c.id = e.category_id WHERE e.salon_id = ? AND e.date >= ? AND e.date <= ?
       ORDER BY e.date DESC, e.created_at DESC LIMIT 15`,
    ).bind(id, `${ym}-01`, `${ym}-31`),
  ]);
  const k = key.results[0] as { plan: string; status: string; expires_at: string | null } | undefined;
  return c.json({
    salon,
    owner: owner.results[0] || null,
    license: k ? { ...k, label: keyStatus(k) } : null,
    categories: (cats.results as Record<string, unknown>[]).map((r) => ({ ...r, active: !!r.active })),
    year,
    rows: rows.results,
    recent: recent.results,
  });
});

/* ---------- logs: só acessos e vencimentos ---------- */
admin.get("/logs", async (c) => {
  const onlyFail = c.req.query("falhas") === "1";
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.created_at, l.event, l.device, l.is_failure, s.name AS salon
     FROM audit_logs l LEFT JOIN salons s ON s.id = l.salon_id ${onlyFail ? "WHERE l.is_failure = 1" : ""} ORDER BY l.id DESC LIMIT 300`,
  ).all();
  return c.json({ logs: results });
});

/* ---------- tempo de uso ---------- */
admin.get("/usage", async (c) => {
  const month = /^\d{4}-\d{2}$/.test(c.req.query("month") || "") ? c.req.query("month")! : nowIso().slice(0, 7);
  const next = (() => {
    const [y, m] = month.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  })();
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.name, COUNT(u.minute) AS minutes, COUNT(DISTINCT substr(u.minute, 1, 10)) AS days
     FROM salons s LEFT JOIN usage_minutes u ON u.salon_id = s.id AND u.minute >= ? AND u.minute < ?
     GROUP BY s.id ORDER BY minutes DESC, s.name`,
  )
    .bind(month, next)
    .all();
  return c.json({ month, usage: results });
});

/* ---------- vencimentos (primeira versão da cobrança) ---------- */
admin.get("/billing", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id AS salon_id, s.name, lk.id AS key_id, lk.plan, lk.status, lk.expires_at,
       (SELECT email FROM users WHERE salon_id = s.id AND role = 'owner' LIMIT 1) AS email
     FROM salons s JOIN (${LAST_KEY}) lk ON lk.salon_id = s.id ORDER BY lk.expires_at`,
  ).all<{ status: string; expires_at: string | null }>();
  return c.json({ items: results.map((r) => ({ ...r, label: keyStatus(r) })) });
});

/** Roda uma vez por dia: registra nos logs os avisos de vencimento. */
export async function logExpirations(db: D1Database) {
  const now = Date.now();
  const { results } = await db.prepare(`SELECT k.id, k.salon_id, k.expires_at FROM license_keys k WHERE k.status = 'ativa' AND k.salon_id IS NOT NULL`).all<{
    id: string;
    salon_id: string;
    expires_at: string;
  }>();
  for (const k of results) {
    const days = Math.ceil((Date.parse(k.expires_at) - now) / DAY);
    let event: string | null = null;
    let failure = 0;
    if (days === 7 || days === 1) event = `Aviso: plano vence em ${days} dia${days > 1 ? "s" : ""}`;
    else if (days === 0 || days === -0) event = "Aviso: plano vence hoje";
    else if (days === -1) {
      event = "Plano expirou e o acesso foi suspenso";
      failure = 1;
    }
    if (!event) continue;
    const tag = `${k.id}:${k.expires_at}:${days}`;
    const dup = await db.prepare("SELECT 1 FROM audit_logs WHERE detail = ?").bind(tag).first();
    if (dup) continue;
    await db.prepare("INSERT INTO audit_logs (salon_id, event, detail, device, is_failure) VALUES (?,?,?,?,?)").bind(k.salon_id, event, tag, "Sistema", failure).run();
  }
}

export default admin;
