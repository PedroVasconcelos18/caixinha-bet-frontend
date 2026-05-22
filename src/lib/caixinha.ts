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
  AcertoContasResponse,
  ApuracaoResponse,
  ApurarCaixinhaRequest,
  CaixinhaResponse,
  ConviteResponse,
  CriarCaixinhaRequest,
  EnviarConvitesResponse,
  ParticipanteResponse,
} from "@/types/caixinha";

/** Type RFC 9457 do back — 422 de apuração inválida. */
export const TYPE_APURACAO_INVALIDA =
  "https://caixinha.bet/problems/apuracao-invalida";

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
 * Apura a Caixinha (Story 4.2, FR-12).
 *
 * `POST /caixinhas/{id}/apuracao`. 200 com `ApuracaoResponse`.
 *
 * Erros:
 *  - 403 não-Organizador; 404 não-Participante.
 *  - 422 `.../problems/apuracao-invalida` — estado errado, já apurada,
 *    Resultado Final inválido, OU mais palpiteiros corretos que o Nº de
 *    Ganhadores. Neste último caso o problem+json traz a extensão
 *    `candidatos: CandidatoGanhador[]` para o front montar a seleção.
 */
export async function apurarCaixinha(
  caixinhaId: number,
  req: ApurarCaixinhaRequest,
): Promise<ApuracaoResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/apuracao`, {
    method: "POST",
    body: JSON.stringify(req),
  });
  const body = await readApiResponse<ApuracaoResponse>(resp);
  if (!body) {
    throw new Error(
      "POST /caixinhas/:id/apuracao devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}

/**
 * O Ganhador aceita o prêmio — dispara o PIX (Story 4.6, FR-13).
 *
 * `POST /caixinhas/{id}/aceitar-premio`. 200 com `{ estadoPayout,
 * comprovante }`. Idempotente — chamar 2x não duplica o PIX.
 *
 * Erros: 422 chave-pix-obrigatoria (sem chave), 422 pagamento-indisponivel
 * (não é Ganhador).
 */
export async function aceitarPremio(
  caixinhaId: number,
): Promise<{ estadoPayout: string; comprovante: string | null }> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/aceitar-premio`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await readApiResponse<{
    estadoPayout: string;
    comprovante: string | null;
  }>(resp);
  if (!body) {
    throw new Error(
      "POST /caixinhas/:id/aceitar-premio devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}

/**
 * Encerra manualmente o prazo de entrada (Story 4.5, FR-15).
 *
 * `POST /caixinhas/{id}/encerrar-prazo`. 200 com `{ estadoResultante,
 * reembolsoPendente }`. 403 não-Organizador; 422 estado terminal.
 */
export async function encerrarPrazo(
  caixinhaId: number,
): Promise<{ estadoResultante: string; reembolsoPendente: boolean }> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/encerrar-prazo`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await readApiResponse<{
    estadoResultante: string;
    reembolsoPendente: boolean;
  }>(resp);
  if (!body) {
    throw new Error(
      "POST /caixinhas/:id/encerrar-prazo devolveu corpo vazio (esperado 200)",
    );
  }
  return body;
}

/**
 * Busca o Acerto de Contas — o desfecho da Caixinha (Story 4.4, FR-14).
 *
 * `GET /caixinhas/{id}/acerto`. 200 com `AcertoContasResponse`
 * (`modo`: premio / reembolso / indisponivel). 404 se não-Participante.
 */
export async function buscarAcertoContas(
  caixinhaId: number,
): Promise<AcertoContasResponse> {
  const resp = await apiFetch(`/caixinhas/${caixinhaId}/acerto`, {
    method: "GET",
  });
  const body = await readApiResponse<AcertoContasResponse>(resp);
  if (!body) {
    throw new Error(
      "GET /caixinhas/:id/acerto devolveu corpo vazio (esperado 200)",
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
