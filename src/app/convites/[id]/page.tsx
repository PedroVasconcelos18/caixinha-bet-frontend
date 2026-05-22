"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Mail, ShieldCheck, CheckCircle2, Lock } from "lucide-react";
import { ApiError } from "@/lib/api";
import { atualizarChavePix, me, type Sessao } from "@/lib/auth";
import { aceitarConvite, buscarConvite, definirPalpite } from "@/lib/caixinha";
import { formatBRL } from "@/lib/money";
import { estadoVisual, bandeiraDe, formatarDataHora } from "@/lib/ui";
import { useToast } from "@/components/Toasts";
import {
  Botao,
  BotaoLink,
  Card,
  Callout,
  Campo,
  Input,
  StatusPill,
  cx,
} from "@/components/ui";
import type { ConviteResponse } from "@/types/caixinha";

/** Type do back para reconhecer 422 "chave PIX obrigatória". */
const TYPE_CHAVE_PIX_OBRIGATORIA = "https://caixinha.bet/problems/chave-pix-obrigatoria";

/**
 * Tela do convite (Story 2.5 / FR-5 — redesenhada na Story 7.6 do Épico 7).
 *
 * A LÓGICA é preservada: aceitar convite, escolher palpite (radios),
 * cadastrar chave PIX quando o palpite exige (com retomada do palpite
 * pendente). Mobile-first 360×640 (NFR-3).
 */
export default function ConvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { notificar } = useToast();
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [convite, setConvite] = useState<ConviteResponse | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [palpitePendente, setPalpitePendente] = useState<number | null>(null);
  const [chavePixForm, setChavePixForm] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([buscarConvite(parseInt(id, 10)), me()]);
      setConvite(c);
      setSessao(s);
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
    void (async () => {
      if (!cancelado) await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  async function aceitar() {
    if (!convite) return;
    setAgindo(true);
    setErroAcao(null);
    try {
      await aceitarConvite(convite.caixinhaId);
      notificar("Convite aceito! Agora escolha seu palpite.", "win");
      await carregar();
    } catch (e) {
      setErroAcao(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Algo deu errado. Tente de novo.",
      );
    } finally {
      setAgindo(false);
    }
  }

  /** Envia o palpite à API. Separado de `palpitar` para que `salvarChavePix`
   *  possa retomar o palpite pendente sem depender do `sessao` do closure
   *  (que ainda está desatualizado logo após `setSessao`). */
  async function enviarPalpite(resultadoPossivelId: number) {
    if (!convite) return;
    setAgindo(true);
    setErroAcao(null);
    try {
      await definirPalpite(convite.caixinhaId, resultadoPossivelId);
      notificar("Palpite salvo!", "win");
      await carregar();
    } catch (e) {
      // cinto-e-suspensório: se o back devolveu 422 chave-pix-obrigatoria
      // (sessão local desatualizada), abre o form do mesmo jeito.
      if (e instanceof ApiError && e.problem.type === TYPE_CHAVE_PIX_OBRIGATORIA) {
        setPalpitePendente(resultadoPossivelId);
      } else {
        setErroAcao(
          e instanceof ApiError
            ? (e.problem.detail ?? e.problem.title)
            : "Algo deu errado. Tente de novo.",
        );
      }
    } finally {
      setAgindo(false);
    }
  }

  async function palpitar(resultadoPossivelId: number) {
    if (!convite) return;
    // FR-5: precisa de chave PIX antes de palpitar — guarda e mostra o form.
    if (!sessao?.chavePix) {
      setPalpitePendente(resultadoPossivelId);
      return;
    }
    await enviarPalpite(resultadoPossivelId);
  }

  async function salvarChavePix() {
    if (!chavePixForm.trim()) return;
    setAgindo(true);
    setErroAcao(null);
    try {
      const novaSessao = await atualizarChavePix(chavePixForm.trim());
      setSessao(novaSessao);
      if (palpitePendente !== null) {
        const idPalpite = palpitePendente;
        setPalpitePendente(null);
        setChavePixForm("");
        // chama enviarPalpite direto: a chave PIX já foi salva, não
        // re-checa `sessao` (que ainda está desatualizado neste tick).
        await enviarPalpite(idPalpite);
      } else {
        setChavePixForm("");
        notificar("Chave PIX cadastrada!", "win");
      }
    } catch (e) {
      setErroAcao(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Não conseguimos salvar a chave PIX. Tente de novo.",
      );
    } finally {
      setAgindo(false);
    }
  }

  if (estado === "carregando") {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  if (estado === "erro" || !convite) {
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

  const st = estadoVisual(convite.estado);
  const prazoFuturo = new Date(convite.prazoEntrada) > new Date();
  const podeAceitar = convite.eu.status === "convidado";
  const podePalpitar = convite.eu.status !== "convidado" && prazoFuturo;
  const palpiteAtual = convite.eu.palpiteResultadoPossivelId;

  return (
    <main className="cx-fade mx-auto flex max-w-[560px] flex-col gap-4">
      {/* cabeçalho de confronto */}
      <Card
        className="bg-gradient-to-br from-[#0e1a2e] to-[#0a1322] p-6 text-center"
        acento={st.cor}
      >
        <p className="mb-3 text-[11px] uppercase tracking-wider text-muted">
          Você foi convidado
        </p>
        <div className="mb-4 flex items-center justify-center gap-6">
          <Confronto bandeira={bandeiraDe(convite.ladoA)} nome={convite.ladoA} />
          <span className="font-display tracking-wide text-muted">VS</span>
          <Confronto bandeira={bandeiraDe(convite.ladoB)} nome={convite.ladoB} />
        </div>
        <h1 className="font-display text-xl tracking-wide">{convite.titulo}</h1>
        <div className="mt-3 flex justify-center">
          <StatusPill label={st.label} cor={st.cor} glow={st.glow} />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between border-b border-line py-2 text-[13px]">
          <span className="text-muted">Valor do ingresso</span>
          <span>{formatBRL(convite.valorIngresso)}</span>
        </div>
        <div className="flex items-center justify-between border-b border-line py-2 text-[13px]">
          <span className="text-muted">Taxa de serviço</span>
          <span>{formatBRL(convite.taxaServico)}</span>
        </div>
        <div className="flex items-center justify-between py-2 text-[13px]">
          <span className="text-muted">Prazo de entrada</span>
          <span>{formatarDataHora(convite.prazoEntrada)}</span>
        </div>
      </Card>

      {erroAcao && (
        <Callout tom="warn">
          <span role="alert">{erroAcao}</span>
        </Callout>
      )}

      {podeAceitar && (
        <Botao variante="primary" grande bloco onClick={aceitar} disabled={agindo}>
          <CheckCircle2 size={17} /> {agindo ? "Aceitando…" : "Aceitar convite"}
        </Botao>
      )}

      {/* form de chave PIX — quando palpitar exige */}
      {palpitePendente !== null && (
        <Card className="flex flex-col gap-3 border-amber/30 p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-amber">
            <ShieldCheck size={16} /> Cadastre sua chave PIX
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Para palpitar, a gente precisa saber para onde mandar o prêmio caso você
            ganhe. Pode ser CPF, e-mail, telefone ou chave aleatória — fica salvo para
            todas as suas caixinhas.
          </p>
          <Campo label="Sua chave PIX">
            <Input
              autoFocus
              value={chavePixForm}
              onChange={(e) => setChavePixForm(e.target.value)}
              placeholder="alice@exemplo.com"
            />
          </Campo>
          <div className="flex gap-2">
            <Botao
              variante="primary"
              onClick={salvarChavePix}
              disabled={agindo || !chavePixForm.trim()}
              className="flex-1"
            >
              {agindo ? "Salvando…" : "Salvar e palpitar"}
            </Botao>
            <Botao
              variante="ghost"
              onClick={() => {
                setPalpitePendente(null);
                setChavePixForm("");
              }}
              disabled={agindo}
              className="flex-1"
            >
              Cancelar
            </Botao>
          </div>
        </Card>
      )}

      {/* palpite */}
      <Card className="p-6">
        <div className="mb-1 flex items-center gap-2 text-sm font-bold">
          {!prazoFuturo && <Lock size={14} className="text-muted" />}
          Seu palpite
        </div>
        {!prazoFuturo && (
          <p className="mb-2 text-xs text-muted">
            Palpite congelado — o prazo de entrada terminou.
          </p>
        )}
        {!podePalpitar && podeAceitar && (
          <p className="mb-2 text-xs text-muted">
            Aceite o convite primeiro para escolher seu palpite.
          </p>
        )}
        <fieldset disabled={!podePalpitar || agindo} className="mt-2">
          <ul className="flex flex-col gap-2">
            {convite.resultadosPossiveis.map((r) => (
              <li key={r.id}>
                <label
                  className={cx(
                    "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-sm",
                    palpiteAtual === r.id
                      ? "border-green bg-green/[0.07]"
                      : "border-line2 bg-bg2",
                    (!podePalpitar || agindo) && "opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="palpite"
                    value={r.id}
                    checked={palpiteAtual === r.id}
                    onChange={() => palpitar(r.id)}
                    className="h-4 w-4 accent-[var(--color-green)]"
                  />
                  {r.rotulo}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </Card>

      <BotaoLink href={`/caixinhas/${convite.caixinhaId}`} variante="ghost" bloco>
        <Mail size={15} /> Ver a caixinha completa
      </BotaoLink>
    </main>
  );
}

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
