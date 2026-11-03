import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, buildYear, type Category, type Me, type ReportRow } from "./lib";

/* ---------- rotas simples ---------- */
export function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    window.addEventListener("popstate", on);
    window.addEventListener("adc:nav", on);
    return () => {
      window.removeEventListener("popstate", on);
      window.removeEventListener("adc:nav", on);
    };
  }, []);
  return path;
}
export function navigate(to: string, replace = false) {
  if (to === location.pathname + location.search) return;
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  window.dispatchEvent(new Event("adc:nav"));
  window.scrollTo({ top: 0 });
}

/* ---------- toast ---------- */
let toastTimer: number | undefined;
export function toast(msg: string) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("on"), 2600);
}

/* ---------- dados do salão ---------- */
type Period = { year: number; month: number }; // month 1..12

type Store = {
  me: Me;
  refreshMe: () => Promise<void>;
  categories: Category[];
  catMap: Map<string, Category>;
  refreshCategories: () => Promise<void>;
  period: Period;
  setPeriod: (p: Period) => void;
  report: { rows: ReportRow[]; years: number[]; year: number } | null;
  refreshReport: () => Promise<void>;
  year: ReturnType<typeof buildYear> | null;
  version: number; // muda a cada lançamento salvo, para as telas recarregarem
  bump: () => void;
  lastDate: string | null;
  setLastDate: (d: string) => void;
  flashId: string | null;
  setFlashId: (id: string | null) => void;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error("sem store");
  return s;
};

export function StoreProvider({ me, refreshMe, children }: { me: Me; refreshMe: () => Promise<void>; children: ReactNode }) {
  const now = new Date();
  const [period, setPeriod] = useState<Period>({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [report, setReport] = useState<Store["report"]>(null);
  const [version, setVersion] = useState(0);
  const [lastDate, setLastDate] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const yearRef = useRef(period.year);
  yearRef.current = period.year;

  const refreshCategories = useCallback(async () => {
    const r = await api<{ categories: Category[] }>("/categories");
    setCategories(r.categories);
  }, []);
  const refreshReport = useCallback(async () => {
    const y = yearRef.current;
    const r = await api<{ rows: ReportRow[]; years: number[]; year: number }>(`/report?year=${y}`);
    if (r.year === yearRef.current) setReport(r);
  }, []);

  useEffect(() => {
    refreshCategories().catch(() => {});
  }, [refreshCategories]);
  useEffect(() => {
    refreshReport().catch(() => {});
  }, [period.year, version, refreshReport]);

  // tempo de uso: um sinal por minuto com o app aberto e visível
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") api("/ping", { method: "POST" }).catch(() => {});
    };
    ping();
    const t = window.setInterval(ping, 60_000);
    return () => clearInterval(t);
  }, []);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const taxRate = me.salon?.tax_rate ?? 0.067;
  const year = useMemo(
    () => (report && report.year === period.year && categories.length ? buildYear(report.rows, catMap, taxRate) : null),
    [report, period.year, catMap, categories.length, taxRate],
  );

  const value: Store = {
    me,
    refreshMe,
    categories,
    catMap,
    refreshCategories,
    period,
    setPeriod,
    report,
    refreshReport,
    year,
    version,
    bump: () => setVersion((v) => v + 1),
    lastDate,
    setLastDate,
    flashId,
    setFlashId,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
