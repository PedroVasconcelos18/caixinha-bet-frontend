"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Trophy, Users, Flag, Sparkles, Zap, ChevronRight } from "lucide-react";
import { ApiError } from "@/lib/api";
import { listarCaixinhas } from "@/lib/caixinha";
import { Decimal, formatBRL } from "@/lib/money";
import { estadoVisual, isEstadoTerminal, bandeiraDe } from "@/lib/ui";
import { BotaoLink, Card, StatusPill, Pill } from "@/components/ui";
import type { CaixinhaResumoResponse } from "@/types/caixinha";

/**
 * Dashboard — as Caixinhas do Usuário (Story 6.1 / FR-17, redesenhado na
 * Story 7.3 do Épico 7 para o design aprovado: hero, faixa de stats e grid
 * de cards de confronto.
 *
 * Decisão registrada (Épico 7): o stat de GMV custodiado ("Em jogo nas
 * caixinhas") é MANTIDO conforme o design aprovado — sobrescreve o guardrail
 * anti-glamour do PRD §10/§14 por decisão explícita de produto.
 *
 * Dinheiro 100% via `@/lib/money` (Decimal), nunca `Number` (NFR-1).
 * Mobile-first 360×640, sem scroll horizontal (NFR-3).
 */
export default function Dashboard() {
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
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

  // Agregados — soma de GMV via Decimal (NFR-1), nunca `+` em number.
  const { totalEmJogo, ativas } = useMemo(() => {
    const total = caixinhas.reduce(
      (acc, c) => acc.plus(new Decimal(c.premioPotencial)),
      new Decimal(0),
    );
    return {
      totalEmJogo: total,
      ativas: caixinhas.filter((c) => !isEstadoTerminal(c.estado)).length,
    };
  }, [caixinhas]);

  if (estado === "carregando") {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Carregando suas caixinhas…</p>
      </main>
    );
  }

  if (estado === "erro") {
    return (
      <main>
        <Card className="border-red/30 bg-red/[0.06]">
          <p role="alert" className="text-sm text-red">
            {mensagem}
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="cx-fade flex flex-col gap-7">
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden rounded-[24px] border border-line bg-gradient-to-br from-[#0e1a2e] to-[#0a1322] px-6 py-10 sm:px-10 sm:py-12">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[420px] w-[420px] rounded-full"
          style={{
            background: "radial-gradient(circle,rgba(31,224,116,0.28),transparent 65%)",
            filter: "blur(12px)",
          }}
          aria-hidden
        />
        <div className="relative max-w-[600px]">
          <Pill>
            <Sparkles size={13} /> COPA DO MUNDO 2026
          </Pill>
          <h1 className="mt-4 font-display text-[34px] leading-[1.05] tracking-wide sm:text-[46px]">
            Crie sua caixinha.
            <br />
            <span className="text-green">Chame a galera.</span>
          </h1>
          <p className="mb-6 mt-3 max-w-[520px] text-[15px] leading-relaxed text-muted">
            Aposte jogo a jogo com os amigos. Quem cravar o resultado leva o bolo —
            dividido igualmente entre todos que acertarem.
          </p>
          <BotaoLink href="/caixinhas/nova" variante="primary" grande>
            <Zap size={18} /> Criar caixinha agora
          </BotaoLink>
        </div>
      </section>

      {/* ---------------- Stats ---------------- */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Stat
          icone={<Coins size={18} />}
          rotulo="Em jogo nas caixinhas"
          valor={formatBRL(totalEmJogo)}
          acento="text-gold bg-gold/15"
        />
        <Stat
          icone={<Trophy size={18} />}
          rotulo="Caixinhas ativas"
          valor={String(ativas)}
          acento="text-green bg-green/15"
        />
        <Stat
          icone={<Users size={18} />}
          rotulo="Total de caixinhas"
          valor={String(caixinhas.length)}
          acento="text-blue bg-blue/15"
        />
      </section>

      {/* ---------------- Grid de caixinhas ---------------- */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg tracking-wide">
          <Flag size={16} className="text-green" /> Minhas caixinhas
        </h2>

        {caixinhas.length === 0 ? (
          <Card className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green/15 text-green">
              <Trophy size={26} />
            </span>
            <p className="max-w-[360px] text-sm text-muted">
              Você ainda não participa de nenhuma caixinha. Que tal criar a primeira e
              chamar a galera?
            </p>
            <BotaoLink href="/caixinhas/nova" variante="primary">
              <Zap size={16} /> Criar minha primeira caixinha
            </BotaoLink>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(310px,1fr))]">
            {caixinhas.map((c) => (
              <CaixinhaCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* Stat — card de estatística do dashboard.                                */
/* ----------------------------------------------------------------------- */
function Stat({
  icone,
  rotulo,
  valor,
  acento,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  acento: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-card px-5 py-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${acento}`}>
        {icone}
      </span>
      <div className="min-w-0">
        <div className="truncate font-display text-2xl tracking-wide">{valor}</div>
        <div className="mt-0.5 text-xs text-muted">{rotulo}</div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* CaixinhaCard — card de confronto clicável no grid.                      */
/* ----------------------------------------------------------------------- */
function CaixinhaCard({ c }: { c: CaixinhaResumoResponse }) {
  const st = estadoVisual(c.estado);
  // `confronto` chega como "Lado A × Lado B" — separa para as bandeiras.
  const [ladoA, ladoB] = c.confronto.split(/\s*[×x]\s*/);
  const pct = c.minimoParticipantes
    ? Math.min(100, (c.pagosConfirmados / c.minimoParticipantes) * 100)
    : 0;

  return (
    <Link
      href={`/caixinhas/${c.id}`}
      className="group relative overflow-hidden rounded-[18px] border border-line bg-card p-5 transition hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(0,0,0,0.4)]"
      style={{ borderTopColor: st.cor, borderTopWidth: 3 }}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <StatusPill label={st.label} cor={st.cor} glow={st.glow} />
        <ChevronRight size={18} className="text-muted" />
      </div>

      <div className="mb-3 flex items-center justify-center gap-4">
        <Confronto bandeira={bandeiraDe(ladoA)} nome={ladoA ?? "—"} />
        <span className="font-display text-[15px] tracking-wide text-muted">VS</span>
        <Confronto bandeira={bandeiraDe(ladoB)} nome={ladoB ?? "—"} />
      </div>

      <div className="mb-3.5 text-center text-[13px] text-muted">{c.titulo}</div>

      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: st.cor }}
        />
      </div>

      <div className="flex items-center justify-between text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Users size={13} /> {c.pagosConfirmados}/{c.minimoParticipantes} pagos
        </span>
        <span className="font-display text-base tracking-wide text-gold">
          {formatBRL(c.premioPotencial)}
        </span>
      </div>
    </Link>
  );
}

function Confronto({ bandeira, nome }: { bandeira: string; nome: string }) {
  return (
    <span className="flex flex-1 flex-col items-center gap-1.5 text-center text-sm font-bold">
      <span className="text-3xl leading-none" aria-hidden>
        {bandeira}
      </span>
      <span className="line-clamp-1">{nome}</span>
    </span>
  );
}
