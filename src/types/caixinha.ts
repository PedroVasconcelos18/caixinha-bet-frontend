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
  /** v5 (FR-1): 1, 2 ou 3 — entre quantos o Prêmio é rateado. ≤ minimoParticipantes. */
  numeroGanhadores: number;
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
  /** Story 3.5: rótulo legível do Palpite (ex.: "Vitória do Brasil"), ou null. */
  palpiteRotulo: string | null;
}

export interface CaixinhaResponse {
  id: number;
  titulo: string;
  ladoA: string;
  ladoB: string;
  valorIngresso: string;
  minimoParticipantes: number;
  /** v5 (FR-1): 1, 2 ou 3. */
  numeroGanhadores: number;
  prazoEntrada: string;
  dataApuracao: string;
  /** Enum snake_case do back: coletando_convites, etc. */
  estado: string;
  taxaServico: string;
  premioMaximoTeorico: string;
  /** Story 3.5: valorIngresso × nº de Participantes `pago` (Money string). */
  totalCustodiado: string;
  /** Story 3.5: max(totalCustodiado − taxa, 0) (Money string). */
  premioPotencial: string;
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

/** Resposta de POST/GET /caixinhas/{id}/cobranca (Story 3.2, FR-7). */
export interface CobrancaResponse {
  cobrancaId: string;
  /** Código PIX copia-e-cola (BR-Code). */
  copiaECola: string;
  /** Imagem do QR code em base64 — usar em <img src="data:image/png;base64,...">. */
  qrCodeBase64: string;
  /** ISO 8601 UTC. */
  expiraEm: string;
  /** Money string decimal (ex.: "40.00"). */
  valor: string;
  /** Estado da cobrança: ativa/invalidada/expirada/confirmada. */
  estado: string;
}

/** Corpo de POST /caixinhas/{id}/apuracao (Story 4.2, FR-12). */
export interface ApurarCaixinhaRequest {
  resultadoFinalId: number;
  /**
   * ids de Participante escolhidos como Ganhadores — usado SÓ quando há
   * mais palpiteiros corretos que o Nº de Ganhadores. Omitir/vazio quando
   * a seleção é automática.
   */
  ganhadoresEscolhidos?: number[];
}

/** Resposta de POST /caixinhas/{id}/apuracao (Story 4.2). */
export interface ApuracaoResponse {
  resultadoFinalId: number;
  ganhadoresIds: number[];
  /** true = 0 palpiteiros corretos; front exibe Acerto de Contas modo reembolso. */
  modoReembolso: boolean;
}

/**
 * Candidato a Ganhador — vem na extensão `candidatos` do problem+json
 * 422 quando há mais palpiteiros corretos que o Nº de Ganhadores.
 */
export interface CandidatoGanhador {
  participanteId: number;
  email: string;
}

/** Um Ganhador no Acerto de Contas modo prêmio (Story 4.4). */
export interface ItemGanhador {
  email: string;
  /** Money string decimal. */
  valor: string;
  /** aguardando_aceite | pix_em_andamento | pago | falha_pix. */
  estadoRepasse: string;
  /** Comprovante do PIX — null enquanto não pago. */
  comprovante: string | null;
}

/** Um Participante reembolsado no Acerto de Contas modo reembolso (Story 4.4/5.2). */
export interface ItemReembolso {
  email: string;
  /** Money string decimal — ingresso cheio (Taxa devolvida). */
  valorEstorno: string;
  /** Story 5.2: em_processamento | concluido — null se estorno não disparado. */
  estadoEstorno: string | null;
}

/** Resumo de uma Caixinha no dashboard — item de GET /caixinhas (Story 6.1). */
export interface CaixinhaResumoResponse {
  id: number;
  titulo: string;
  /** "Brasil × Marrocos". */
  confronto: string;
  /** Estado snake_case. */
  estado: string;
  pagosConfirmados: number;
  minimoParticipantes: number;
  /** Money string decimal. */
  premioPotencial: string;
  /** false se a Caixinha está em estado terminal (repassada/cancelada). */
  ativa: boolean;
}

/** Resposta de GET /caixinhas/{id}/acerto (Story 4.4, FR-14). */
export interface AcertoContasResponse {
  /** premio | reembolso | indisponivel. */
  modo: string;
  /** Estado da Caixinha (snake_case). */
  estadoCaixinha: string;
  /** Money string. */
  taxaServico: string;
  /** Money string. */
  totalCustodiado: string;
  ganhadores: ItemGanhador[];
  reembolsos: ItemReembolso[];
}
