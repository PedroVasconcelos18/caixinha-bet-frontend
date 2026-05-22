/**
 * Contrato de dinheiro do frontend — regra DURA, load-bearing (NFR-1, AR-8).
 *
 * Espelha o backend (Story 1.1/1.3): valor monetário trafega no JSON como
 * STRING decimal (ex.: `"40.00"`), nunca como número JSON. No front o tipo
 * é `Decimal` (decimal.js) — NUNCA `Number`/`number` para dinheiro.
 *
 * Anti-padrão PROIBIDO: `JSON.parse(...).valor as number`, `Number(valor)`,
 * `parseFloat(valor)` em campo de dinheiro, ou aritmética monetária com o
 * operador `+`/`-` nativo. Toda conta de dinheiro passa por `Decimal`.
 *
 * Implementação completa (formatação BRL, soma de pote, rateio) chega no
 * épico que consumir API com dinheiro. Aqui ficam apenas as fronteiras de
 * conversão string⇄Decimal, fixadas por construção desde a fundação.
 */
import Decimal from "decimal.js";

/** Marca semântica: string decimal vinda da API (ex.: "40.00"). */
export type MoneyString = string;

/**
 * Converte a string decimal da API em `Decimal`. Único ponto de entrada de
 * dinheiro no front. Lança se o valor não for uma string decimal válida —
 * falhar alto é melhor que propagar dinheiro corrompido.
 */
export function moneyFromApi(value: MoneyString): Decimal {
  if (typeof value !== "string") {
    throw new TypeError(
      `Dinheiro deve chegar como string decimal da API, recebido: ${typeof value}`,
    );
  }
  const d = new Decimal(value);
  if (!d.isFinite()) {
    throw new RangeError(`Valor monetário inválido: "${value}"`);
  }
  return d;
}

/**
 * Serializa um `Decimal` de volta para string decimal com 2 casas (centavos)
 * para enviar à API. Nunca expõe `number`.
 */
export function moneyToApi(value: Decimal): MoneyString {
  return value.toFixed(2);
}

/**
 * Formata para exibição em Real (ex.: `"1234.5"` → `"R$ 1.234,50"`).
 *
 * Aceita `MoneyString` (vinda da API) ou `Decimal` (resultado de cálculo).
 * A conversão para `number` acontece SÓ aqui, na última milha de
 * apresentação, sobre um valor já validado por `moneyFromApi` — nunca em
 * cálculo. `Intl.NumberFormat` é puramente cosmético neste ponto.
 */
export function formatBRL(value: MoneyString | Decimal): string {
  const d = typeof value === "string" ? moneyFromApi(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(d.toNumber());
}

export { Decimal };
