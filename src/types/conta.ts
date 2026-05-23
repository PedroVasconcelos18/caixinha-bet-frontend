/**
 * Tipos do contrato da tela /minha-conta (2026-05).
 *
 * camelCase 1:1 com o backend (regra dura). Dinheiro como string decimal —
 * formatar via `@/lib/money`, NUNCA `Number`.
 */

export interface HistoricoResponse {
  totais: {
    totalCaixinhas: number;
    vitorias: number;
    /** Money decimal (string). Formatar com `formatBRL` em `@/lib/money`. */
    totalGanho: string;
    /** 0..1. Front formata como porcentagem inteira. */
    taxaAcerto: number;
  };
  atividadeRecente: EventoAtividade[];
}

export interface EventoAtividade {
  tipo: "vitoria" | "criacao" | "pagamento" | "cancelamento";
  titulo: string;
  /** ISO instant (`"2026-01-24T18:30:00Z"`). */
  ocorridoEm: string;
  /** Money decimal ou null. */
  valor: string | null;
}
