"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Zap, ShieldCheck, Clock, CheckCircle2, Copy } from "lucide-react";
import { ApiError } from "@/lib/api";
import { atualizarChavePix, atualizarPerfilPagamento, me, type Sessao } from "@/lib/auth";
import { buscarCobranca, gerarCobranca } from "@/lib/pagamento";
import { formatBRL } from "@/lib/money";
import { useToast } from "@/components/Toasts";
import { Botao, Card, Callout, Campo, Input, VoltarLink } from "@/components/ui";
import type { CobrancaResponse } from "@/types/caixinha";

/**
 * Tela de pagamento PIX (Story 3.2 / FR-7 — redesenhada na Story 7.6 do
 * Épico 7 para o design aprovado.
 *
 * A LÓGICA é preservada: perfil de pagamento (nome+CPF+chave PIX) antes da
 * cobrança; geração/consulta de cobrança; QR + copia-e-cola. SEM botão
 * "já paguei" — o Status só vira `pago` por webhook (FR-8).
 *
 * Mobile-first 360×640 (NFR-3).
 */
export default function PagamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const caixinhaId = parseInt(id, 10);
  const { notificar } = useToast();

  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [cobranca, setCobranca] = useState<CobrancaResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [nomeForm, setNomeForm] = useState("");
  const [cpfForm, setCpfForm] = useState("");
  const [chavePixForm, setChavePixForm] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const s = await me();
      setSessao(s);
      if (s.perfilPagamentoCompleto) {
        try {
          setCobranca(await buscarCobranca(caixinhaId));
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            setCobranca(null);
          } else {
            throw e;
          }
        }
      }
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Erro ao carregar a tela de pagamento.",
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

  async function salvarPerfil() {
    if (!nomeForm.trim() || !cpfForm.trim() || !chavePixForm.trim()) return;
    setAgindo(true);
    setErro(null);
    try {
      await atualizarPerfilPagamento(nomeForm.trim(), cpfForm.trim());
      const s = await atualizarChavePix(chavePixForm.trim());
      setSessao(s);
      notificar("Perfil de pagamento salvo!", "win");
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Não conseguimos salvar seu perfil. Tente de novo.",
      );
    } finally {
      setAgindo(false);
    }
  }

  async function gerar() {
    setAgindo(true);
    setErro(null);
    try {
      setCobranca(await gerarCobranca(caixinhaId));
      notificar("Código PIX gerado.", "pix");
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Não conseguimos gerar a cobrança. Tente de novo.",
      );
    } finally {
      setAgindo(false);
    }
  }

  async function copiar() {
    if (!cobranca) return;
    try {
      await navigator.clipboard.writeText(cobranca.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard pode falhar (permissão) — usuário ainda copia manual
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="cx-fade mx-auto flex max-w-[560px] flex-col gap-4">
      <VoltarLink href={`/caixinhas/${caixinhaId}`}>Voltar para a caixinha</VoltarLink>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted">Pagamento do ingresso</p>
        <h1 className="font-display text-[26px] tracking-wide">Pagar via PIX</h1>
      </div>

      {erro && (
        <Callout tom="warn">
          <span role="alert">{erro}</span>
        </Callout>
      )}

      {/* perfil de pagamento — só se incompleto */}
      {sessao && !sessao.perfilPagamentoCompleto && (
        <Card className="flex flex-col gap-3 border-amber/30 p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-amber">
            <ShieldCheck size={16} /> Complete seu perfil para pagar
          </div>
          <p className="text-xs leading-relaxed text-muted">
            O provedor de pagamento precisa do seu nome e CPF para registrar a cobrança.
            A chave PIX é para onde o prêmio vai, se você ganhar. Fica salvo para as
            próximas caixinhas.
          </p>
          <Campo label="Nome completo">
            <Input
              value={nomeForm}
              onChange={(e) => setNomeForm(e.target.value)}
              placeholder="Maria da Silva"
            />
          </Campo>
          <Campo label="CPF">
            <Input
              inputMode="numeric"
              value={cpfForm}
              onChange={(e) => setCpfForm(e.target.value)}
              placeholder="000.000.000-00"
            />
          </Campo>
          <Campo label="Sua chave PIX (recebimento)">
            <Input
              value={chavePixForm}
              onChange={(e) => setChavePixForm(e.target.value)}
              placeholder="e-mail, telefone, CPF ou chave aleatória"
            />
          </Campo>
          <Botao
            variante="primary"
            bloco
            onClick={salvarPerfil}
            disabled={agindo || !nomeForm.trim() || !cpfForm.trim() || !chavePixForm.trim()}
          >
            {agindo ? "Salvando…" : "Salvar perfil"}
          </Botao>
        </Card>
      )}

      {/* gerar cobrança — perfil completo, sem cobrança ativa */}
      {sessao?.perfilPagamentoCompleto && !cobranca && (
        <Card className="flex flex-col gap-3 p-6">
          <p className="text-sm text-muted">Gere sua cobrança PIX para pagar o ingresso.</p>
          <Botao variante="pix" bloco grande onClick={gerar} disabled={agindo}>
            <Zap size={17} /> {agindo ? "Gerando…" : "Gerar cobrança PIX"}
          </Botao>
        </Card>
      )}

      {/* cobrança ativa — QR + copia-e-cola */}
      {cobranca && (
        <Card className="flex flex-col items-center gap-4 p-6">
          <p className="text-sm text-muted">
            Valor:{" "}
            <b className="font-display text-lg text-gold">{formatBRL(cobranca.valor)}</b>
          </p>
          {cobranca.qrCodeBase64 && (
            // next/image não otimiza data-URIs base64 e o QR vem inline da API.
            // <img> é a escolha correta — warning suprimido conscientemente.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${cobranca.qrCodeBase64}`}
              alt="QR code do PIX"
              className="h-56 w-56 rounded-xl border border-line2 bg-white p-2"
            />
          )}
          <div className="flex w-full flex-col gap-2">
            <span className="text-xs font-semibold">PIX copia-e-cola</span>
            <textarea
              readOnly
              value={cobranca.copiaECola}
              rows={3}
              className="rounded-xl border border-line2 bg-bg2 p-2.5 text-xs text-text"
            />
            <Botao variante="ghost" bloco onClick={copiar}>
              {copiado ? <CheckCircle2 size={15} /> : <Copy size={15} />}
              {copiado ? "Copiado!" : "Copiar código"}
            </Botao>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Clock size={13} /> Expira em{" "}
            {new Date(cobranca.expiraEm).toLocaleString("pt-BR")}
          </p>
          <Callout tom="neutral">
            Aguardando confirmação do pagamento. Assim que o PIX cair, a gente confirma
            automaticamente — você não precisa avisar.
          </Callout>
          <Botao variante="ghost" bloco onClick={gerar} disabled={agindo}>
            {agindo ? "Gerando…" : "Gerar nova cobrança"}
          </Botao>
        </Card>
      )}
    </main>
  );
}
