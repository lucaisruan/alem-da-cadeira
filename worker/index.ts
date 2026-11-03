import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { DEFAULT_CATEGORIES, DEFAULT_TAX_RATE, DRE_GROUPS, SUGGESTED_CATEGORIES, normalizeName, normalizeSettings, type DreGroup } from "../shared/dre";
import admin, { logExpirations } from "./admin";
import { hashPassword, normalizeCode, randomToken, sha256, uid, verifyPassword } from "./crypto";

type Env = { DB: D1Database; ASSETS: Fetcher };
type User = { id: string; salon_id: string | null; role: "owner" | "admin"; name: string; email: string; must_change_password?: number };
type License = { code: string; plan: string; status: string; expires_at: string | null };
type Vars = { user: User; license: License | null };
type C = Context<{ Bindings: Env; Variables: Vars }>;

const COOKIE = "adc_session";
const SESSION_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const app = new Hono<{ Bindings: Env; Variables: Vars }>().basePath("/api");

const nowIso = () => new Date().toISOString();
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

function device(c: C): string {
  const ua = c.req.header("user-agent") || "";
  if (/iPhone|iPad/i.test(ua)) return "iPhone";
  if (/Android/i.test(ua)) return "Android";
  if (/Mobile/i.test(ua)) return "Celular";
  return "Computador";
}

function fail(c: C, status: 400 | 401 | 403 | 404 | 409 | 429, error: string, message: string) {
  return c.json({ error, message }, status);
}

async function log(c: C, e: { salon_id?: string | null; user_id?: string | null; event: string; detail?: string; failure?: boolean }) {
  await c.env.DB.prepare("INSERT INTO audit_logs (salon_id, user_id, event, detail, device, is_failure) VALUES (?,?,?,?,?,?)")
    .bind(e.salon_id ?? null, e.user_id ?? null, e.event, e.detail ?? null, device(c), e.failure ? 1 : 0)
    .run();
}

async function startSession(c: C, userId: string) {
  const token = randomToken();
  const expires = addDays(new Date(), SESSION_DAYS);
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, device) VALUES (?,?,?,?)")
    .bind(await sha256(token), userId, expires.toISOString(), device(c))
    .run();
  const secure = new URL(c.req.url).protocol === "https:";
  setCookie(c, COOKIE, token, { httpOnly: true, secure, sameSite: "Lax", path: "/", expires });
}

async function currentLicense(db: D1Database, salonId: string): Promise<License | null> {
  return db
    .prepare("SELECT code, plan, status, expires_at FROM license_keys WHERE salon_id = ? ORDER BY expires_at DESC LIMIT 1")
    .bind(salonId)
    .first<License>();
}

function licenseState(l: License | null): "ativa" | "vencida" | "bloqueada" | "sem_chave" {
  if (!l) return "sem_chave";
  if (l.status === "bloqueada") return "bloqueada";
  if (!l.expires_at || l.expires_at < nowIso()) return "vencida";
  return "ativa";
}

/* ---------- sessão ---------- */
app.use("*", async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (token) {
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.salon_id, u.role, u.name, u.email, u.must_change_password FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
      .bind(await sha256(token), nowIso())
      .first<User>();
    if (row) {
      c.set("user", row);
      c.set("license", row.salon_id ? await currentLicense(c.env.DB, row.salon_id) : null);
    }
  }
  await next();
});

const requireSalon = async (c: C, next: () => Promise<void>) => {
  const u = c.get("user");
  if (!u) return fail(c, 401, "nao_autenticado", "Entre de novo para continuar.");
  if (!u.salon_id) return fail(c, 403, "sem_salao", "Esta conta não tem salão.");
  const st = licenseState(c.get("license"));
  if (st !== "ativa") {
    return fail(c, 403, "acesso_suspenso", st === "bloqueada" ? "O acesso deste salão foi bloqueado." : "O plano deste salão venceu.");
  }
  await next();
};

/* ---------- ativação e login ---------- */
app.post("/auth/check-key", async (c) => {
  const { code } = await c.req.json<{ code?: string }>().catch(() => ({ code: "" }));
  const norm = normalizeCode(code || "");
  if (!norm) return fail(c, 400, "chave_invalida", "A chave tem o formato ADC-XXXX-XXXX-XXXX.");
  const k = await c.env.DB.prepare("SELECT plan, months, status FROM license_keys WHERE code = ?").bind(norm).first<{ plan: string; months: number; status: string }>();
  if (!k) {
    await log(c, { event: "Tentou ativar uma chave que não existe", detail: norm, failure: true });
    return fail(c, 404, "chave_nao_encontrada", "Não encontramos essa chave. Confira as letras e os números.");
  }
  if (k.status === "bloqueada") return fail(c, 403, "chave_bloqueada", "Essa chave está bloqueada. Fale com a Luize.");
  if (k.status !== "disponivel") return fail(c, 409, "chave_usada", "Essa chave já foi usada. Se o salão já tem conta, é só entrar com e-mail e senha.");
  return c.json({ code: norm, plan: k.plan, months: k.months });
});

app.post("/auth/activate", async (c) => {
  const b = await c.req.json<Record<string, string>>().catch(() => ({}) as Record<string, string>);
  const code = normalizeCode(b.code || "");
  const salonName = normalizeName(b.salonName || "");
  const name = normalizeName(b.name || "");
  const email = (b.email || "").trim().toLowerCase();
  const password = b.password || "";
  if (!code) return fail(c, 400, "chave_invalida", "Chave inválida.");
  if (salonName.length < 2 || salonName.length > 60) return fail(c, 400, "salao", "Escreva o nome do salão.");
  if (name.length < 2 || name.length > 60) return fail(c, 400, "nome", "Escreva o seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return fail(c, 400, "email", "Confira o e-mail.");
  if (password.length < 8 || password.length > 200) return fail(c, 400, "senha", "A senha precisa ter pelo menos 8 caracteres.");

  const k = await c.env.DB.prepare("SELECT id, months, status FROM license_keys WHERE code = ?").bind(code).first<{ id: string; months: number; status: string }>();
  if (!k || k.status !== "disponivel") return fail(c, 409, "chave_usada", "Essa chave não está mais disponível.");
  const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first();
  if (exists) return fail(c, 409, "email_em_uso", "Já existe uma conta com esse e-mail. Tente entrar.");

  const salonId = uid();
  const userId = uid();
  const now = new Date();
  const db = c.env.DB;
  const stmts = [
    db.prepare("INSERT INTO salons (id, name, tax_rate) VALUES (?,?,?)").bind(salonId, salonName, DEFAULT_TAX_RATE),
    db.prepare("INSERT INTO users (id, salon_id, role, name, email, password_hash, last_login_at) VALUES (?,?,?,?,?,?,?)").bind(
      userId, salonId, "owner", name, email, await hashPassword(password), now.toISOString(),
    ),
    // só ativa se ainda estiver disponível (evita duas ativações ao mesmo tempo)
    db.prepare("UPDATE license_keys SET status='ativa', salon_id=?, activated_at=?, expires_at=? WHERE id=? AND status='disponivel'").bind(
      salonId, now.toISOString(), addMonths(now, k.months).toISOString(), k.id,
    ),
    ...DEFAULT_CATEGORIES.map((cat, i) =>
      db.prepare("INSERT INTO categories (id, salon_id, name, dre_group, source, active, sort) VALUES (?,?,?,?,?,?,?)").bind(uid(), salonId, cat.name, cat.group, "padrao", 1, i),
    ),
    ...SUGGESTED_CATEGORIES.map((cat, i) =>
      db.prepare("INSERT INTO categories (id, salon_id, name, dre_group, source, active, sort) VALUES (?,?,?,?,?,?,?)").bind(uid(), salonId, cat.name, cat.group, "sugestao", 0, 100 + i),
    ),
  ];
  const res = await db.batch(stmts);
  if (!res[2].meta.changes) {
    // outra pessoa ativou a chave no mesmo instante: desfaz
    await db.prepare("DELETE FROM salons WHERE id = ?").bind(salonId).run();
    return fail(c, 409, "chave_usada", "Essa chave acabou de ser usada.");
  }
  await log(c, { salon_id: salonId, user_id: userId, event: `Ativou a chave ${code.slice(0, 8)}` });
  await startSession(c, userId);
  return c.json({ ok: true });
});

app.post("/auth/login", async (c) => {
  const b = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as { email?: string; password?: string });
  const email = (b.email || "").trim().toLowerCase();
  const u = await c.env.DB.prepare("SELECT id, salon_id, password_hash, failed_logins, locked_until FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; salon_id: string | null; password_hash: string; failed_logins: number; locked_until: string | null }>();
  if (u?.locked_until && u.locked_until > nowIso()) {
    return fail(c, 429, "bloqueio_temporario", `Muitas tentativas. Tente de novo em ${LOCK_MINUTES} minutos.`);
  }
  const ok = u ? await verifyPassword(b.password || "", u.password_hash) : false;
  if (!u || !ok) {
    if (u) {
      const failed = u.failed_logins + 1;
      const lock = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null;
      await c.env.DB.prepare("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?").bind(lock ? 0 : failed, lock, u.id).run();
      await log(c, { salon_id: u.salon_id, user_id: u.id, event: lock ? `Errou a senha ${MAX_FAILED} vezes e foi bloqueada por ${LOCK_MINUTES} min` : "Errou a senha", failure: true });
    }
    return fail(c, 401, "login_invalido", "E-mail ou senha incorretos.");
  }
  await c.env.DB.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?").bind(nowIso(), u.id).run();
  const lic = u.salon_id ? await currentLicense(c.env.DB, u.salon_id) : null;
  const st = u.salon_id ? licenseState(lic) : "ativa";
  await log(c, {
    salon_id: u.salon_id,
    user_id: u.id,
    event: st === "ativa" ? "Entrou no app" : st === "bloqueada" ? "Tentou entrar com acesso bloqueado" : "Tentou entrar com o plano vencido",
    failure: st !== "ativa",
  });
  await startSession(c, u.id);
  return c.json({ ok: true });
});

app.post("/auth/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.get("/me", async (c) => {
  const u = c.get("user");
  if (!u) return c.json({ user: null });
  let salon = null;
  if (u.salon_id) {
    const row = await c.env.DB.prepare("SELECT id, name, city, tax_rate, settings FROM salons WHERE id = ?").bind(u.salon_id).first<Record<string, unknown>>();
    if (row) {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(String(row.settings || "{}"));
      } catch {
        /* ajustes corrompidos: volta ao padrão */
      }
      salon = { ...row, settings: normalizeSettings(parsed) };
    }
  }
  const lic = c.get("license");
  return c.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: !!u.must_change_password },
    salon,
    license: lic ? { plan: lic.plan, expiresAt: lic.expires_at, state: licenseState(lic) } : null,
  });
});

/* trocar a senha (cliente ou administradora) */
app.post("/me/password", async (c) => {
  const u = c.get("user");
  if (!u) return fail(c, 401, "nao_autenticado", "Entre de novo para continuar.");
  const b = await c.req.json<{ current?: string; next?: string }>().catch(() => ({}) as { current?: string; next?: string });
  const row = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(u.id).first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(b.current || "", row.password_hash))) return fail(c, 400, "senha_atual", "A senha atual não confere.");
  const next = b.next || "";
  if (next.length < 8 || next.length > 200) return fail(c, 400, "senha", "A nova senha precisa ter pelo menos 8 caracteres.");
  const token = getCookie(c, COOKIE);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").bind(await hashPassword(next), u.id),
    // encerra as outras sessões, mantém a atual
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").bind(u.id, token ? await sha256(token) : ""),
  ]);
  await log(c, { salon_id: u.salon_id, user_id: u.id, event: "Trocou a senha" });
  return c.json({ ok: true });
});

/* renovar com uma chave nova (também funciona com o plano vencido) */
app.post("/license/renew", async (c) => {
  const u = c.get("user");
  if (!u?.salon_id) return fail(c, 401, "nao_autenticado", "Entre de novo para continuar.");
  const { code } = await c.req.json<{ code?: string }>().catch(() => ({ code: "" }));
  const norm = normalizeCode(code || "");
  const k = norm ? await c.env.DB.prepare("SELECT id, months, status FROM license_keys WHERE code = ?").bind(norm).first<{ id: string; months: number; status: string }>() : null;
  if (!k || k.status !== "disponivel") return fail(c, 404, "chave_nao_encontrada", "Chave não encontrada ou já usada.");
  const cur = c.get("license");
  const base = cur?.status !== "bloqueada" && cur?.expires_at && cur.expires_at > nowIso() ? new Date(cur.expires_at) : new Date();
  const r = await c.env.DB.prepare("UPDATE license_keys SET status='ativa', salon_id=?, activated_at=?, expires_at=? WHERE id=? AND status='disponivel'")
    .bind(u.salon_id, nowIso(), addMonths(base, k.months).toISOString(), k.id)
    .run();
  if (!r.meta.changes) return fail(c, 409, "chave_usada", "Essa chave acabou de ser usada.");
  await log(c, { salon_id: u.salon_id, user_id: u.id, event: `Renovou o plano com a chave ${norm.slice(0, 8)}` });
  return c.json({ ok: true });
});

/* ---------- salão ---------- */
app.patch("/salon", requireSalon, async (c) => {
  const u = c.get("user");
  const b = await c.req.json<{ name?: string; city?: string; taxRate?: number }>().catch(() => ({}) as Record<string, never>);
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.name !== undefined) {
    const n = normalizeName(String(b.name));
    if (n.length < 2 || n.length > 60) return fail(c, 400, "salao", "Escreva o nome do salão.");
    sets.push("name = ?");
    vals.push(n);
  }
  if (b.city !== undefined) {
    sets.push("city = ?");
    vals.push(normalizeName(String(b.city)).slice(0, 60) || null);
  }
  if (b.taxRate !== undefined) {
    const t = Number(b.taxRate);
    if (!(t >= 0 && t <= 0.4)) return fail(c, 400, "aliquota", "A alíquota precisa ficar entre 0% e 40%.");
    sets.push("tax_rate = ?");
    vals.push(Math.round(t * 10000) / 10000);
  }
  if (sets.length) await c.env.DB.prepare(`UPDATE salons SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, u.salon_id).run();
  return c.json({ ok: true });
});

/* ajustes das ferramentas do método: substitui o bloco enviado (proLabore, meta, reserva ou equipe) */
app.put("/settings", requireSalon, async (c) => {
  const salonId = c.get("user").salon_id;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const row = await c.env.DB.prepare("SELECT settings FROM salons WHERE id = ?").bind(salonId).first<{ settings: string }>();
  let cur: Record<string, unknown> = {};
  try {
    cur = JSON.parse(row?.settings || "{}");
  } catch {
    cur = {};
  }
  for (const k of ["proLabore", "meta", "reserva", "equipe"]) if (k in body) cur[k] = body[k];
  const next = normalizeSettings(cur);
  await c.env.DB.prepare("UPDATE salons SET settings = ? WHERE id = ?").bind(JSON.stringify(next), salonId).run();
  return c.json({ settings: next });
});

app.post("/ping", requireSalon, async (c) => {
  const minute = nowIso().slice(0, 16);
  await c.env.DB.prepare("INSERT OR IGNORE INTO usage_minutes (salon_id, minute) VALUES (?, ?)").bind(c.get("user").salon_id, minute).run();
  return c.json({ ok: true });
});

/* ---------- plano de contas ---------- */
app.get("/categories", requireSalon, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.dre_group AS "group", c.source, c.active, c.sort,
       (SELECT COUNT(*) FROM entries e WHERE e.category_id = c.id) AS uses
     FROM categories c WHERE c.salon_id = ? ORDER BY c.sort, c.name`,
  )
    .bind(c.get("user").salon_id)
    .all();
  return c.json({ categories: results.map((r) => ({ ...r, active: !!r.active })) });
});

app.post("/categories", requireSalon, async (c) => {
  const salonId = c.get("user").salon_id!;
  const b = await c.req.json<{ name?: string; group?: string }>().catch(() => ({}) as { name?: string; group?: string });
  const name = normalizeName(b.name || "");
  const group = b.group as DreGroup;
  if (name.length < 2 || name.length > 40) return fail(c, 400, "nome", "O nome precisa ter entre 2 e 40 letras.");
  if (!DRE_GROUPS.includes(group)) return fail(c, 400, "grupo", "Escolha em que grupo da DRE ela entra.");
  const dup = await c.env.DB.prepare("SELECT id, active FROM categories WHERE salon_id = ? AND name = ? COLLATE NOCASE").bind(salonId, name).first<{ id: string; active: number }>();
  if (dup) return fail(c, 409, "duplicada", dup.active ? "Já existe uma categoria com esse nome." : "Essa categoria já existe, só está desligada. Ative ela na lista.");
  const id = uid();
  await c.env.DB.prepare("INSERT INTO categories (id, salon_id, name, dre_group, source, active, sort) VALUES (?,?,?,?,?,?,?)")
    .bind(id, salonId, name, group, "manual", 1, 500)
    .run();
  return c.json({ id });
});

app.patch("/categories/:id", requireSalon, async (c) => {
  const salonId = c.get("user").salon_id!;
  const b = await c.req.json<{ name?: string; active?: boolean; group?: string }>().catch(() => ({}) as Record<string, never>);
  const cat = await c.env.DB.prepare("SELECT id, dre_group FROM categories WHERE id = ? AND salon_id = ?").bind(c.req.param("id"), salonId).first<{ id: string; dre_group: string }>();
  if (!cat) return fail(c, 404, "nao_encontrada", "Categoria não encontrada.");
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (b.name !== undefined) {
    const name = normalizeName(b.name);
    if (name.length < 2 || name.length > 40) return fail(c, 400, "nome", "O nome precisa ter entre 2 e 40 letras.");
    const dup = await c.env.DB.prepare("SELECT 1 FROM categories WHERE salon_id = ? AND name = ? COLLATE NOCASE AND id <> ?").bind(salonId, name, cat.id).first();
    if (dup) return fail(c, 409, "duplicada", "Já existe uma categoria com esse nome.");
    sets.push("name = ?");
    vals.push(name);
  }
  if (b.group !== undefined) {
    if (!DRE_GROUPS.includes(b.group as DreGroup)) return fail(c, 400, "grupo", "Grupo inválido.");
    if ((b.group === "Receita") !== (cat.dre_group === "Receita")) return fail(c, 400, "grupo", "Uma entrada não pode virar saída. Crie outra categoria.");
    sets.push("dre_group = ?");
    vals.push(b.group);
  }
  if (b.active !== undefined) {
    sets.push("active = ?");
    vals.push(b.active ? 1 : 0);
  }
  if (sets.length) await c.env.DB.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, cat.id).run();
  return c.json({ ok: true });
});

app.delete("/categories/:id", requireSalon, async (c) => {
  const salonId = c.get("user").salon_id!;
  const cat = await c.env.DB.prepare(
    "SELECT c.id, c.source, (SELECT COUNT(*) FROM entries e WHERE e.category_id = c.id) AS uses FROM categories c WHERE c.id = ? AND c.salon_id = ?",
  )
    .bind(c.req.param("id"), salonId)
    .first<{ id: string; source: string; uses: number }>();
  if (!cat) return fail(c, 404, "nao_encontrada", "Categoria não encontrada.");
  if (cat.source !== "manual") return fail(c, 400, "padrao", "As categorias do método não podem ser apagadas, só desligadas.");
  if (cat.uses > 0) return fail(c, 409, "em_uso", `Ela tem ${cat.uses} lançamento(s). Desligue em vez de apagar, para não mexer no histórico.`);
  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(cat.id).run();
  return c.json({ ok: true });
});

/* ---------- lançamentos ---------- */
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function validDate(s: string) {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

type EntryBody = { date?: string; description?: string; categoryId?: string; amountCents?: number; note?: string };
async function readEntry(c: C, partial: boolean): Promise<{ ok: true; v: EntryBody } | { ok: false; res: Response }> {
  const b = await c.req.json<EntryBody>().catch(() => ({}) as EntryBody);
  const v: EntryBody = {};
  if (!partial || b.date !== undefined) {
    if (!validDate(String(b.date))) return { ok: false, res: fail(c, 400, "data", "Escolha uma data válida.") };
    v.date = b.date;
  }
  if (!partial || b.amountCents !== undefined) {
    const a = Number(b.amountCents);
    if (!Number.isInteger(a) || a <= 0 || a > 10_000_000_000) return { ok: false, res: fail(c, 400, "valor", "Digite um valor maior que zero.") };
    v.amountCents = a;
  }
  if (!partial || b.categoryId !== undefined) {
    const cat = await c.env.DB.prepare("SELECT id, name FROM categories WHERE id = ? AND salon_id = ?").bind(String(b.categoryId), c.get("user").salon_id).first<{ id: string; name: string }>();
    if (!cat) return { ok: false, res: fail(c, 400, "categoria", "Escolha uma categoria.") };
    v.categoryId = cat.id;
    if (!partial && !normalizeName(b.description || "")) v.description = cat.name;
  }
  if (b.description !== undefined && normalizeName(b.description)) v.description = normalizeName(b.description).slice(0, 120);
  if (b.note !== undefined) v.note = String(b.note).trim().slice(0, 500);
  return { ok: true, v };
}

const ENTRY_SELECT = `SELECT e.id, e.date, e.description, e.amount_cents AS amountCents, e.note, e.category_id AS categoryId,
  c.name AS categoryName, c.dre_group AS "group", e.created_at AS createdAt
  FROM entries e JOIN categories c ON c.id = e.category_id`;

app.get("/entries", requireSalon, async (c) => {
  const salonId = c.get("user").salon_id;
  const month = c.req.query("month"); // YYYY-MM
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit")) || 200));
  let sql = `${ENTRY_SELECT} WHERE e.salon_id = ?`;
  const vals: unknown[] = [salonId];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    sql += " AND e.date >= ? AND e.date <= ?";
    vals.push(`${month}-01`, `${month}-31`);
  }
  sql += " ORDER BY e.date DESC, e.created_at DESC LIMIT ?";
  vals.push(limit);
  const { results } = await c.env.DB.prepare(sql).bind(...vals).all();
  return c.json({ entries: results });
});

app.get("/entries/:id", requireSalon, async (c) => {
  const entry = await c.env.DB.prepare(`${ENTRY_SELECT} WHERE e.id = ? AND e.salon_id = ?`).bind(c.req.param("id"), c.get("user").salon_id).first();
  if (!entry) return fail(c, 404, "nao_encontrado", "Lançamento não encontrado.");
  return c.json({ entry });
});

app.post("/entries", requireSalon, async (c) => {
  const r = await readEntry(c, false);
  if (!r.ok) return r.res;
  const id = uid();
  const u = c.get("user");
  await c.env.DB.prepare("INSERT INTO entries (id, salon_id, date, description, category_id, amount_cents, note, created_by) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, u.salon_id, r.v.date, r.v.description, r.v.categoryId, r.v.amountCents, r.v.note || null, u.id)
    .run();
  const entry = await c.env.DB.prepare(`${ENTRY_SELECT} WHERE e.id = ?`).bind(id).first();
  return c.json({ entry });
});

app.patch("/entries/:id", requireSalon, async (c) => {
  const u = c.get("user");
  const ex = await c.env.DB.prepare("SELECT id FROM entries WHERE id = ? AND salon_id = ?").bind(c.req.param("id"), u.salon_id).first();
  if (!ex) return fail(c, 404, "nao_encontrado", "Lançamento não encontrado.");
  const r = await readEntry(c, true);
  if (!r.ok) return r.res;
  const map: Record<string, string> = { date: "date", description: "description", categoryId: "category_id", amountCents: "amount_cents", note: "note" };
  const keys = Object.keys(r.v) as (keyof EntryBody)[];
  if (keys.length) {
    await c.env.DB.prepare(`UPDATE entries SET ${keys.map((k) => `${map[k]} = ?`).join(", ")}, updated_at = ? WHERE id = ?`)
      .bind(...keys.map((k) => r.v[k] ?? null), nowIso(), c.req.param("id"))
      .run();
  }
  const entry = await c.env.DB.prepare(`${ENTRY_SELECT} WHERE e.id = ?`).bind(c.req.param("id")).first();
  return c.json({ entry });
});

app.delete("/entries/:id", requireSalon, async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM entries WHERE id = ? AND salon_id = ?").bind(c.req.param("id"), c.get("user").salon_id).run();
  if (!r.meta.changes) return fail(c, 404, "nao_encontrado", "Lançamento não encontrado.");
  return c.json({ ok: true });
});

/* ---------- números do ano (o app monta a DRE com isso) ---------- */
app.get("/report", requireSalon, async (c) => {
  const salonId = c.get("user").salon_id;
  const year = Number(c.req.query("year")) || new Date().getUTCFullYear();
  const { results } = await c.env.DB.prepare(
    `SELECT CAST(substr(e.date, 6, 2) AS INTEGER) AS month, e.category_id AS categoryId, SUM(e.amount_cents) AS totalCents, COUNT(*) AS count
     FROM entries e WHERE e.salon_id = ? AND e.date >= ? AND e.date <= ? GROUP BY month, e.category_id`,
  )
    .bind(salonId, `${year}-01-01`, `${year}-12-31`)
    .all();
  const years = await c.env.DB.prepare("SELECT DISTINCT substr(date, 1, 4) AS y FROM entries WHERE salon_id = ? ORDER BY y").bind(salonId).all<{ y: string }>();
  return c.json({ year, rows: results, years: years.results.map((r) => Number(r.y)) });
});

app.route("/admin", admin);

app.all("*", (c) => fail(c, 404, "nao_encontrado", "Rota não encontrada."));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "erro_interno", message: "Algo deu errado do nosso lado. Tente de novo." }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(logExpirations(env.DB));
  },
} satisfies ExportedHandler<Env>;
