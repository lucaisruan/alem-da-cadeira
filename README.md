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

## Publicar na Cloudflare

Automático pelo GitHub Actions (`.github/workflows/publicar.yml`): cada push na `main` testa, cria o banco D1 se precisar, aplica as migrações e publica em **app.luizefreire.site**.

- O token da Cloudflare fica no segredo `CLOUDFLARE_API_TOKEN` do repositório (Settings › Secrets and variables › Actions).
- Conta da administradora: Actions › Publicar na Cloudflare › Run workflow, informando o e-mail. A senha provisória aparece no log do passo "Administradora"; troque no primeiro acesso.

## Fases

1. **App da cliente** (pronta): ativação por chave, login, lançamentos com data, plano de contas, Início, DRE do mês, ajustes.
2. **Painel da Luize** (pronta): chaves, clientes, painel de cada cliente (só leitura), logs de acessos e vencimentos, tempo de uso, cobrança.
3. Pró-labore (percentual editável), metas e prêmios, reserva.
4. PWA, importar a planilha, domínio próprio, testes com a Luize.
