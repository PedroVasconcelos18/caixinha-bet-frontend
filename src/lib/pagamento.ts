/**
 * Cliente HTTP de pagamento PIX (Story 3.2 v5, FR-7).
 *
 * Espelha o `PagamentoController` do backend:
 *  - gerarCobranca → POST /caixinhas/{id}/cobranca (201)
 *  - buscarCobranca → GET /caixinhas/{id}/cobranca (200 / 404 sem ativa)
 *
 * Erros respeitam ApiError (ProblemDetails). 422 com type específico:
 *  - .../problems/pagamento-indisponivel (estado errado, sem palpite)
 *  - .../problems/chave-pix-obrigatoria (perfil de pagamento incompleto)
 */
import { apiFetch, readApiResponse } from "./api";
import type { CobrancaResponse } from "@/types/caixinha";

/** Type RFC 9457 do back — front distingue sem inspecionar texto. */
export const TYPE_PAGAMENTO_INDISPONIVEL =
  "https://caixinha.bet/problems/pagamento-indisponivel";
export const TYPE_CHAVE_PIX_OBRIGATORIA =
  "https://caixinha.bet/problems/chave-pix-obrigatoria";

/**
 * Gera uma cobrança PIX para o ingresso (Story 3.2).
 *
 * `POST /caixinhas/{id}/cobranca`. 201 com `CobrancaResponse`. Invalida
 * automaticamente a cobrança ativa anterior, se houver (FR-7).
 */
export async function gerarCobranca(
  caixinhaId: number,
): Promise<CobrancaResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/cobranca`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await readApiResponse<CobrancaResponse>(resp);
  if (!body) {
    throw new Error(
      "POST /caixinhas/:id/cobranca devolveu corpo vazio (esperado 201)",
    );
  }
  return body;
}

/**
 * Busca a cobrança ativa do Participante (Story 3.2). Usado pela tela
 * de pagamento ao recarregar. 404 se não há cobrança ativa.
 */
export async function buscarCobranca(
  caixinhaId: number,
): Promise<CobrancaResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/cobranca`, {
    method: "GET",
  });
  const body = await readApiResponse<CobrancaResponse>(resp);
  if (!body) {
    throw new Error(
      "GET /caixinhas/:id/cobranca devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}
