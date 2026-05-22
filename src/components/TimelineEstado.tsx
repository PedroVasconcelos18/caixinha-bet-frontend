/**
 * Timeline de Estado da Caixinha (Story 6.2 / FR-17 — redesenhada na
 * Story 7.5 do Épico 7 para o design aprovado: trilha horizontal de 4 nós.
 *
 * Decisão registrada (Épico 7): a trilha tem 4 nós e o nó final "Apurada"
 * ABSORVE a evolução pós-apuração — exibe sub-rótulo "repasse em andamento"
 * (estado `repasse_parcial`) ou "repasse concluído" (`repassada`). Repasse
 * é etapa do nó "Apurada", não um 5º nó.
 *
 *   Coletando aceites → Coletando PIX → Formada → Apurada(+repasse)
 *
 * `cancelada` NÃO entra na trilha — é ramo de exceção (callout separado).
 * A timeline é DERIVADA do estado atual (não há histórico persistido).
 *
 * Mobile-first (NFR-3): a trilha é `flex-wrap` — em 360px os nós quebram
 * em linhas, sem nunca gerar scroll horizontal.
 */
import { CheckCircle2, AlertTriangle } from "lucide-react";

/** Ordem canônica dos nós da trilha. */
const FLUXO: { chave: string; rotulo: string }[] = [
  { chave: "coletando_convites", rotulo: "Coletando aceites" },
  { chave: "coletando_pagamentos", rotulo: "Coletando PIX" },
  { chave: "formada", rotulo: "Formada" },
  { chave: "apurada", rotulo: "Apurada" },
];

/** Os estados pós-apuração caem no índice do nó "Apurada" (3). */
function indiceDoEstado(estado: string): number {
  if (estado === "repasse_parcial" || estado === "repassada") return 3;
  return FLUXO.findIndex((n) => n.chave === estado);
}

export default function TimelineEstado({ estado }: { estado: string }) {
  // Caixinha cancelada: ramo de exceção, fora da trilha linear.
  if (estado === "cancelada") {
    return (
      <div className="flex gap-3 rounded-xl border border-amber/30 bg-amber/[0.08] p-4 text-[13px] leading-relaxed">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber" />
        <div>
          Caixinha cancelada — o mínimo de pagantes não foi atingido no prazo. O
          criador foi notificado e os PIX serão devolvidos.
        </div>
      </div>
    );
  }

  const atual = indiceDoEstado(estado);

  return (
    <div className="flex flex-wrap gap-1.5">
      {FLUXO.map((no, i) => {
        const ligado = i <= atual;
        // o nó "Apurada" mostra o progresso do repasse como sub-rótulo
        const subRepasse =
          i === 3 && estado === "repasse_parcial"
            ? "repasse em andamento"
            : i === 3 && estado === "repassada"
              ? "repasse concluído"
              : null;
        // já cumprido: índice anterior, ou "Apurada" quando o repasse evoluiu
        const cumprido = i < atual || (i === atual && estado === "repassada");
        return (
          <div
            key={no.chave}
            className={
              "flex min-w-[130px] flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] " +
              (ligado
                ? "border-green bg-green/[0.06] text-text"
                : "border-line bg-card text-muted")
            }
          >
            <span
              className={
                "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[11px] font-bold " +
                (ligado ? "bg-green text-[#04210f]" : "bg-line text-text")
              }
            >
              {cumprido ? <CheckCircle2 size={15} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block">{no.rotulo}</span>
              {subRepasse && (
                <span className="block text-[11px] text-muted">{subRepasse}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
