/**
 * Tipos do contrato HTTP de Caixinha (Story 2.2).
 *
 * camelCase 1:1 com a API. `valorIngresso`/`taxaServico`/`premioMaximoTeorico`
 * chegam como string decimal (Money) — converter via `@/lib/money` se for
 * para cálculo; renderização direta é OK.
 */

export interface CriarCaixinhaRequest {
  titulo: string;
  ladoA: string;
  ladoB: string;
  /** Money como string decimal (ex.: "40.00"). */
  valorIngresso: string;
  minimoParticipantes: number;
  /** ISO 8601 UTC. */
  prazoEntrada: string;
  /** ISO 8601 UTC. */
  dataApuracao: string;
  rotulosResultados: string[];
  emailsConvidados?: string[];
}

export interface ResultadoResponse {
  /** Story 2.5: id usado em PUT /palpite. */
  id: number;
  ordem: number;
  rotulo: string;
}

export interface ParticipanteResumoResponse {
  email: string;
  dono: boolean;
  /** Enum string snake_case do back: convidado/aceito/pagamento_iniciado/pago. */
  status: string;
  /** Story 2.5: id do Resultado Possível escolhido, ou null. */
  palpiteResultadoPossivelId: number | null;
}

export interface CaixinhaResponse {
  id: number;
  titulo: string;
  ladoA: string;
  ladoB: string;
  valorIngresso: string;
  minimoParticipantes: number;
  prazoEntrada: string;
  dataApuracao: string;
  /** Enum snake_case do back: coletando_convites, etc. */
  estado: string;
  taxaServico: string;
  premioMaximoTeorico: string;
  criadoEm: string;
  resultadosPossiveis: ResultadoResponse[];
  participantes: ParticipanteResumoResponse[];
}

/** Resposta de POST /caixinhas/{id}/convites (Story 2.4). */
export interface EnviarConvitesResponse {
  convidados: string[];
  jaPresentes: string[];
}

/** Visão do próprio Participante no convite (Story 2.5). */
export interface ParticipanteMeResponse {
  email: string;
  status: string;
  palpiteResultadoPossivelId: number | null;
}

/** Resposta de GET /caixinhas/{id}/convite (Story 2.5). */
export interface ConviteResponse {
  caixinhaId: number;
  titulo: string;
  ladoA: string;
  ladoB: string;
  valorIngresso: string;
  taxaServico: string;
  estado: string;
  prazoEntrada: string;
  resultadosPossiveis: ResultadoResponse[];
  eu: ParticipanteMeResponse;
}

/** Resposta de POST /aceitar e PUT /palpite (Story 2.5). */
export interface ParticipanteResponse {
  id: number;
  caixinhaId: number;
  email: string;
  status: string;
  dono: boolean;
  palpiteResultadoPossivelId: number | null;
}
