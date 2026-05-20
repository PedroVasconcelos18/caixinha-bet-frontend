# caixinha-bet-frontend

Frontend do **Caixinha Bet** — Next.js 16.2.6 / React 19 / Tailwind 4 / App
Router / TypeScript / pnpm. Mobile-first real (NFR-3).

> ⚠️ Este produto custodia dinheiro de terceiros via Asaas. **Corretude
> monetária tem precedência sobre prazo e performance** (NFR-1). NUNCA
> representar dinheiro como `Number`/`number` no front — sempre `Decimal`
> (`decimal.js`) com strings decimais na borda da API.

## Pré-requisitos

- **Node.js ≥ 20.9** (LTS). Verificado em `v20.19.6`.
- **pnpm ≥ 10** (este projeto usa `10.33.2`). Habilite via Corepack:
  `corepack enable && corepack prepare pnpm@latest --activate`.
- **Docker** (opcional, só para integração com o backend).

## Decisão de stack (registrada — Story 1.2)

Versões efetivas instaladas:

| Item              | Versão        |
| ----------------- | ------------- |
| Next.js           | `16.2.6`      |
| React / React-DOM | `19.2.4`      |
| TypeScript        | `5.9.x`       |
| Tailwind CSS      | `4.3.x`       |
| ESLint            | `9.x`         |
| decimal.js        | `10.6.0`      |
| @playwright/test  | `1.60.0`      |

Tailwind 4 dispensa `tailwind.config.ts` — config via CSS (`@import
"tailwindcss"` + `@theme` em `src/app/globals.css`) e `postcss.config.mjs`.
Variância em relação ao texto da architecture, intencional e alinhada ao
default do `create-next-app@16.2.6`.

## Comandos

```bash
# 1. Instalar deps (uma vez ou após pull)
pnpm install

# 2. Dev server (Turbopack)
pnpm dev                # http://localhost:3000

# 3. Build de produção
pnpm build

# 4. Lint
pnpm lint

# 5. Testes e2e mobile-first (sobe pnpm dev automaticamente)
pnpm test:e2e
```

## Estrutura

```
src/
├── app/           # App Router — layout.tsx + page.tsx (placeholder)
│                  # As telas reais entram nos épicos 2/6.
├── components/    # Componentes de UI (vazio na fundação)
├── lib/
│   ├── money.ts   # Contrato dinheiro (decimal.js; NUNCA Number)
│   └── api.ts     # Contrato HTTP (RFC 9457 ProblemDetails; camelCase 1:1)
└── types/         # Tipos de domínio (placeholder)

tests/
└── e2e/
    └── mobile-first.spec.ts   # Guardrail Playwright 360×640

playwright.config.ts
```

## Regras duras do projeto

- **Dinheiro**: API entrega como string decimal (`"40.00"`); no front usar
  `Decimal` (decimal.js) via `@/lib/money`. Anti-padrão proibido: `Number`,
  `parseFloat`, `+`/`-` nativos em campo de dinheiro.
- **API**: sucesso = corpo direto (sem envelope); erro = RFC 9457
  `application/problem+json` (`ProblemDetails` em `@/lib/api`); camelCase
  1:1 — sem conversão de naming no front.
- **Mobile-first (NFR-3)**: viewport-alvo 360×640, toque ≥44px, sem hover,
  sem scroll horizontal. O `body` aplica `overflow-x: hidden` por
  construção; testes Playwright fazem cumprir.
- **Protótipo `docs/design/remixed-7b210df2.tsx`**: referência **de design e
  fluxo**, NUNCA de código. NÃO copiar/portar nenhum trecho — o protótipo
  modela pagamento síncrono, taxa percentual e outros desvios que vão contra
  o PRD.
- **`.env` real NUNCA versionado** — só `.env.example`.

## Quando algo do Next 16 parecer estranho

O `AGENTS.md` deste repo avisa: o Next 16 tem **breaking changes** vs. o que
você aprendeu — confira `node_modules/next/dist/docs/` antes de escrever
código novo. Em particular, viewport é um export separado de metadata.
