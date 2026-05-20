/**
 * Cliente HTTP de Caixinha (Story 2.2).
 *
 * Espelha os endpoints do backend:
 *  - criarCaixinha → POST /caixinhas (201 + body)
 *  - buscarCaixinha → GET /caixinhas/{id} (200 / 404 anti-enumeração)
 *
 * Erros respeitam ApiError (ProblemDetails). 422 vem com
 * `problem.violations` (extensão RFC 9457).
 */
import { apiFetch, readApiResponse } from "./api";
import type {
  CaixinhaResponse,
  ConviteResponse,
  CriarCaixinhaRequest,
  EnviarConvitesResponse,
  ParticipanteResponse,
} from "@/types/caixinha";

export async function criarCaixinha(
  req: CriarCaixinhaRequest,
): Promise<CaixinhaResponse> {
  const resp = await apiFetch("/caixinhas", {
    method: "POST",
    body: JSON.stringify(req),
  });
  const body = await readApiResponse<CaixinhaResponse>(resp);
  if (!body) {
    throw new Error("POST /caixinhas devolveu corpo vazio (esperado 201)");
  }
  return body;
}

export async function buscarCaixinha(id: number): Promise<CaixinhaResponse> {
  const resp = await apiFetch(`/caixinhas/${id}`, { method: "GET" });
  const body = await readApiResponse<CaixinhaResponse>(resp);
  if (!body) {
    throw new Error("GET /caixinhas/:id devolveu corpo vazio (esperado 200)");
  }
  return body;
}

/**
 * Convida novos Participantes (Story 2.4, FR-4).
 *
 * `POST /caixinhas/{id}/convites`. Sucesso = 200 com `convidados`
 * (novos) e `jaPresentes` (informativo, não-erro).
 *
 * Erros: 401 (sessão expirada), 403 (não é dono), 422 (prazo encerrado).
 */
export async function convidar(
  caixinhaId: number,
  emails: string[],
): Promise<EnviarConvitesResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/convites`, {
    method: "POST",
    body: JSON.stringify({ emails }),
  });
  const body = await readApiResponse<EnviarConvitesResponse>(resp);
  if (!body) {
    throw new Error(
      "POST /caixinhas/:id/convites devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}

/**
 * Carrega a tela do convite (Story 2.5).
 *
 * `GET /caixinhas/{id}/convite`. 200 = `ConviteResponse`; 404 se o
 * usuário autenticado não foi convidado (anti-enumeração).
 */
export async function buscarConvite(
  caixinhaId: number,
): Promise<ConviteResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/convite`, {
    method: "GET",
  });
  const body = await readApiResponse<ConviteResponse>(resp);
  if (!body) {
    throw new Error(
      "GET /caixinhas/:id/convite devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}

/** Aceita o convite (Story 2.5). Idempotente — chamar 2x é OK. */
export async function aceitarConvite(
  caixinhaId: number,
): Promise<ParticipanteResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/aceitar`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await readApiResponse<ParticipanteResponse>(resp);
  if (!body) {
    throw new Error(
      "POST /caixinhas/:id/aceitar devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}

/**
 * Define/altera o Palpite (Story 2.5).
 *
 * `PUT /caixinhas/{id}/palpite`. 200 com Participante; 422 se prazo
 * encerrado ou se resultadoPossivelId não pertence à Caixinha.
 *
 * Se o status atual é `convidado`, o aceite é implícito (transição
 * para `aceito` na mesma chamada).
 */
export async function definirPalpite(
  caixinhaId: number,
  resultadoPossivelId: number,
): Promise<ParticipanteResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/palpite`, {
    method: "PUT",
    body: JSON.stringify({ resultadoPossivelId }),
  });
  const body = await readApiResponse<ParticipanteResponse>(resp);
  if (!body) {
    throw new Error(
      "PUT /caixinhas/:id/palpite devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}

/**
 * Sugere os 3 Resultados Possíveis padrão (Story 2.3, FR-2):
 * `["Vitória de {ladoA}", "Empate", "Vitória de {ladoB}"]`.
 *
 * Retorna `null` quando qualquer lado é vazio (após `trim`) — sinaliza
 * ao componente "não oferecer o botão" (AC-2). Distinto de array vazio:
 * o caller usa `if (sugestao !== null)`.
 *
 * Função pura: testável isoladamente, sem network.
 */
export function sugerirResultados(
  ladoA: string,
  ladoB: string,
): string[] | null {
  const a = ladoA.trim();
  const b = ladoB.trim();
  if (a.length === 0 || b.length === 0) {
    return null;
  }
  return [`Vitória de ${a}`, "Empate", `Vitória de ${b}`];
}
