"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, AlertTriangle, Trophy } from "lucide-react";
import { ApiError } from "@/lib/api";
import { apurarCaixinha, buscarCaixinha } from "@/lib/caixinha";
import { useToast } from "@/components/Toasts";
import { Botao, Card, Callout, VoltarLink, cx } from "@/components/ui";
import type { CaixinhaResponse, CandidatoGanhador, ResultadoResponse } from "@/types/caixinha";

/**
 * Tela de apuração (Story 4.2 / FR-12 — redesenhada na Story 7.6 do Épico 7).
 *
 * A LÓGICA é preservada: passo 1 escolhe o Resultado Final; se o backend
 * responder 422 com `candidatos`, passo 2 escolhe Nº de Ganhadores entre
 * eles. A tela declara a responsabilidade do Organizador e a
 * irreversibilidade do repasse antes de confirmar (AC-4).
 *
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
  const { notificar } = useToast();

  const [carregando, setCarregando] = useState(true);
  const [caixinha, setCaixinha] = useState<CaixinhaResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);

  const [resultadoFinalId, setResultadoFinalId] = useState<number | null>(null);
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
      if (proximo.has(participanteId)) proximo.delete(participanteId);
      else proximo.add(participanteId);
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
        ganhadoresEscolhidos: candidatos != null ? Array.from(escolhidos) : undefined,
      });
      notificar(
        r.modoReembolso
          ? "Apurada — ninguém cravou. Reembolso a caminho."
          : "Caixinha apurada! Prêmio a caminho dos vencedores.",
        "win",
      );
      router.push(`/caixinhas/${caixinhaId}/acerto`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const lista = e.problem["candidatos"] as CandidatoGanhador[] | undefined;
        if (lista && lista.length > 0) {
          setCandidatos(lista);
          setEscolhidos(new Set());
        }
        setErro(e.problem.detail ?? e.problem.title);
      } else {
        setErro(
          e instanceof ApiError
            ? (e.problem.detail ?? e.problem.title)
            : "Não conseguimos apurar a caixinha. Tente de novo.",
        );
      }
    } finally {
      setAgindo(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  if (!caixinha) {
    return (
      <main className="cx-fade flex flex-col gap-4">
        <Callout tom="warn">
          <span role="alert">{erro ?? "Caixinha não encontrada."}</span>
        </Callout>
        <VoltarLink href="/">Voltar</VoltarLink>
      </main>
    );
  }

  const naoFormada = caixinha.estado !== "formada";
  const numeroGanhadores = caixinha.numeroGanhadores;
  const selecaoCompleta = escolhidos.size === numeroGanhadores;

  return (
    <main className="cx-fade mx-auto flex max-w-[560px] flex-col gap-4">
      <VoltarLink href={`/caixinhas/${caixinhaId}`}>Voltar para a caixinha</VoltarLink>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted">
          Apuração — {caixinha.titulo}
        </p>
        <h1 className="font-display text-[26px] tracking-wide">Apurar o resultado</h1>
      </div>

      {erro && (
        <Callout tom="warn" icone={<AlertTriangle size={18} />}>
          <span role="alert">{erro}</span>
        </Callout>
      )}

      {naoFormada ? (
        <Callout tom="warn" icone={<AlertTriangle size={18} />}>
          Esta caixinha está em <b>{caixinha.estado}</b> — só é possível apurar uma
          caixinha <b>formada</b>.
        </Callout>
      ) : (
        <>
          {/* passo 1 — resultado final */}
          <Card className="p-6">
            <h2 className="mb-3 text-sm font-bold">1. Qual foi o resultado?</h2>
            <fieldset disabled={candidatos != null} className="flex flex-col gap-2">
              {caixinha.resultadosPossiveis.map((r: ResultadoResponse) => (
                <label
                  key={r.id}
                  className={cx(
                    "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm",
                    resultadoFinalId === r.id
                      ? "border-green bg-green/[0.07]"
                      : "border-line2 bg-bg2",
                  )}
                >
                  <input
                    type="radio"
                    name="resultadoFinal"
                    value={r.id}
                    checked={resultadoFinalId === r.id}
                    onChange={() => setResultadoFinalId(r.id)}
                    className="h-4 w-4 accent-[var(--color-green)]"
                  />
                  {r.rotulo}
                </label>
              ))}
            </fieldset>
          </Card>

          {/* passo 2 — seleção de ganhadores (só quando o back pede) */}
          {candidatos != null && (
            <Card className="p-6">
              <h2 className="mb-1 text-sm font-bold">
                2. Escolha {numeroGanhadores} ganhador(es)
              </h2>
              <p className="mb-3 text-xs text-muted">
                Há {candidatos.length} palpiteiros corretos para {numeroGanhadores}{" "}
                vaga(s). Selecione exatamente {numeroGanhadores} —{" "}
                {escolhidos.size} de {numeroGanhadores} marcado(s).
              </p>
              <div className="flex flex-col gap-2">
                {candidatos.map((c) => (
                  <label
                    key={c.participanteId}
                    className={cx(
                      "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm",
                      escolhidos.has(c.participanteId)
                        ? "border-green bg-green/[0.07]"
                        : "border-line2 bg-bg2",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={escolhidos.has(c.participanteId)}
                      onChange={() => alternarEscolhido(c.participanteId)}
                      className="h-4 w-4 accent-[var(--color-green)]"
                    />
                    <span className="truncate">{c.email}</span>
                  </label>
                ))}
              </div>
            </Card>
          )}

          {/* confirmação reforçada (AC-4) */}
          <Callout tom="warn" icone={<AlertTriangle size={18} />}>
            <b>Antes de confirmar, atenção:</b>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>A apuração e a escolha dos ganhadores são responsabilidade sua.</li>
              <li>Depois de apurada, o resultado final é imutável.</li>
              <li>Cada repasse é irreversível assim que o ganhador aceitar o prêmio.</li>
            </ul>
          </Callout>

          <Botao
            variante="primary"
            grande
            bloco
            onClick={apurar}
            disabled={
              agindo || resultadoFinalId == null || (candidatos != null && !selecaoCompleta)
            }
          >
            {candidatos != null ? <Crown size={17} /> : <Trophy size={17} />}
            {agindo ? "Apurando…" : "Confirmar apuração"}
          </Botao>
        </>
      )}
    </main>
  );
}
