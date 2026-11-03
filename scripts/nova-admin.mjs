// Cria (ou troca a senha de) uma conta de administradora do painel.
// Uso: npm run admin -- luize@email.com "Luize Freire"            (banco local)
//      npm run admin -- luize@email.com "Luize Freire" --remote   (banco publicado)
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const [email, name = "Administradora"] = args.filter((a) => !a.startsWith("--"));
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: npm run admin -- email@exemplo.com "Nome"');
  process.exit(1);
}
const b64 = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const password = b64(randomBytes(9));
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256");
const stored = `pbkdf2$100000$${b64(salt)}$${b64(hash)}`;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sql = `INSERT INTO users (id, salon_id, role, name, email, password_hash) VALUES (${q(randomUUID())}, NULL, 'admin', ${q(name)}, ${q(email.toLowerCase())}, ${q(stored)})
ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = 'admin', failed_logins = 0, locked_until = NULL;`;
execFileSync("npx", ["wrangler", "d1", "execute", "DB", remote ? "--remote" : "--local", "--command", sql], { stdio: "inherit" });
console.log(`\nAdministradora: ${email}\nSenha provisória: ${password}\n`);
