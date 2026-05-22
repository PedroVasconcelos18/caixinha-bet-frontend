"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { apurarCaixinha, buscarCaixinha } from "@/lib/caixinha";
import type {
  CaixinhaResponse,
  CandidatoGanhador,
  ResultadoResponse,
} from "@/types/caixinha";

/**
 * Tela de apuração da Caixinha (Story 4.2, FR-12).
 *
 * Fluxo em até 2 passos:
 *  1. O Organizador escolhe o Resultado Final entre os Resultados Possíveis.
 *  2. Se o backend responder 422 com `candidatos` (mais palpiteiros corretos
 *     que o Nº de Ganhadores), o Organizador escolhe exatamente Nº de
 *     Ganhadores entre eles e reenvia.
 *
 * Confirmação reforçada (AC-4): a tela declara que a apuração e a seleção
 * de Ganhadores são responsabilidade do Organizador e que o Repasse é
 * irreversível após o aceite de cada Ganhador.
 *
 * Acesso: só o Organizador. Não-Organizador recebe 403/404 do backend.
 * Mobile-first 360×640 (NFR-3).
 */
export default function ApuracaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const caixinhaId = parseInt(id, 10);
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [caixinha, setCaixinha] = useState<CaixinhaResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);

  const [resultadoFinalId, setResultadoFinalId] = useState<number | null>(null);
  // Preenchido quando o backend pede seleção (mais corretos que vagas).
  const [candidatos, setCandidatos] = useState<CandidatoGanhador[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<number>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setCaixinha(await buscarCaixinha(caixinhaId));
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Erro ao carregar a tela de apuração.",
      );
    } finally {
      setCarregando(false);
    }
  }, [caixinhaId]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  function alternarEscolhido(participanteId: number) {
    setEscolhidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(participanteId)) {
        proximo.delete(participanteId);
      } else {
        proximo.add(participanteId);
      }
      return proximo;
    });
  }

  async function apurar() {
    if (resultadoFinalId == null) return;
    setAgindo(true);
    setErro(null);
    try {
      const r = await apurarCaixinha(caixinhaId, {
        resultadoFinalId,
        ganhadoresEscolhidos:
          candidatos != null ? Array.from(escolhidos) : undefined,
      });
      // Sucesso — vai para o Acerto de Contas (Story 4.4).
      router.push(`/caixinhas/${caixinhaId}?apurada=${r.modoReembolso ? "reembolso" : "premio"}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        // Caso "mais corretos que vagas": o problem+json traz `candidatos`.
        const lista = e.problem["candidatos"] as CandidatoGanhador[] | undefined;
        if (lista && lista.length > 0) {
          setCandidatos(lista);
          setEscolhidos(new Set());
          setErro(e.problem.detail ?? e.problem.title);
        } else {
          setErro(e.problem.detail ?? e.problem.title);
        }
      } else {
        setErro(
          e instanceof ApiError
            ? (e.problem.detail ?? e.problem.title)
            : "Não conseguimos apurar a Caixinha. Tente de novo.",
        );
      }
    } finally {
      setAgindo(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!caixinha) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p role="alert" className="text-sm text-red-700">
          {erro ?? "Caixinha não encontrada."}
        </p>
        <Link href="/" className="text-sm text-zinc-500 underline">
          Voltar
        </Link>
      </main>
    );
  }

  const naoFormada = caixinha.estado !== "formada";
  const numeroGanhadores = caixinha.numeroGanhadores;
  const selecaoCompleta = escolhidos.size === numeroGanhadores;

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Apuração — {caixinha.titulo}
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          Apurar o Resultado Final
        </h1>
      </header>

      {erro && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {erro}
        </p>
      )}

      {naoFormada && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
          Esta Caixinha está em <strong>{caixinha.estado}</strong> — só é
          possível apurar uma Caixinha <strong>formada</strong>.
        </p>
      )}

      {!naoFormada && (
        <>
          {/* Passo 1 — Resultado Final. */}
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">
              1. Qual foi o resultado?
            </h2>
            <fieldset
              disabled={candidatos != null}
              className="flex flex-col gap-2"
            >
              {caixinha.resultadosPossiveis.map((r: ResultadoResponse) => (
                <label
                  key={r.id}
                  className="flex min-h-[44px] items-center gap-3 rounded-md border border-zinc-300 px-3 dark:border-zinc-700"
                >
                  <input
                    type="radio"
                    name="resultadoFinal"
                    value={r.id}
                    checked={resultadoFinalId === r.id}
                    onChange={() => setResultadoFinalId(r.id)}
                  />
                  <span className="text-sm">{r.rotulo}</span>
                </label>
              ))}
            </fieldset>
          </section>

          {/* Passo 2 — seleção de Ganhadores (só quando o back pede). */}
          {candidatos != null && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">
                2. Escolha {numeroGanhadores} Ganhador(es)
              </h2>
              <p className="text-xs text-zinc-500">
                Há {candidatos.length} palpiteiros corretos para{" "}
                {numeroGanhadores} vaga(s). Selecione exatamente{" "}
                {numeroGanhadores}.
              </p>
              <div className="flex flex-col gap-2">
                {candidatos.map((c) => (
                  <label
                    key={c.participanteId}
                    className="flex min-h-[44px] items-center gap-3 rounded-md border border-zinc-300 px-3 dark:border-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={escolhidos.has(c.participanteId)}
                      onChange={() => alternarEscolhido(c.participanteId)}
                    />
                    <span className="truncate text-sm">{c.email}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-zinc-500">
                {escolhidos.size} de {numeroGanhadores} selecionado(s).
              </p>
            </section>
          )}

          {/* Confirmação reforçada (AC-4). */}
          <section className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
            <p className="font-medium">Antes de confirmar, atenção:</p>
            <ul className="mt-1 list-disc pl-4">
              <li>
                A apuração e a escolha dos Ganhadores são responsabilidade
                sua, como Organizador.
              </li>
              <li>
                Depois de apurada, o Resultado Final é <strong>imutável</strong>.
              </li>
              <li>
                Cada Repasse é <strong>irreversível</strong> assim que o
                Ganhador aceitar receber o prêmio.
              </li>
            </ul>
          </section>

          <button
            type="button"
            onClick={apurar}
            disabled={
              agindo ||
              resultadoFinalId == null ||
              (candidatos != null && !selecaoCompleta)
            }
            className="min-h-[48px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {agindo ? "Apurando..." : "Confirmar apuração"}
          </button>
        </>
      )}

      <Link
        href={`/caixinhas/${caixinhaId}`}
        className="mt-2 text-center text-sm text-zinc-500 underline"
      >
        Voltar para a Caixinha
      </Link>
    </main>
  );
}
