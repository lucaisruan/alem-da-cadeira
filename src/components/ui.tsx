import { useEffect, useRef, type ReactNode } from "react";
import { MONTHS } from "../../shared/dre";
import { pct } from "../lib";
import { navigate, useStore } from "../store";

/* ---------- ícones (traço simples, 22px) ---------- */
const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export const Icon = {
  home: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></svg>,
  list: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></svg>,
  plus: <svg width="24" height="24" viewBox="0 0 24 24" {...P} strokeWidth={2.4} aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  dre: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>,
  tags: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.4" /></svg>,
  cog: <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  moon: <svg width="20" height="20" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>,
  left: <svg width="20" height="20" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>,
  right: <svg width="20" height="20" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>,
  out: <svg width="20" height="20" viewBox="0 0 24 24" {...P} aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
};

export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: ReactNode; "aria-current"?: "page" | undefined; "aria-label"?: string }) {
  return (
    <a
      href={to}
      className={className}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <>
      <img className={`${className || ""} logo-l`} src="/logo.png" alt="Além da Cadeira" />
      <img className={`${className || ""} logo-d`} src="/logo-escuro.png" alt="Além da Cadeira" />
    </>
  );
}

/** ‹ Outubro 2026 › — muda o mês que as telas mostram. */
export function MonthPicker() {
  const { period, setPeriod } = useStore();
  const go = (d: number) => {
    let m = period.month + d, y = period.year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setPeriod({ year: y, month: m });
  };
  const now = new Date();
  const isFuture = period.year > now.getFullYear() || (period.year === now.getFullYear() && period.month >= now.getMonth() + 1);
  return (
    <div className="mpick" role="group" aria-label="Mês">
      <button type="button" onClick={() => go(-1)} aria-label="Mês anterior">{Icon.left}</button>
      <span aria-live="polite">{MONTHS[period.month - 1]} {period.year}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próximo mês" disabled={isFuture}>{Icon.right}</button>
    </div>
  );
}

export function Delta({ cur, prev, invert, label, points }: { cur: number; prev: number | null; invert?: boolean; label: string; points?: boolean }) {
  if (prev === null || (!points && !prev)) return <span className="dl">sem comparação</span>;
  if (points) {
    const d = (cur - prev) * 100;
    const flat = Math.abs(d) < 0.05;
    return <span className={`dl ${flat ? "" : d > 0 ? "up" : "down"}`}>{flat ? "= " : d > 0 ? "▲ " : "▼ "}{Math.abs(d).toFixed(1).replace(".", ",")} p.p. vs {label}</span>;
  }
  const d = (cur - prev) / Math.abs(prev);
  const up = d >= 0, flat = Math.abs(d) < 0.005, good = invert ? !up : up;
  return <span className={`dl ${flat ? "" : good ? "up" : "down"}`}>{flat ? "= " : up ? "▲ " : "▼ "}{pct(Math.abs(d))} vs {label}</span>;
}

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 100 28" aria-hidden="true" />;
  const mx = Math.max(...values), mn = Math.min(...values), r = mx - mn || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * 96 + 2).toFixed(1)},${(26 - ((v - mn) / r) * 22).toFixed(1)}`);
  const [lx, ly] = pts[pts.length - 1].split(",");
  return (
    <svg className="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="2.4" fill="currentColor" />
    </svg>
  );
}

export function Confirm({ open, title, text, okLabel, danger, onClose }: { open: boolean; title: string; text: string; okLabel: string; danger?: boolean; onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(false); }}>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      <div className="row">
        <button className="ghost" type="button" onClick={() => onClose(false)}>Cancelar</button>
        <button className="cta" type="button" style={danger ? { background: "var(--bad)", color: "#fff" } : undefined} onClick={() => onClose(true)}>{okLabel}</button>
      </div>
    </dialog>
  );
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="skel" style={{ height: h }} aria-hidden="true" />;
}
