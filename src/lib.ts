import { DRE_GROUPS, emptyGroups, monthResult, type DreGroup, type GroupTotals, type MonthResult, type Settings } from "../shared/dre";

/* ---------- API ---------- */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + path, {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline", "Sem conexão. Confira a internet e tente de novo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(res.status, data.error || "erro", data.message || "Algo deu errado. Tente de novo.");
    if (res.status === 401 || (res.status === 403 && data.error === "acesso_suspenso")) {
      window.dispatchEvent(new CustomEvent("adc:auth", { detail: data.error }));
    }
    throw err;
  }
  return data as T;
}

/* ---------- tipos ---------- */
export type Me = {
  user: { id: string; name: string; email: string; role: "owner" | "admin"; mustChangePassword?: boolean } | null;
  salon: { id: string; name: string; city: string | null; tax_rate: number; settings: Settings } | null;
  license: { plan: string; expiresAt: string | null; state: "ativa" | "vencida" | "bloqueada" | "sem_chave" } | null;
};
export type Category = { id: string; name: string; group: DreGroup; source: "padrao" | "sugestao" | "manual"; active: boolean; sort: number; uses: number };
export type Entry = { id: string; date: string; description: string; amountCents: number; note: string | null; categoryId: string; categoryName: string; group: DreGroup; createdAt: string };
export type ReportRow = { month: number; categoryId: string; totalCents: number; count: number };

/* ---------- números ---------- */
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const brlFmt2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number) => brlFmt.format(Math.round(v)).replace(/ /g, " ");
export const brl2 = (v: number) => brlFmt2.format(v).replace(/ /g, " ");
export const pct = (v: number, d = 1) => (isFinite(v) ? (v * 100).toFixed(d).replace(".", ",") + "%" : "—");
export const centsToInput = (c: number) => (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
export function fmtDay(iso: string) {
  const dt = new Date(iso + "T12:00:00");
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

/** Junta as linhas do relatório em 12 meses de DRE. */
export function buildYear(rows: ReportRow[], cats: Map<string, Category>, taxRate: number) {
  const groups: GroupTotals[] = Array.from({ length: 12 }, emptyGroups);
  const byCat: Map<string, number>[] = Array.from({ length: 12 }, () => new Map());
  const counts = new Array(12).fill(0);
  for (const r of rows) {
    const c = cats.get(r.categoryId);
    if (!c || !DRE_GROUPS.includes(c.group)) continue;
    const i = r.month - 1;
    const v = r.totalCents / 100;
    groups[i][c.group] += v;
    byCat[i].set(r.categoryId, (byCat[i].get(r.categoryId) || 0) + v);
    counts[i] += r.count;
  }
  const months: MonthResult[] = groups.map((g, i) => monthResult(g, taxRate, counts[i] > 0));
  return { months, byCat, counts };
}

/* ---------- tema ---------- */
export function currentTheme(): "light" | "dark" {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("adc-theme", next);
  } catch {
    /* sem armazenamento: só nesta sessão */
  }
}
