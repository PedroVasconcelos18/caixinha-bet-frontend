"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { me } from "@/lib/auth";
import { buscarCaixinha, convidar, encerrarPrazo } from "@/lib/caixinha";
import TimelineEstado from "@/components/TimelineEstado";
import type { CaixinhaResponse } from "@/types/caixinha";

/**
 * Detalhe da Caixinha (Story 2.2 + Story 2.4).
 *
 * Client component porque (a) precisa do cookie de sessão na request
 * (`credentials: "include"`), (b) o tom NFR-6 é interativo, (c) a Story
 * 2.4 adiciona seção interativa "Convidar mais" para o dono.
 *
 * Em erro (404 — não participante; 401 — sessão expirada), mostra tela
 * amigável.
 */
export default function CaixinhaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">(
    "carregando",
  );
  const [caixinha, setCaixinha] = useState<CaixinhaResponse | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [meuEmail, setMeuEmail] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [c, sessao] = await Promise.all([
        buscarCaixinha(parseInt(id, 10)),
        me().catch(() => null), // me() pode falhar se sessão expirou; tratamos depois
      ]);
      setCaixinha(c);
      setMeuEmail(sessao?.email ?? null);
      setEstado("ok");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setMensagem("Caixinha não encontrada ou você não participa dela.");
      } else if (e instanceof ApiError && e.status === 401) {
        setMensagem("Sua sessão expirou. Faça login de novo.");
      } else if (e instanceof ApiError) {
        setMensagem(e.problem.detail ?? e.problem.title);
      } else {
        setMensagem("Erro ao carregar a Caixinha.");
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

  // Story 4.5: encerrar prazo manualmente. Ação relevante — confirma antes.
  async function handleEncerrarPrazo() {
    if (
      !window.confirm(
        "Encerrar o prazo agora? A Caixinha vai formar (se tiver pagamentos" +
          " suficientes) ou ser cancelada. Não dá para desfazer.",
      )
    ) {
      return;
    }
    try {
      await encerrarPrazo(parseInt(id, 10));
      await carregar();
    } catch (e) {
      setMensagem(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Não foi possível encerrar o prazo.",
      );
    }
  }

  if (estado === "carregando") {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p>Carregando...</p>
      </main>
    );
  }

  if (estado === "erro" || !caixinha) {
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

  const dono = caixinha.participantes.find((p) => p.dono);
  const souDono = !!dono && !!meuEmail && dono.email === meuEmail;
  const aceitaNovosConvites =
    caixinha.estado === "coletando_convites" ||
    caixinha.estado === "coletando_pagamentos";

  // Story 3.2 (FR-7): botão "Pagar ingresso" visível quando a Caixinha
  // está em coletando_pagamentos E o Participante logado está `aceito`
  // com palpite escolhido. O back revalida tudo de novo (defesa real).
  const meuParticipante = caixinha.participantes.find(
    (p) => p.email === meuEmail,
  );
  const podePagar =
    caixinha.estado === "coletando_pagamentos" &&
    meuParticipante?.status === "aceito" &&
    meuParticipante?.palpiteResultadoPossivelId != null;
  const jaPagando = meuParticipante?.status === "pagamento_iniciado";

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Caixinha
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {caixinha.titulo}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {caixinha.ladoA} × {caixinha.ladoB}
        </p>
      </header>

      {/* Story 6.2 (FR-17): timeline de Estado da Caixinha. */}
      <TimelineEstado estado={caixinha.estado} />

      <section className="flex flex-col gap-2 text-sm">
        <Linha k="Valor do ingresso" v={`R$ ${caixinha.valorIngresso}`} />
        <Linha
          k="Mínimo de Participantes"
          v={String(caixinha.minimoParticipantes)}
        />
        <Linha
          k="Nº de Ganhadores"
          v={String(caixinha.numeroGanhadores)}
        />
        <Linha k="Taxa de Serviço" v={`R$ ${caixinha.taxaServico}`} />
        <Linha k="Prêmio máximo teórico" v={`R$ ${caixinha.premioMaximoTeorico}`} />
        <Linha
          k="Total custodiado (confirmado)"
          v={`R$ ${caixinha.totalCustodiado}`}
        />
        <Linha k="Prêmio potencial" v={`R$ ${caixinha.premioPotencial}`} />
        <Linha k="Prazo de entrada" v={caixinha.prazoEntrada} />
        <Linha k="Data de apuração" v={caixinha.dataApuracao} />
      </section>

      <section>
        <h2 className="text-sm font-medium">Resultados Possíveis</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {caixinha.resultadosPossiveis.map((r) => (
            <li key={r.ordem}>{r.rotulo}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium">Participantes</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Transparência total: todo mundo vê quem aceitou, quem está pagando
          e quem já pagou. Sem depender da palavra de ninguém.
        </p>
        <ul className="mt-2 flex flex-col gap-2 text-sm">
          {caixinha.participantes.map((p) => (
            <li
              key={p.email}
              className="flex flex-col gap-0.5 rounded-md border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <div className="flex justify-between gap-2">
                <span className="truncate">
                  {p.email} {p.dono && <em className="text-xs">(dono)</em>}
                </span>
                <StatusBadge status={p.status} />
              </div>
              {p.palpiteRotulo && (
                <span className="text-xs text-zinc-500">
                  Palpite: {p.palpiteRotulo}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(podePagar || jaPagando) && (
        <Link
          href={`/caixinhas/${caixinha.id}/pagamento`}
          className="flex min-h-[48px] items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {jaPagando ? "Ver pagamento PIX" : "Pagar ingresso via PIX"}
        </Link>
      )}

      {/* Story 4.2 (FR-12): só o Organizador apura, e só Caixinha formada. */}
      {souDono && caixinha.estado === "formada" && (
        <Link
          href={`/caixinhas/${caixinha.id}/apuracao`}
          className="flex min-h-[48px] items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white dark:bg-emerald-500"
        >
          Apurar o Resultado Final
        </Link>
      )}

      {/* Story 4.4 (FR-14): Acerto de Contas visível a partir de apurada. */}
      {(caixinha.estado === "apurada" ||
        caixinha.estado === "repasse_parcial" ||
        caixinha.estado === "repassada") && (
        <Link
          href={`/caixinhas/${caixinha.id}/acerto`}
          className="flex min-h-[48px] items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Ver Acerto de Contas
        </Link>
      )}

      {souDono && aceitaNovosConvites && (
        <ConvidarMais
          caixinhaId={caixinha.id}
          onConvidados={() => void carregar()}
        />
      )}

      {/* Story 4.5 (FR-15): encerrar prazo — só dono, antes da formação. */}
      {souDono && aceitaNovosConvites && (
        <button
          type="button"
          onClick={handleEncerrarPrazo}
          className="min-h-[44px] rounded-md border border-zinc-400 px-4 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
        >
          Encerrar prazo de entrada agora
        </button>
      )}
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

/**
 * Badge do Status do Participante (Story 3.5, FR-10 AC-2).
 *
 * Rótulo amigável (não o enum cru) e cor distinta — `pagamento_iniciado`
 * NÃO se confunde com `aceito`: quem tem cobrança em aberto ("pagando…")
 * é visualmente diferente de quem só aceitou.
 */
function StatusBadge({ status }: { status: string }) {
  const mapa: Record<string, { texto: string; classe: string }> = {
    convidado: {
      texto: "convidado",
      classe: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    },
    aceito: {
      texto: "aceitou",
      classe:
        "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    },
    pagamento_iniciado: {
      texto: "pagando…",
      classe:
        "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    },
    pago: {
      texto: "pagou ✓",
      classe:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
  };
  const info = mapa[status] ?? {
    texto: status,
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

/**
 * Bloco "Convidar mais Participantes" (Story 2.4). Só aparece se o
 * usuário logado é o dono E a Caixinha aceita novos convites (estado
 * coletando_convites/pagamentos).
 */
function ConvidarMais({
  caixinhaId,
  onConvidados,
}: {
  caixinhaId: number;
  onConvidados: () => void;
}) {
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setFeedback(null);
    setErro(null);
    const emails = valor
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (emails.length === 0) {
      setErro("Informe ao menos um e-mail.");
      setEnviando(false);
      return;
    }
    try {
      const r = await convidar(caixinhaId, emails);
      const partes: string[] = [];
      if (r.convidados.length > 0) {
        partes.push(`${r.convidados.length} convidado(s)`);
      }
      if (r.jaPresentes.length > 0) {
        partes.push(`${r.jaPresentes.length} já estava(m)`);
      }
      setFeedback(partes.join(" · ") || "Nada a convidar.");
      setValor("");
      onConvidados();
    } catch (e) {
      if (e instanceof ApiError) {
        setErro(e.problem.detail ?? e.problem.title);
      } else {
        setErro("Algo deu errado. Tente de novo.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
      <h2 className="text-sm font-medium">Convidar mais Participantes</h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Um por linha ou separados por vírgula.
      </p>
      <form onSubmit={submeter} className="mt-2 flex flex-col gap-2">
        <textarea
          rows={3}
          value={valor}
          onChange={(ev) => setValor(ev.target.value)}
          placeholder="amigo@exemplo.com"
          className="rounded-md border border-zinc-300 bg-white p-2 text-sm"
        />
        <button
          type="submit"
          disabled={enviando}
          className="min-h-[44px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {enviando ? "Convidando..." : "Convidar"}
        </button>
        {feedback && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {feedback}
          </p>
        )}
        {erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}
      </form>
    </section>
  );
}
