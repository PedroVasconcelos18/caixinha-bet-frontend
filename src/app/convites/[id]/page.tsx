"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import {
  aceitarConvite,
  buscarConvite,
  definirPalpite,
} from "@/lib/caixinha";
import type { ConviteResponse } from "@/types/caixinha";

/**
 * Tela do convite (Story 2.5, FR-5).
 *
 * Fluxo:
 *  - Autenticação (cookie da Story 2.1) é obrigatória (middleware do
 *    `proxy.ts` redireciona se não tiver cookie).
 *  - GET /caixinhas/{id}/convite — 200 mostra detalhe restrito do
 *    convidado; 404 → não convidado / não existe (anti-enumeração).
 *  - Se status=convidado: botão "Aceitar convite" (POST /aceitar).
 *  - Status>=aceito E prazo no futuro: seletor de Palpite (radios).
 *  - Prazo encerrado: radios desabilitados, mensagem amigável.
 */
export default function ConvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">(
    "carregando",
  );
  const [convite, setConvite] = useState<ConviteResponse | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const c = await buscarConvite(parseInt(id, 10));
      setConvite(c);
      setEstado("ok");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setMensagem("Convite não encontrado ou você não foi convidado.");
      } else if (e instanceof ApiError && e.status === 401) {
        setMensagem("Sua sessão expirou. Faça login de novo.");
      } else if (e instanceof ApiError) {
        setMensagem(e.problem.detail ?? e.problem.title);
      } else {
        setMensagem("Erro ao carregar o convite.");
      }
      setEstado("erro");
    }
  }, [id]);

  useEffect(() => {
    let cancelado = false;
    async function executar() {
      if (!cancelado) {
        await carregar();
      }
    }
    void executar();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  async function aceitar() {
    if (!convite) return;
    setAgindo(true);
    setFeedback(null);
    setErroAcao(null);
    try {
      await aceitarConvite(convite.caixinhaId);
      await carregar();
      setFeedback("Convite aceito! Agora você pode escolher seu palpite.");
    } catch (e) {
      setErroAcao(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : "Algo deu errado. Tente de novo.",
      );
    } finally {
      setAgindo(false);
    }
  }

  async function palpitar(resultadoPossivelId: number) {
    if (!convite) return;
    setAgindo(true);
    setFeedback(null);
    setErroAcao(null);
    try {
      await definirPalpite(convite.caixinhaId, resultadoPossivelId);
      await carregar();
      setFeedback("Palpite salvo!");
    } catch (e) {
      setErroAcao(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : "Algo deu errado. Tente de novo.",
      );
    } finally {
      setAgindo(false);
    }
  }

  if (estado === "carregando") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p>Carregando...</p>
      </main>
    );
  }

  if (estado === "erro" || !convite) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Não foi possível abrir</h1>
        <p className="max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
          {mensagem ?? "Erro desconhecido."}
        </p>
        <Link
          href="/"
          className="min-h-[44px] flex items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Voltar ao início
        </Link>
      </main>
    );
  }

  const prazoFuturo = new Date(convite.prazoEntrada) > new Date();
  const podeAceitar = convite.eu.status === "convidado";
  const podePalpitar = convite.eu.status !== "convidado" && prazoFuturo;
  const palpiteAtual = convite.eu.palpiteResultadoPossivelId;

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Convite
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {convite.titulo}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {convite.ladoA} × {convite.ladoB}
        </p>
      </header>

      <section className="flex flex-col gap-2 text-sm">
        <Linha k="Valor do ingresso" v={`R$ ${convite.valorIngresso}`} />
        <Linha k="Taxa de Serviço" v={`R$ ${convite.taxaServico}`} />
        <Linha k="Estado" v={convite.estado} />
        <Linha k="Prazo de entrada" v={convite.prazoEntrada} />
        <Linha k="Seu status" v={convite.eu.status} />
      </section>

      {feedback && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {feedback}
        </p>
      )}
      {erroAcao && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {erroAcao}
        </p>
      )}

      {podeAceitar && (
        <button
          type="button"
          onClick={aceitar}
          disabled={agindo}
          className="min-h-[48px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {agindo ? "Aceitando..." : "Aceitar convite"}
        </button>
      )}

      <section>
        <h2 className="text-sm font-medium">Resultados Possíveis</h2>
        {!prazoFuturo && (
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Palpite congelado — o prazo de entrada terminou.
          </p>
        )}
        <fieldset disabled={!podePalpitar || agindo} className="mt-2">
          <ul className="flex flex-col gap-2">
            {convite.resultadosPossiveis.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-[44px] items-center gap-3 rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
                  <input
                    type="radio"
                    name="palpite"
                    value={r.id}
                    checked={palpiteAtual === r.id}
                    onChange={() => palpitar(r.id)}
                    className="h-5 w-5"
                  />
                  <span className="text-sm">{r.rotulo}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        {!podePalpitar && podeAceitar && (
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Aceite o convite primeiro para escolher seu palpite.
          </p>
        )}
      </section>
    </main>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
