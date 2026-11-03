// Roda no GitHub Actions antes de publicar: descobre a conta da Cloudflare,
// cria o banco D1 se ainda não existir e confere o domínio.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_NAME = "alem-da-cadeira";
const ZONE = "luizefreire.site";
if (!TOKEN) {
  console.error("Falta o segredo CLOUDFLARE_API_TOKEN no repositório (Settings › Secrets and variables › Actions).");
  process.exit(1);
}
async function cf(path, init = {}) {
  const r = await fetch("https://api.cloudflare.com/client/v4" + path, {
    ...init,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", ...(init.headers || {}) },
  });
  const j = await r.json();
  if (!j.success) throw new Error(`${path}: ${JSON.stringify(j.errors)}`);
  return j.result;
}

let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!accountId) {
  const accounts = await cf("/accounts?per_page=50");
  if (!accounts.length) throw new Error("O token não enxerga nenhuma conta.");
  accountId = accounts[0].id;
  console.log(`Conta: ${accounts[0].name}`);
}
appendFileSync(process.env.GITHUB_ENV, `CLOUDFLARE_ACCOUNT_ID=${accountId}\n`);

const list = await cf(`/accounts/${accountId}/d1/database?name=${DB_NAME}&per_page=50`);
let db = list.find((d) => d.name === DB_NAME);
if (!db) {
  db = await cf(`/accounts/${accountId}/d1/database`, { method: "POST", body: JSON.stringify({ name: DB_NAME }) });
  console.log(`Banco D1 criado: ${db.uuid}`);
} else console.log(`Banco D1 encontrado: ${db.uuid}`);

let cfg = readFileSync("wrangler.jsonc", "utf8").replace(/"database_id":\s*"[^"]*"/, `"database_id": "${db.uuid}"`);
const zones = await cf(`/zones?name=${ZONE}`).catch(() => []);
if (!zones.length) {
  console.log(`::warning::O domínio ${ZONE} não está nesta conta da Cloudflare. Publicando só no endereço workers.dev.`);
  cfg = cfg.replace(/"routes":\s*\[[^\]]*\],?\s*/, "");
} else console.log(`Domínio ${ZONE} encontrado.`);
writeFileSync("wrangler.jsonc", cfg);
