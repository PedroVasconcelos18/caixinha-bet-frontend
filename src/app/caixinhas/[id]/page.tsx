"use client";

import { useCallback, useEffect, useState, use } from "react";
import {
  Users,
  Wallet,
  Calendar,
  Coins,
  Crown,
  Clock,
  CheckCircle2,
  Circle,
  Trophy,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { me } from "@/lib/auth";
import {
  buscarCaixinha,
  convidar,
  encerrarPrazo,
  aceitarConvite,
  definirPalpite,
} from "@/lib/caixinha";
import { formatBRL } from "@/lib/money";
import { estadoVisual, bandeiraDe, formatarDataHora } from "@/lib/ui";
import { useToast } from "@/components/Toasts";
import TimelineEstado from "@/components/TimelineEstado";
import { Botao, BotaoLink, Card, Input, StatusPill, VoltarLink, cx } from "@/components/ui";
import type { CaixinhaResponse, ParticipanteResumoResponse } from "@/types/caixinha";

/**
 * Detalhe da Caixinha (Story 2.2/2.4/3.5/4.x — redesenhado na Story 7.5 do
 * Épico 7 para o design aprovado: cabeçalho de confronto, timeline,
 * painel de participantes e coluna de resumo/regras.
 *
 * A LÓGICA é preservada (buscarCaixinha, me, convidar, encerrarPrazo,
 * checagens de permissão). As ações por participante do design eram "demo"
 * (agir por terceiros); aqui cada usuário só age na PRÓPRIA linha — aceitar
 * o convite, definir palpite e ir pagar.
 *
 * Mobile-first 360×640: 2 colunas empilham, timeline quebra sem scroll
 * horizontal (NFR-3).
 */
export default function CaixinhaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const idNum = parseInt(id, 10);
  const { notificar } = useToast();
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [caixinha, setCaixinha] = useState<CaixinhaResponse | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [meuEmail, setMeuEmail] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [c, sessao] = await Promise.all([
        buscarCaixinha(idNum),
        me().catch(() => null),
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
        setMensagem("Erro ao carregar a caixinha.");
      }
      setEstado("erro");
    }
  }, [idNum]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  // Story 4.5 (FR-15): encerrar prazo manualmente — ação relevante, confirma.
  async function handleEncerrarPrazo() {
    if (
      !window.confirm(
        "Encerrar o prazo agora? A caixinha vai formar (se tiver pagamentos " +
          "suficientes) ou ser cancelada. Não dá para desfazer.",
      )
    ) {
      return;
    }
    try {
      await encerrarPrazo(idNum);
      notificar("Prazo de entrada encerrado.", "alert");
      await carregar();
    } catch (e) {
      notificar(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Não foi possível encerrar o prazo.",
        "alert",
      );
    }
  }

  if (estado === "carregando") {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  if (estado === "erro" || !caixinha) {
    return (
      <main className="cx-fade flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="font-display text-xl">Não foi possível abrir</h1>
        <p className="max-w-xs text-sm text-muted">{mensagem ?? "Erro desconhecido."}</p>
        <BotaoLink href="/" variante="primary">
          Voltar ao início
        </BotaoLink>
      </main>
    );
  }

  const st = estadoVisual(caixinha.estado);
  const dono = caixinha.participantes.find((p) => p.dono);
  const souDono = !!dono && !!meuEmail && dono.email === meuEmail;
  const aceitaNovosConvites =
    caixinha.estado === "coletando_convites" || caixinha.estado === "coletando_pagamentos";

  return (
    <main className="cx-fade flex flex-col gap-5">
      <VoltarLink href="/">Minhas caixinhas</VoltarLink>

      {/* ---------------- cabeçalho de confronto ---------------- */}
      <header
        className="relative overflow-hidden rounded-[22px] border border-line bg-gradient-to-br from-[#0e1a2e] to-[#0a1322] px-6 py-7 sm:px-8"
        style={{ borderTopColor: st.cor, borderTopWidth: 3 }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-[300px] w-[300px] rounded-full opacity-20"
          style={{ background: `radial-gradient(circle,${st.cor},transparent 65%)` }}
          aria-hidden
        />
        <div className="relative">
          <StatusPill label={st.label} cor={st.cor} glow={st.glow} />
          <div className="my-4 flex items-center justify-center gap-6">
            <Confronto bandeira={bandeiraDe(caixinha.ladoA)} nome={caixinha.ladoA} />
            <span className="font-display tracking-wide text-muted">VS</span>
            <Confronto bandeira={bandeiraDe(caixinha.ladoB)} nome={caixinha.ladoB} />
          </div>
          <h1 className="text-center font-display text-[22px] tracking-wide">
            {caixinha.titulo}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <Coins size={16} className="text-gold" />
            Prêmio atual
            <b className="font-display text-xl text-gold">{formatBRL(caixinha.premioPotencial)}</b>
            <span>
              · arrecadado {formatBRL(caixinha.totalCustodiado)} − taxa{" "}
              {formatBRL(caixinha.taxaServico)}
            </span>
          </div>
        </div>
      </header>

      {/* ---------------- timeline ---------------- */}
      <TimelineEstado estado={caixinha.estado} />

      {/* ---------------- duas colunas ---------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        {/* participantes */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between gap-2 text-sm font-bold">
            <span className="flex items-center gap-2">
              <Users size={16} /> Participantes
            </span>
            <span className="text-xs font-medium text-muted">
              {caixinha.participantes.filter((p) => p.status === "pago").length}/
              {caixinha.minimoParticipantes} pagos
            </span>
          </div>

          <ul className="flex flex-col gap-2.5">
            {caixinha.participantes.map((p) => (
              <ParticipanteLinha
                key={p.email}
                p={p}
                caixinha={caixinha}
                ehVoce={p.email === meuEmail}
                onMudou={carregar}
                notificar={notificar}
              />
            ))}
          </ul>

          {souDono && aceitaNovosConvites && (
            <ConvidarMais caixinhaId={caixinha.id} onConvidados={carregar} notificar={notificar} />
          )}
        </Card>

        {/* coluna lateral */}
        <aside className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Wallet size={16} /> Resumo
            </div>
            <SideRow k="Ingresso" v={formatBRL(caixinha.valorIngresso)} />
            <SideRow k="Mínimo de pagantes" v={String(caixinha.minimoParticipantes)} />
            <SideRow k="Nº de ganhadores" v={String(caixinha.numeroGanhadores)} />
            <SideRow
              k="Prazo de entrada"
              v={formatarDataHora(caixinha.prazoEntrada)}
              icone={<Calendar size={13} />}
            />
            <SideRow
              k="Apuração"
              v={formatarDataHora(caixinha.dataApuracao)}
              icone={<Calendar size={13} />}
            />
            <SideRow k="Arrecadado" v={formatBRL(caixinha.totalCustodiado)} />
            <SideRow k="Taxa de serviço" v={`− ${formatBRL(caixinha.taxaServico)}`} />
            <div className="mt-3 flex items-center justify-between rounded-xl border border-gold/30 bg-gold/10 px-4 py-3.5">
              <span>Prêmio</span>
              <b className="font-display text-xl text-gold">
                {formatBRL(caixinha.premioPotencial)}
              </b>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-2.5 flex items-center gap-2 text-sm font-bold">
              <ShieldCheck size={15} className="text-green" /> Regras
            </div>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
              <li>Prêmio dividido igualmente entre quem acertar.</li>
              <li>PIX liberado ao atingir o mínimo de aceites.</li>
              <li>Sem mínimo de pagantes → cancela e devolve.</li>
              <li>Valor, prazos e resultados travados após a criação.</li>
            </ul>
          </Card>

          {/* dono: apurar (Story 4.2) */}
          {souDono && caixinha.estado === "formada" && (
            <Card className="border-gold/35 p-6">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-bold">
                <Trophy size={15} className="text-gold" /> Apurar resultado
              </div>
              <p className="mb-3 text-xs leading-snug text-muted">
                Você seleciona o resultado real do confronto. O prêmio é transferido
                automaticamente — a ação é irreversível.
              </p>
              <BotaoLink href={`/caixinhas/${caixinha.id}/apuracao`} variante="primary" bloco>
                <Crown size={16} /> Apurar e pagar vencedores
              </BotaoLink>
            </Card>
          )}

          {/* acerto de contas (Story 4.4) */}
          {(caixinha.estado === "apurada" ||
            caixinha.estado === "repasse_parcial" ||
            caixinha.estado === "repassada") && (
            <BotaoLink href={`/caixinhas/${caixinha.id}/acerto`} variante="primary" bloco>
              <Trophy size={16} /> Ver acerto de contas
            </BotaoLink>
          )}

          {/* dono: encerrar prazo (Story 4.5/FR-15) */}
          {souDono && aceitaNovosConvites && (
            <Botao variante="ghost" bloco onClick={handleEncerrarPrazo}>
              <Clock size={15} /> Encerrar prazo de entrada
            </Botao>
          )}
        </aside>
      </div>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Confronto — bloco bandeira + nome.                                      */
/* ----------------------------------------------------------------------- */
function Confronto({ bandeira, nome }: { bandeira: string; nome: string }) {
  return (
    <span className="flex flex-1 flex-col items-center gap-1.5 text-center text-sm font-bold">
      <span className="text-4xl leading-none" aria-hidden>
        {bandeira}
      </span>
      <span className="line-clamp-1">{nome}</span>
    </span>
  );
}

/* ----------------------------------------------------------------------- */
/* ParticipanteLinha — uma linha do painel de participantes.               */
/* As ações só aparecem na linha do PRÓPRIO usuário (não há mais o modo    */
/* "demo" de agir por terceiros).                                          */
/* ----------------------------------------------------------------------- */
function ParticipanteLinha({
  p,
  caixinha,
  ehVoce,
  onMudou,
  notificar,
}: {
  p: ParticipanteResumoResponse;
  caixinha: CaixinhaResponse;
  ehVoce: boolean;
  onMudou: () => Promise<void>;
  notificar: (msg: string, tipo?: "mail" | "pix" | "win" | "alert") => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const venceu = caixinha.estado === "apurada" && p.status === "pago"; // detalhe do vencedor vive no acerto

  // estado da caixinha que ainda aceita aceitar/palpitar
  const fasePreJogo =
    caixinha.estado === "coletando_convites" || caixinha.estado === "coletando_pagamentos";

  async function aceitar() {
    setOcupado(true);
    try {
      await aceitarConvite(caixinha.id);
      notificar("Convite aceito! Agora escolha seu palpite.", "win");
      await onMudou();
    } catch (e) {
      notificar(
        e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : "Não foi possível aceitar.",
        "alert",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function palpitar(resultadoId: number) {
    setOcupado(true);
    try {
      await definirPalpite(caixinha.id, resultadoId);
      notificar("Palpite registrado.", "win");
      await onMudou();
    } catch (e) {
      notificar(
        e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : "Não foi possível palpitar.",
        "alert",
      );
    } finally {
      setOcupado(false);
    }
  }

  const iconeStatus =
    p.status === "pago" ? (
      <CheckCircle2 size={16} className="text-green" />
    ) : p.status === "aceito" || p.status === "pagamento_iniciado" ? (
      <Clock size={16} className="text-amber" />
    ) : (
      <Circle size={16} className="text-muted" />
    );

  const subStatus =
    p.status === "pago"
      ? "PIX confirmado"
      : p.status === "pagamento_iniciado"
        ? "Pagando…"
        : p.status === "aceito"
          ? "Aceitou — aguardando PIX"
          : "Convite enviado";

  // pode pagar: é você, aceito, com palpite, na fase de pagamentos
  const podePagar =
    ehVoce &&
    caixinha.estado === "coletando_pagamentos" &&
    p.status === "aceito" &&
    p.palpiteResultadoPossivelId != null;
  const jaPagando = ehVoce && p.status === "pagamento_iniciado";

  return (
    <li
      className={cx(
        "flex flex-col gap-3 rounded-xl border bg-bg2 p-3.5 sm:flex-row sm:items-center sm:justify-between",
        venceu ? "border-gold/40 bg-gold/[0.06]" : "border-line",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cx(
            "grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg",
            p.status === "pago" && "bg-green/15",
            (p.status === "aceito" || p.status === "pagamento_iniciado") && "bg-amber/15",
            p.status === "convidado" && "bg-surface",
          )}
        >
          {iconeStatus}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            {p.dono && <Crown size={12} className="text-gold" />}
            <span className="truncate">{p.email}</span>
            {ehVoce && <span className="text-[11px] text-muted">(você)</span>}
          </div>
          <div className="text-[11.5px] text-muted">
            {subStatus}
            {p.palpiteRotulo && <span className="text-blue"> · palpite: {p.palpiteRotulo}</span>}
          </div>
        </div>
      </div>

      {/* ações reais — só na própria linha */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {ehVoce && p.status === "convidado" && fasePreJogo && (
          <Botao variante="mini" onClick={aceitar} disabled={ocupado}>
            Aceitar convite
          </Botao>
        )}
        {ehVoce && (p.status === "aceito" || p.status === "convidado") && fasePreJogo && (
          <select
            value={p.palpiteResultadoPossivelId ?? ""}
            disabled={ocupado}
            onChange={(e) => e.target.value && palpitar(parseInt(e.target.value, 10))}
            className="min-h-[44px] max-w-[150px] rounded-lg border border-line2 bg-surface px-2.5 text-xs text-text"
          >
            <option value="">Escolher palpite…</option>
            {caixinha.resultadosPossiveis.map((r) => (
              <option key={r.ordem} value={r.id}>
                {r.rotulo}
              </option>
            ))}
          </select>
        )}
        {(podePagar || jaPagando) && (
          <BotaoLink href={`/caixinhas/${caixinha.id}/pagamento`} variante="pix">
            {jaPagando ? "Ver pagamento" : "Pagar PIX"}
          </BotaoLink>
        )}
      </div>
    </li>
  );
}

/* ----------------------------------------------------------------------- */
/* SideRow — linha do painel de resumo.                                    */
/* ----------------------------------------------------------------------- */
function SideRow({ k, v, icone }: { k: string; v: string; icone?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2 text-[13px] last:border-none">
      <span className="flex items-center gap-1.5 text-muted">
        {icone}
        {k}
      </span>
      <span className="text-right">{v}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* ConvidarMais — bloco de convite (Story 2.4). Só dono, estados de coleta. */
/* ----------------------------------------------------------------------- */
function ConvidarMais({
  caixinhaId,
  onConvidados,
  notificar,
}: {
  caixinhaId: number;
  onConvidados: () => Promise<void>;
  notificar: (msg: string, tipo?: "mail" | "pix" | "win" | "alert") => void;
}) {
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function convidarMais() {
    const emails = valor
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (emails.length === 0) {
      notificar("Informe ao menos um e-mail.", "alert");
      return;
    }
    setEnviando(true);
    try {
      const r = await convidar(caixinhaId, emails);
      const partes: string[] = [];
      if (r.convidados.length) partes.push(`${r.convidados.length} convidado(s)`);
      if (r.jaPresentes.length) partes.push(`${r.jaPresentes.length} já estava(m)`);
      notificar(partes.join(" · ") || "Nada a convidar.", "mail");
      setValor("");
      await onConvidados();
    } catch (e) {
      notificar(
        e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : "Algo deu errado.",
        "alert",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Convidar mais alguém por e-mail"
        />
        <Botao variante="primary" onClick={convidarMais} disabled={enviando}>
          <Mail size={15} /> {enviando ? "Convidando…" : "Convidar"}
        </Botao>
      </div>
    </div>
  );
}
