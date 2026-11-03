# Além da Cadeira

App de lucratividade para salões, baseado na planilha DRE 2026 do método Além da Cadeira (Luize Freire).

- **Front:** React + Vite + TypeScript (pasta `src/`), visual aprovado no mockup.
- **API:** Cloudflare Worker com Hono (pasta `worker/`), no mesmo domínio em `/api`.
- **Banco:** Cloudflare D1 (migrações em `migrations/`).
- **Regras do método:** `shared/dre.ts` (plano de contas padrão, sugestões, DRE do mês, faixas de lucratividade), com testes em `tests/`.

## Rodar no computador

```bash
npm install
npm run db:migrate:local
npm run chave -- anual 1     # cria uma chave de ativação local
npm run dev                  # http://localhost:5173
```

## Publicar na Cloudflare (pelo GitHub)

1. Painel da Cloudflare › Storage & Databases › D1 › **Create database** com o nome `alem-da-cadeira`. Copie o **Database ID** para `wrangler.jsonc`.
2. Workers & Pages › Create › **Import a repository** › escolha este repositório.
   - Build command: `npm run build`
   - Deploy command: `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`
3. Cada push na branch `main` publica sozinho.

Conta da administradora (Luize) no banco publicado: `npm run admin -- email@dela.com "Luize Freire" --remote` (mostra uma senha provisória). Depois ela gera as chaves pelo próprio painel.

## Fases

1. **App da cliente** (pronta): ativação por chave, login, lançamentos com data, plano de contas, Início, DRE do mês, ajustes.
2. **Painel da Luize** (pronta): chaves, clientes, painel de cada cliente (só leitura), logs de acessos e vencimentos, tempo de uso, cobrança.
3. Pró-labore (percentual editável), metas e prêmios, reserva.
4. PWA, importar a planilha, domínio próprio, testes com a Luize.
