<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!--
  As regras abaixo são do PROJETO (mantidas à mão). Os marcadores acima são
  gerenciados pelo create-next-app e podem ser sobrescritos por upgrades —
  não editar conteúdo entre BEGIN/END. Adicionar conteúdo daqui pra baixo.
-->

## Regras duras do projeto Caixinha Bet (fundação — Story 1.2)

Estas regras são **load-bearing** (NFR-1, NFR-3, AR-8). Violar = retrabalho ou bug financeiro.

1. **Dinheiro NUNCA é `Number`/`number` em nenhuma camada do front.**
   - API entrega como string decimal (`"40.00"`).
   - No front: `Decimal` (decimal.js) via `@/lib/money` (`moneyFromApi`, `moneyToApi`).
   - Anti-padrões PROIBIDOS: `Number(x)`, `parseFloat(x)`, `JSON.parse` → `Number` em campo de dinheiro, aritmética com `+`/`-` nativos em valores monetários, formatação BRL com `Intl.NumberFormat` aplicada a `number` vindo da API.

2. **API: contrato fixo (espelha o backend).**
   - Sucesso = corpo direto (sem envelope). O tipo da resposta é o recurso.
   - Erro = RFC 9457 `application/problem+json` → use `ProblemDetails` e `isProblemDetails` de `@/lib/api`. NUNCA inventar formato de erro próprio.
   - **camelCase 1:1** com a API. NÃO converter naming no front (o backend já entrega camelCase).

3. **Mobile-first (NFR-3, load-bearing).**
   - Viewport-alvo: **360×640**. Alvos de toque ≥44px. Sem depender de `hover`.
   - **Sem scroll horizontal** nos fluxos críticos. O `body` em `globals.css` aplica `overflow-x: hidden` como guardrail — se algum componente legitimamente precisa de scroll horizontal, ele aplica no próprio container, NUNCA no `<body>`.
   - `viewport` no Next 16 é export próprio (`export const viewport: Viewport`), separado de `metadata`.
   - Tailwind 4 é mobile-first por padrão: utilitário sem prefixo = base/mobile; `sm:`/`md:` ampliam.

4. **Protótipo `docs/design/remixed-7b210df2.tsx` = referência de design/fluxo, NÃO de código.**
   - NUNCA copiar/portar nenhuma linha. O protótipo modela pagamento síncrono, taxa percentual, etapa "Palpites" (correto: "Resultados Possíveis"), hero-stat "R$ em jogo" — todos em conflito com o PRD v4.
   - Use só para entender a navegação (dashboard → wizard → detalhe + timeline) e a linguagem visual geral.

5. **`.env` real NUNCA versionado.** Só `.env.example`. `.gitignore` já cobre `.env*`. Não criar arquivos de config com segredos.

6. **Estrutura `src/`** fixada: `app/` (rotas), `components/`, `lib/`, `types/`. Não criar pastas paralelas em `src/`.

## Auth (Story 2.1)

Autenticação por **e-mail via magic link** (espelha o backend FR-16).

- **Rotas:** `/entrar` (form de e-mail), `/auth/callback?token=...&redirectTo=...`
  (consome o link, navega para `redirectTo` ou `/`).
- **`middleware.ts`** redireciona qualquer rota não-pública para
  `/entrar?redirectTo=<caminho>` quando o cookie `caixinhabet_sessao`
  está ausente. Verifica **presença**, não validade (validade vive no
  back).
- **`@/lib/auth`** — `solicitarAcesso`, `consumirCallback`, `me`, `sair`.
  Todos usam `apiFetch` (= `fetch` com `credentials: "include"`) — sem
  isso, o navegador não enviaria/aceitaria o cookie cross-origin.
- **`@/lib/api`** — `apiFetch`, `readApiResponse`, `ApiError` (encapsula
  `ProblemDetails`). Erro do back vira `ApiError` no `throw`.
- **Tom (NFR-6):** "Hora de entrar", "Confere o e-mail", "Link mágico
  expirado, solicita um novo" — caloroso, não-burocrático.
- **Smoke local:** `pnpm dev` + back rodando + Postgres no docker. Abre
  `/entrar`, manda o e-mail, copia o link `[MAGIC-LINK] ...` do log do
  back e cola no browser.

## Caixinha (Story 2.2)

Wizard de criação de Caixinha (FR-1, FR-3). Resumo:

- **Rotas:** `/caixinhas/nova` (wizard 6 etapas client-side, sem
  persistência intermediária); `/caixinhas/[id]` (detalhe).
- **`@/lib/caixinha`:** `criarCaixinha`, `buscarCaixinha` — usam
  `apiFetch` (`credentials: "include"`).
- **`@/types/caixinha`:** tipos do contrato. `valorIngresso` /
  `taxaServico` / `premioMaximoTeorico` são `string` (Money decimal).
- **Wizard = UX client-side:** `useState` para o draft, submit no final
  = 1 único `POST /caixinhas`. Abandonar perde tudo (mesma UX de
  carrinho sem login).
- **Validação:** inline no front (feedback rápido) + back valida tudo
  de novo. Erro 422 do back vem com `problem.violations: string[]` —
  exibir lista no topo do form.
- **Imutabilidade visível ao usuário** (FR-3): a etapa de Revisão
  declara explicitamente os 4 campos imutáveis pós-criação (valor,
  prazos, resultados).
- **Mobile-first 360×640:** inputs/botões ≥44px, sem scroll horizontal
  (regra dura).
- **Story 2.3 — sugestão automática:** `sugerirResultados(ladoA, ladoB)`
  em `@/lib/caixinha` é função pura (`string[] | null`). O componente
  `SugerirBotao` na etapa 2 do wizard só renderiza se não-`null` (AC-2),
  e usa `window.confirm` nativo (zero deps) para confirmar substituição
  quando há rótulo digitado (AC-3).
- **Story 2.4 — convidar Participantes:** `@/lib/caixinha.convidar(id, emails)`
  chama `POST /caixinhas/{id}/convites`. Na página `/caixinhas/[id]`, a
  seção `ConvidarMais` aparece SÓ se o usuário logado é o dono E o
  estado da Caixinha é `coletando_convites`/`coletando_pagamentos`.
  Compara `me().email` com `participantes.find(p => p.dono).email`.
  Após convidar, a página re-fetch sem `window.location.reload`.
- **Story 2.5 — aceitar convite + palpitar:** `/convites/[id]/page.tsx`
  é a tela acessada pelo link do e-mail. `@/lib/caixinha` exporta
  `buscarConvite`, `aceitarConvite`, `definirPalpite`. Aceite é
  idempotente; definir palpite com status=convidado faz aceite implícito.
  Radios de palpite usam `<input type="radio" onChange>` — clicar dispara
  `PUT /palpite` direto. Após prazo, fieldset fica `disabled`.

## Comandos úteis

- `pnpm dev` — Turbopack em `http://localhost:3000`.
- `pnpm build` — build de produção; falha em erros de TS.
- `pnpm lint` — ESLint Next + TS.
- `pnpm test:e2e` — Playwright (viewport 360×640) garante mobile-first.

## Onde estão os contratos

- `src/lib/money.ts` — fronteira de dinheiro (string ⇄ `Decimal`).
- `src/lib/api.ts` — `ProblemDetails`, `isProblemDetails`, `API_BASE_URL`.
- `playwright.config.ts` — viewport-alvo e webServer.
