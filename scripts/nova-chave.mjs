// Cria chaves de ativação enquanto o painel da Luize (Fase 2) não fica pronto.
// Uso: npm run chave -- anual 3            (3 chaves anuais no banco local)
//      npm run chave -- mensal 1 --remote  (1 chave mensal no banco publicado)
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

const PLANS = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
const args = process.argv.slice(2);
const remote = args.includes("--remote");
const [plan = "anual", qtd = "1"] = args.filter((a) => !a.startsWith("--"));
if (!PLANS[plan]) {
  console.error(`Plano inválido. Use: ${Object.keys(PLANS).join(", ")}`);
  process.exit(1);
}
const n = Math.max(1, Math.min(50, Number(qtd) || 1));
const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codes = Array.from({ length: n }, () => {
  const b = randomBytes(12);
  let s = "ADC";
  for (let i = 0; i < 12; i++) s += (i % 4 === 0 ? "-" : "") + A[b[i] % A.length];
  return s;
});
const sql = codes
  .map((c) => `INSERT INTO license_keys (id, code, plan, months) VALUES ('${randomUUID()}', '${c}', '${plan}', ${PLANS[plan]});`)
  .join("\n");
execFileSync("npx", ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
console.log(`\nChave(s) ${plan}:\n${codes.join("\n")}`);
