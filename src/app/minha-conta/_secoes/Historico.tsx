"use client";

/**
 * Seção "Histórico" da tela /minha-conta (Minha Conta, 2026-05).
 *
 * Lê o agregado do back e renderiza 4 cards de stats + lista de eventos
 * recentes. Toda formatação de dinheiro via `@/lib/money` (regra dura).
 */
import { useEffect, useState } from "react";
import {
  Activity,
  Ban,
  PartyPopper,
  Sparkles,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { Botao, Card } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { formatBRL } from "@/lib/money";
import { consultarHistorico } from "@/lib/conta";
import type { EventoAtividade, HistoricoResponse } from "@/types/conta";

const ICONE_EVENTO: Record<EventoAtividade["tipo"], React.ReactNode> = {
  vitoria: <Trophy size={16} className="text-green" />,
  criacao: <Sparkles size={16} className="text-blue" />,
  pagamento: <Wallet size={16} className="text-gold" />,
  cancelamento: <Ban size={16} className="text-red" />,
};

const ROTULO_EVENTO: Record<EventoAtividade["tipo"], string> = {
  vitoria: "Vitória",
  criacao: "Caixinha criada",
  pagamento: "Pagamento",
  cancelamento: "Cancelada",
};

function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function HistoricoSecao() {
  const [dados, setDados] = useState<HistoricoResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await consultarHistorico());
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Erro inesperado",
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (cancelado) return;
      await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (carregando) {
    return (
      <Card>
        <p className="text-muted">Carregando histórico…</p>
      </Card>
    );
  }
  if (erro || !dados) {
    return (
      <Card>
        <p className="text-red">{erro ?? "Não foi possível carregar."}</p>
        <div className="mt-3">
          <Botao type="button" variante="ghost" onClick={() => void carregar()}>
            Tentar de novo
          </Botao>
        </div>
      </Card>
    );
  }

  const t = dados.totais;
  const taxaPct = Math.round(t.taxaAcerto * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <CardStat
          icone={<Activity size={16} className="text-blue" />}
          label="Caixinhas"
          valor={t.totalCaixinhas.toString()}
        />
        <CardStat
          icone={<Trophy size={16} className="text-green" />}
          label="Vitórias"
          valor={t.vitorias.toString()}
        />
        <CardStat
          icone={<PartyPopper size={16} className="text-gold" />}
          label="Total ganho"
          valor={formatBRL(t.totalGanho)}
        />
        <CardStat
          icone={<TrendingUp size={16} className="text-green" />}
          label="Taxa de acerto"
          valor={`${taxaPct}%`}
        />
      </div>

      <Card>
        <h2 className="mb-3 text-[16px] font-bold">Atividade recente</h2>
        {dados.atividadeRecente.length === 0 ? (
          <p className="text-[13px] text-muted">Sem atividade ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dados.atividadeRecente.map((ev, i) => (
              <li
                key={`${ev.ocorridoEm}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-line2 bg-bg2 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card">
                    {ICONE_EVENTO[ev.tipo]}
                  </span>
                  <div className="min-w-0">
                    <b className="block truncate text-[13px]">{ev.titulo}</b>
                    <span className="block text-[11.5px] text-muted">
                      {ROTULO_EVENTO[ev.tipo]} · {formatarData(ev.ocorridoEm)}
                    </span>
                  </div>
                </div>
                {ev.valor && (
                  <span
                    className={
                      ev.tipo === "vitoria"
                        ? "text-[13px] font-bold text-green"
                        : "text-[13px] font-semibold text-text"
                    }
                  >
                    {ev.tipo === "vitoria" ? "+" : ""}
                    {formatBRL(ev.valor)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CardStat({
  icone,
  label,
  valor,
}: {
  icone: React.ReactNode;
  label: string;
  valor: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-[11.5px] text-muted">
        {icone}
        <span>{label}</span>
      </div>
      <p className="mt-1 font-display text-[22px] leading-none">{valor}</p>
    </Card>
  );
}
