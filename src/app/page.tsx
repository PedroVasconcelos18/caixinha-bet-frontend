"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { listarCaixinhas } from "@/lib/caixinha";
import type { CaixinhaResumoResponse } from "@/types/caixinha";

/**
 * Dashboard — as Caixinhas do Usuário (Story 6.1, FR-17).
 *
 * Lista cada Caixinha das quais o Usuário participa, com Estado,
 * progresso (pagos / mínimo) e Prêmio potencial.
 *
 * <p>Anti-glamour (PRD §10/§14): NÃO há hero-stat de "R$ em jogo" — só a
 * contagem de Caixinhas ativas. Não parece casa de aposta.
 *
 * Mobile-first 360×640, sem scroll horizontal (NFR-3).
 */
export default function Dashboard() {
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">(
    "carregando",
  );
  const [caixinhas, setCaixinhas] = useState<CaixinhaResumoResponse[]>([]);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setEstado("carregando");
    try {
      setCaixinhas(await listarCaixinhas());
      setEstado("ok");
    } catch (e) {
      setMensagem(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Não conseguimos carregar suas caixinhas.",
      );
      setEstado("erro");
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  if (estado === "carregando") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p>Carregando...</p>
      </main>
    );
  }

  if (estado === "erro") {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p role="alert" className="text-sm text-red-700">
          {mensagem}
        </p>
      </main>
    );
  }

  const ativas = caixinhas.filter((c) => c.ativa).length;

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Suas caixinhas
        </h1>
        {caixinhas.length > 0 && (
          <p className="text-sm text-zinc-500">
            {ativas} {ativas === 1 ? "caixinha ativa" : "caixinhas ativas"}
          </p>
        )}
      </header>

      {caixinhas.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-md border border-zinc-200 p-6 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Você ainda não participa de nenhuma caixinha. Que tal criar a
            primeira e chamar a galera?
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {caixinhas.map((c) => (
            <li key={c.id}>
              <Link
                href={`/caixinhas/${c.id}`}
                className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.titulo}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {c.confronto}
                    </p>
                  </div>
                  <EstadoBadge estado={c.estado} />
                </div>
                <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                  <span>
                    {c.pagosConfirmados}/{c.minimoParticipantes} pagaram
                  </span>
                  <span>Prêmio potencial: R$ {c.premioPotencial}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/caixinhas/nova"
        className="flex min-h-[48px] items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Criar nova caixinha
      </Link>
    </main>
  );
}

/** Badge do Estado da Caixinha — rótulo amigável (Story 6.1). */
function EstadoBadge({ estado }: { estado: string }) {
  const mapa: Record<string, { texto: string; classe: string }> = {
    coletando_convites: {
      texto: "convidando",
      classe: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    },
    coletando_pagamentos: {
      texto: "coletando",
      classe:
        "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    },
    formada: {
      texto: "formada",
      classe: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    apurada: {
      texto: "apurada",
      classe:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    },
    repasse_parcial: {
      texto: "repassando",
      classe:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    },
    repassada: {
      texto: "repassada ✓",
      classe:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    cancelada: {
      texto: "cancelada",
      classe: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    },
  };
  const info = mapa[estado] ?? {
    texto: estado,
    classe: "bg-zinc-100 text-zinc-600",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${info.classe}`}
    >
      {info.texto}
    </span>
  );
}
