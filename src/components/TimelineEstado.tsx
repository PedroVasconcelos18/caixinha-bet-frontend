/**
 * Timeline de Estado da Caixinha (Story 6.2, FR-17).
 *
 * Renderiza o ciclo de vida da Caixinha como uma trilha vertical (vertical
 * evita scroll horizontal no mobile — NFR-3). Os 5 nós do fluxo normal:
 *
 *   coletando_convites → coletando_pagamentos → formada → apurada → repassada
 *
 * `repasse_parcial` é o mesmo nó conceitual de `repassada` ("Repasse"), com
 * sub-rótulo "em andamento". `cancelada` NÃO entra na trilha — aparece como
 * ramo de exceção separado.
 *
 * A timeline é DERIVADA do estado atual (não há histórico persistido): os
 * nós antes do atual são "feito", o atual é "atual", os seguintes são
 * "futuro".
 */

/** Ordem canônica dos nós do fluxo normal. */
const FLUXO: { chave: string; rotulo: string }[] = [
  { chave: "coletando_convites", rotulo: "Convidando" },
  { chave: "coletando_pagamentos", rotulo: "Coletando pagamentos" },
  { chave: "formada", rotulo: "Formada" },
  { chave: "apurada", rotulo: "Apurada" },
  { chave: "repassada", rotulo: "Repasse" },
];

/** `repasse_parcial` mapeia para o nó "repassada" da trilha. */
function indiceDoEstado(estado: string): number {
  const normalizado = estado === "repasse_parcial" ? "repassada" : estado;
  return FLUXO.findIndex((n) => n.chave === normalizado);
}

export default function TimelineEstado({ estado }: { estado: string }) {
  // Caixinha cancelada: ramo de exceção, fora da trilha linear.
  if (estado === "cancelada") {
    return (
      <section className="rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
        <h2 className="text-sm font-medium text-red-800 dark:text-red-300">
          Caixinha cancelada
        </h2>
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          Esta caixinha não fechou — seguiu o caminho de exceção. Quem havia
          pago o ingresso foi reembolsado automaticamente.
        </p>
      </section>
    );
  }

  const atual = indiceDoEstado(estado);

  return (
    <section className="flex flex-col gap-1">
      <h2 className="mb-1 text-sm font-medium">Onde está a caixinha</h2>
      <ol className="flex flex-col">
        {FLUXO.map((no, i) => {
          const fase: "feito" | "atual" | "futuro" =
            i < atual ? "feito" : i === atual ? "atual" : "futuro";
          const ultimo = i === FLUXO.length - 1;
          // Sub-rótulo: distingue repasse em andamento de concluído.
          const sub =
            no.chave === "repassada" && fase === "atual"
              ? estado === "repasse_parcial"
                ? "em andamento"
                : "concluído"
              : null;
          return (
            <li key={no.chave} className="flex gap-3">
              {/* Coluna do marcador + linha conectora. */}
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={
                    "mt-0.5 h-3 w-3 shrink-0 rounded-full " +
                    (fase === "feito"
                      ? "bg-emerald-500"
                      : fase === "atual"
                        ? "bg-blue-600 ring-2 ring-blue-300 dark:ring-blue-800"
                        : "bg-zinc-300 dark:bg-zinc-700")
                  }
                />
                {!ultimo && (
                  <span
                    aria-hidden
                    className={
                      "w-0.5 flex-1 " +
                      (i < atual
                        ? "bg-emerald-500"
                        : "bg-zinc-200 dark:bg-zinc-800")
                    }
                  />
                )}
              </div>
              {/* Rótulo do nó. */}
              <div className={ultimo ? "pb-0" : "pb-4"}>
                <p
                  className={
                    "text-sm " +
                    (fase === "futuro"
                      ? "text-zinc-400 dark:text-zinc-600"
                      : fase === "atual"
                        ? "font-medium"
                        : "text-zinc-600 dark:text-zinc-400")
                  }
                >
                  {no.rotulo}
                  {fase === "atual" && (
                    <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">
                      • agora
                    </span>
                  )}
                </p>
                {sub && (
                  <p className="text-xs text-zinc-500">{sub}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {estado === "coletando_pagamentos" && (
        <p className="mt-1 text-xs text-zinc-500">
          A caixinha forma assim que houver pagamentos confirmados
          suficientes.
        </p>
      )}
    </section>
  );
}
