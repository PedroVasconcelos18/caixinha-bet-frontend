"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Trophy, Share2, Coins, AlertTriangle, Crown } from "lucide-react";
import { ApiError } from "@/lib/api";
import { me } from "@/lib/auth";
import { aceitarPremio, buscarAcertoContas } from "@/lib/caixinha";
import { formatBRL } from "@/lib/money";
import { useToast } from "@/components/Toasts";
import { Botao, Card, Callout, VoltarLink } from "@/components/ui";
import type { AcertoContasResponse, ItemGanhador } from "@/types/caixinha";

/**
 * Tela de Acerto de Contas (Story 4.4 / FR-14 — redesenhada na Story 7.6 do
 * Épico 7 para o design aprovado.
 *
 * A LÓGICA é preservada: modo prêmio (vencedores + estado do repasse),
 * modo reembolso (estornos), aceite do prêmio pelo vencedor logado (FR-13),
 * compartilhamento. Tom celebratório no prêmio, não-punitivo no reembolso
 * (NFR-6). Dinheiro via `@/lib/money` (NFR-1).
 */
export default function AcertoContasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const caixinhaId = parseInt(id, 10);
  const { notificar } = useToast();

  const [carregando, setCarregando] = useState(true);
  const [acerto, setAcerto] = useState<AcertoContasResponse | null>(null);
  const [meuEmail, setMeuEmail] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
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
          : "Erro ao carregar o acerto de contas.",
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

  async function handleAceitar() {
    if (
      !window.confirm(
        "Aceitar o prêmio? O PIX é disparado para sua chave cadastrada e, depois de " +
          "confirmado pelo banco, é irreversível.",
      )
    ) {
      return;
    }
    setAceitando(true);
    setErro(null);
    try {
      await aceitarPremio(caixinhaId);
      notificar("Prêmio aceito! O PIX está a caminho.", "win");
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

  function resumoTexto(a: AcertoContasResponse): string {
    if (a.modo === "premio") {
      const linhas = a.ganhadores.map(
        (g) => `• ${g.email}: ${formatBRL(g.valor)} (${rotuloRepasse(g.estadoRepasse)})`,
      );
      return `🏆 Acerto de Contas\n${linhas.join("\n")}\nTaxa: ${formatBRL(a.taxaServico)}`;
    }
    if (a.modo === "reembolso") {
      const linhas = a.reembolsos.map(
        (r) => `• ${r.email}: ${formatBRL(r.valorEstorno)} de volta`,
      );
      return `Ninguém cravou — reembolso total:\n${linhas.join("\n")}`;
    }
    return "A caixinha ainda não foi apurada.";
  }

  async function compartilhar() {
    if (!acerto) return;
    const texto = resumoTexto(acerto);
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
        return;
      } catch {
        // usuário cancelou o share — cai no copiar
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      notificar("Resumo copiado!", "mail");
    } catch {
      // clipboard pode falhar; sem ação
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  if (!acerto) {
    return (
      <main className="cx-fade flex flex-col gap-4">
        <Callout tom="warn">
          <span role="alert">{erro ?? "Acerto de contas indisponível."}</span>
        </Callout>
        <VoltarLink href={`/caixinhas/${caixinhaId}`}>Voltar</VoltarLink>
      </main>
    );
  }

  const ehPremio = acerto.modo === "premio";
  const ehReembolso = acerto.modo === "reembolso";
  const meuPremio = ehPremio ? acerto.ganhadores.find((g) => g.email === meuEmail) : undefined;
  const podeAceitar =
    !!meuPremio &&
    (meuPremio.estadoRepasse === "aguardando_aceite" ||
      meuPremio.estadoRepasse === "falha_pix");

  return (
    <main className="cx-fade mx-auto flex max-w-[560px] flex-col gap-4">
      <VoltarLink href={`/caixinhas/${caixinhaId}`}>Voltar para a caixinha</VoltarLink>

      {/* cabeçalho de desfecho */}
      <Card className="flex flex-col items-center gap-3 p-7 text-center">
        <span
          className={
            "grid h-16 w-16 place-items-center rounded-2xl " +
            (ehPremio ? "bg-gold/15 text-gold" : ehReembolso ? "bg-blue/15 text-blue" : "bg-surface text-muted")
          }
        >
          {ehPremio ? <Trophy size={30} /> : ehReembolso ? <Coins size={30} /> : <AlertTriangle size={30} />}
        </span>
        <h1 className="font-display text-2xl tracking-wide">
          {ehPremio && "Temos vencedores!"}
          {ehReembolso && "Reembolso total"}
          {acerto.modo === "indisponivel" && "Ainda não apurada"}
          {acerto.modo !== "premio" &&
            acerto.modo !== "reembolso" &&
            acerto.modo !== "indisponivel" &&
            "Caixinha cancelada"}
        </h1>
        {ehPremio && (
          <p className="text-sm text-muted">
            {acerto.ganhadores.length} ganhador(es). Total custodiado{" "}
            {formatBRL(acerto.totalCustodiado)} · taxa retida {formatBRL(acerto.taxaServico)}.
          </p>
        )}
        {ehReembolso && (
          <p className="text-sm text-muted">
            Ninguém cravou o resultado — o dinheiro de todo mundo volta, taxa inclusa.
          </p>
        )}
        {acerto.modo === "indisponivel" && (
          <p className="text-sm text-muted">
            Esta caixinha está em <b>{acerto.estadoCaixinha}</b> — o acerto aparece quando
            ela for apurada.
          </p>
        )}
      </Card>

      {erro && (
        <Callout tom="warn">
          <span role="alert">{erro}</span>
        </Callout>
      )}

      {/* card de aceite — vencedor logado aguardando aceite (Story 4.6) */}
      {meuPremio && podeAceitar && (
        <Card className="flex flex-col gap-3 border-green/35 p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-green">
            <Crown size={16} /> Você ganhou {formatBRL(meuPremio.valor)}!
          </div>
          {meuPremio.estadoRepasse === "falha_pix" && (
            <p className="text-xs text-red">
              Não conseguimos enviar o PIX — confira sua chave PIX no perfil de pagamento e
              tente aceitar de novo.
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted">
            O prêmio vai para a chave PIX cadastrada no seu perfil. Ao aceitar, o PIX é
            disparado imediatamente e, após confirmado pelo banco, é irreversível.
          </p>
          <Botao variante="primary" bloco onClick={handleAceitar} disabled={aceitando}>
            <Trophy size={16} /> {aceitando ? "Processando…" : "Aceitar e receber o prêmio"}
          </Botao>
        </Card>
      )}

      {/* lista de ganhadores */}
      {ehPremio && (
        <Card className="p-6">
          <div className="mb-3 text-sm font-bold">Ganhadores</div>
          <ul className="flex flex-col gap-2.5">
            {acerto.ganhadores.map((g: ItemGanhador) => (
              <li
                key={g.email}
                className="flex flex-col gap-1.5 rounded-xl border border-line bg-bg2 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold">{g.email}</span>
                  <b className="font-display text-base text-gold">{formatBRL(g.valor)}</b>
                </div>
                <RepasseBadge estado={g.estadoRepasse} />
                {g.comprovante && (
                  <span className="text-[11px] text-muted">Comprovante: {g.comprovante}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* lista de reembolsos */}
      {ehReembolso && (
        <Card className="p-6">
          <div className="mb-3 text-sm font-bold">Reembolsos</div>
          <ul className="flex flex-col gap-2.5">
            {acerto.reembolsos.map((r) => (
              <li
                key={r.email}
                className="flex flex-col gap-1.5 rounded-xl border border-line bg-bg2 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13.5px] font-semibold">{r.email}</span>
                  <b className="font-display text-base text-blue">
                    {formatBRL(r.valorEstorno)}
                  </b>
                </div>
                <EstornoBadge estado={r.estadoEstorno} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(ehPremio || ehReembolso) && (
        <Botao variante="ghost" bloco onClick={compartilhar}>
          <Share2 size={15} /> Compartilhar resultado
        </Botao>
      )}
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
  const cores: Record<string, string> = {
    aguardando_aceite: "bg-amber/15 text-amber",
    pix_em_andamento: "bg-blue/15 text-blue",
    pago: "bg-green/15 text-green",
    falha_pix: "bg-red/15 text-red",
  };
  return (
    <span
      className={`w-fit rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cores[estado] ?? "bg-surface text-muted"}`}
    >
      {rotuloRepasse(estado)}
    </span>
  );
}

/**
 * Badge do estado do estorno (Story 5.2). O app nunca afirma "reembolsado"
 * antes de o Provedor confirmar.
 */
function EstornoBadge({ estado }: { estado: string | null }) {
  if (estado === "concluido") {
    return (
      <span className="w-fit rounded-full bg-green/15 px-2.5 py-0.5 text-[11px] font-bold text-green">
        reembolsado ✓
      </span>
    );
  }
  return (
    <span className="w-fit rounded-full bg-amber/15 px-2.5 py-0.5 text-[11px] font-bold text-amber">
      estorno em processamento
    </span>
  );
}
