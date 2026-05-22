"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { me } from "@/lib/auth";
import { aceitarPremio, buscarAcertoContas } from "@/lib/caixinha";
import type { AcertoContasResponse, ItemGanhador } from "@/types/caixinha";

/**
 * Tela de Acerto de Contas — o desfecho da Caixinha (Story 4.4, FR-14).
 *
 * Modo prêmio: lista cada Ganhador, valor e estado do Repasse.
 * Modo reembolso: lista cada Participante e o ingresso a estornar (Taxa
 * devolvida).
 * Modo indisponível: a Caixinha ainda não foi apurada.
 *
 * Compartilhável (share nativo / copiar resumo). Mobile-first 360×640.
 */
export default function AcertoContasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const caixinhaId = parseInt(id, 10);

  const [carregando, setCarregando] = useState(true);
  const [acerto, setAcerto] = useState<AcertoContasResponse | null>(null);
  const [meuEmail, setMeuEmail] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aceitando, setAceitando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [a, sessao] = await Promise.all([
        buscarAcertoContas(caixinhaId),
        me().catch(() => null),
      ]);
      setAcerto(a);
      setMeuEmail(sessao?.email ?? null);
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Erro ao carregar o Acerto de Contas.",
      );
    } finally {
      setCarregando(false);
    }
  }, [caixinhaId]);

  async function handleAceitar() {
    if (
      !window.confirm(
        "Aceitar o prêmio? O PIX é disparado para sua chave cadastrada e," +
          " depois de confirmado pelo banco, é irreversível.",
      )
    ) {
      return;
    }
    setAceitando(true);
    setErro(null);
    try {
      await aceitarPremio(caixinhaId);
      await carregar();
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Não foi possível aceitar o prêmio. Tente de novo.",
      );
    } finally {
      setAceitando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  function resumoTexto(a: AcertoContasResponse): string {
    if (a.modo === "premio") {
      const linhas = a.ganhadores.map(
        (g) => `• ${g.email}: R$ ${g.valor} (${rotuloRepasse(g.estadoRepasse)})`,
      );
      return `🏆 Acerto de Contas\n${linhas.join("\n")}\nTaxa: R$ ${a.taxaServico}`;
    }
    if (a.modo === "reembolso") {
      const linhas = a.reembolsos.map(
        (r) => `• ${r.email}: R$ ${r.valorEstorno} de volta`,
      );
      return `Ninguém cravou — reembolso total:\n${linhas.join("\n")}`;
    }
    return "A Caixinha ainda não foi apurada.";
  }

  async function compartilhar() {
    if (!acerto) return;
    const texto = resumoTexto(acerto);
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        // usuário cancelou o share — cai no copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard pode falhar; sem ação.
    }
  }

  if (carregando) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!acerto) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p role="alert" className="text-sm text-red-700">
          {erro ?? "Acerto de Contas indisponível."}
        </p>
        <Link href={`/caixinhas/${caixinhaId}`} className="text-sm text-zinc-500 underline">
          Voltar
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Acerto de Contas
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {acerto.modo === "premio" && "🏆 Resultado"}
          {acerto.modo === "reembolso" && "Reembolso"}
          {acerto.modo === "indisponivel" && "Ainda não apurada"}
          {acerto.modo === "cancelada_sem_reembolso" && "Caixinha cancelada"}
        </h1>
      </header>

      {acerto.modo === "indisponivel" && (
        <p className="rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Esta Caixinha está em <strong>{acerto.estadoCaixinha}</strong> — o
          Acerto de Contas aparece quando ela for apurada.
        </p>
      )}

      {acerto.modo === "cancelada_sem_reembolso" && (
        <p className="rounded-md border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Esta caixinha foi cancelada. Como ninguém chegou a pagar o
          ingresso, não há nada a reembolsar.
        </p>
      )}

      {acerto.modo === "premio" && (
        <>
          <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            💰 {acerto.ganhadores.length} Ganhador(es)! Cada um pode entrar no
            app para receber o prêmio.
          </p>

          {/* Card de aceite — Story 4.6: visível se o usuário logado é um
              Ganhador aguardando aceite (ou após falha de PIX). */}
          {(() => {
            const eu = acerto.ganhadores.find((g) => g.email === meuEmail);
            if (
              !eu ||
              (eu.estadoRepasse !== "aguardando_aceite" &&
                eu.estadoRepasse !== "falha_pix")
            ) {
              return null;
            }
            return (
              <section className="flex flex-col gap-3 rounded-md border border-emerald-400 bg-emerald-50 p-4 dark:border-emerald-600 dark:bg-emerald-950">
                <h2 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                  Você ganhou R$ {eu.valor}!
                </h2>
                {eu.estadoRepasse === "falha_pix" && (
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Não conseguimos enviar o PIX — confira sua chave PIX no
                    perfil e tente aceitar de novo.
                  </p>
                )}
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  O prêmio vai para a chave PIX cadastrada no seu perfil. Ao
                  aceitar, o PIX é disparado imediatamente e, após confirmado
                  pelo banco, é irreversível.
                </p>
                <button
                  type="button"
                  onClick={handleAceitar}
                  disabled={aceitando}
                  className="min-h-[48px] rounded-md bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-emerald-500"
                >
                  {aceitando ? "Processando..." : "Aceitar e receber o prêmio"}
                </button>
                <Link
                  href={`/caixinhas/${caixinhaId}/pagamento`}
                  className="text-center text-xs text-emerald-700 underline dark:text-emerald-400"
                >
                  Conferir / atualizar minha chave PIX
                </Link>
              </section>
            );
          })()}
          <ul className="flex flex-col gap-2">
            {acerto.ganhadores.map((g: ItemGanhador) => (
              <li
                key={g.email}
                className="flex flex-col gap-1 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate text-sm">{g.email}</span>
                  <strong className="text-sm">R$ {g.valor}</strong>
                </div>
                <RepasseBadge estado={g.estadoRepasse} />
                {g.comprovante && (
                  <span className="text-xs text-zinc-500">
                    Comprovante: {g.comprovante}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            Taxa de Serviço retida: R$ {acerto.taxaServico} · Total custodiado:
            R$ {acerto.totalCustodiado}
          </p>
        </>
      )}

      {acerto.modo === "reembolso" && (
        <>
          <p className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
            O dinheiro de todo mundo volta automaticamente, taxa inclusa.
          </p>
          <ul className="flex flex-col gap-2">
            {acerto.reembolsos.map((r) => (
              <li
                key={r.email}
                className="flex flex-col gap-1 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate text-sm">{r.email}</span>
                  <strong className="text-sm">R$ {r.valorEstorno}</strong>
                </div>
                {/* Story 5.2: estado real do estorno — o app nunca diz
                    "reembolsado" antes de o Provedor confirmar. */}
                <EstornoBadge estado={r.estadoEstorno} />
              </li>
            ))}
          </ul>
        </>
      )}

      {(acerto.modo === "premio" || acerto.modo === "reembolso") && (
        <button
          type="button"
          onClick={compartilhar}
          className="min-h-[48px] rounded-md border border-zinc-400 px-4 text-sm font-medium dark:border-zinc-600"
        >
          {copiado ? "Resumo copiado!" : "Compartilhar resultado"}
        </button>
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

function rotuloRepasse(estado: string): string {
  const mapa: Record<string, string> = {
    aguardando_aceite: "aguardando aceite",
    pix_em_andamento: "PIX em andamento",
    pago: "pago",
    falha_pix: "falha de PIX",
  };
  return mapa[estado] ?? estado;
}

/** Badge do estado do Repasse de um Ganhador (Story 4.4, AC-3). */
function RepasseBadge({ estado }: { estado: string }) {
  const mapa: Record<string, string> = {
    aguardando_aceite:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    pix_em_andamento:
      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    pago: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    falha_pix: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  const classe = mapa[estado] ?? "bg-zinc-100 text-zinc-600";
  return (
    <span
      className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${classe}`}
    >
      {rotuloRepasse(estado)}
    </span>
  );
}

/**
 * Badge do estado do estorno de um Participante (Story 5.2).
 *
 * O app nunca afirma "reembolsado" antes de o Provedor confirmar — o
 * estado vem do `EstadoCobranca` real.
 */
function EstornoBadge({ estado }: { estado: string | null }) {
  if (estado === "concluido") {
    return (
      <span className="w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        reembolsado ✓
      </span>
    );
  }
  // null ou em_processamento — estorno ainda não confirmado pelo banco.
  return (
    <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      estorno em processamento
    </span>
  );
}
