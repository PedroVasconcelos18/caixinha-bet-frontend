"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import {
  atualizarChavePix,
  atualizarPerfilPagamento,
  me,
  type Sessao,
} from "@/lib/auth";
import { buscarCobranca, gerarCobranca } from "@/lib/pagamento";
import type { CobrancaResponse } from "@/types/caixinha";

/**
 * Tela de pagamento PIX (Story 3.2 v5, FR-7).
 *
 * Fluxo:
 *  - Carrega a sessão. Se o perfil de pagamento (nome+CPF+chave PIX) está
 *    incompleto, mostra o form de perfil ANTES de qualquer cobrança.
 *  - Com perfil completo: tenta carregar a cobrança ativa; se não há,
 *    oferece "gerar cobrança".
 *  - Exibe QR code + copia-e-cola + prazo + "aguardando confirmação".
 *  - SEM botão "já paguei" — Status só vira `pago` por webhook (FR-8).
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

  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [cobranca, setCobranca] = useState<CobrancaResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agindo, setAgindo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Form de perfil de pagamento.
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
        // Tenta carregar cobrança ativa; 404 = ainda não gerou (ok).
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
      // Dois endpoints (perfil = nome+CPF; chave PIX separada). Encadeados.
      await atualizarPerfilPagamento(nomeForm.trim(), cpfForm.trim());
      const s = await atualizarChavePix(chavePixForm.trim());
      setSessao(s);
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
      // Clipboard pode falhar (permissão); o usuário ainda pode copiar manual.
    }
  }

  if (carregando) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p>Carregando...</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header>
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Pagamento do ingresso
        </p>
        <h1 className="text-xl font-semibold tracking-tight">Pagar via PIX</h1>
      </header>

      {erro && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {erro}
        </p>
      )}

      {/* Form de perfil de pagamento — só se incompleto. */}
      {sessao && !sessao.perfilPagamentoCompleto && (
        <section className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <h2 className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Complete seu perfil para pagar
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            O provedor de pagamento precisa do seu nome e CPF para registrar a
            cobrança. A chave PIX é pra onde o prêmio vai, se você ganhar. Fica
            tudo salvo pras próximas Caixinhas.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Nome completo</span>
            <input
              type="text"
              value={nomeForm}
              onChange={(e) => setNomeForm(e.target.value)}
              placeholder="Maria da Silva"
              className="min-h-[44px] rounded-md border border-amber-400 bg-white px-3 text-base dark:border-amber-600 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">CPF</span>
            <input
              type="text"
              inputMode="numeric"
              value={cpfForm}
              onChange={(e) => setCpfForm(e.target.value)}
              placeholder="000.000.000-00"
              className="min-h-[44px] rounded-md border border-amber-400 bg-white px-3 text-base dark:border-amber-600 dark:bg-zinc-950"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Sua chave PIX (recebimento)</span>
            <input
              type="text"
              value={chavePixForm}
              onChange={(e) => setChavePixForm(e.target.value)}
              placeholder="email, telefone, CPF ou chave aleatória"
              className="min-h-[44px] rounded-md border border-amber-400 bg-white px-3 text-base dark:border-amber-600 dark:bg-zinc-950"
            />
          </label>
          <button
            type="button"
            onClick={salvarPerfil}
            disabled={
              agindo ||
              !nomeForm.trim() ||
              !cpfForm.trim() ||
              !chavePixForm.trim()
            }
            className="min-h-[48px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {agindo ? "Salvando..." : "Salvar perfil"}
          </button>
        </section>
      )}

      {/* Geração de cobrança — perfil completo, sem cobrança ativa. */}
      {sessao?.perfilPagamentoCompleto && !cobranca && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Gere sua cobrança PIX para pagar o ingresso.
          </p>
          <button
            type="button"
            onClick={gerar}
            disabled={agindo}
            className="min-h-[48px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {agindo ? "Gerando..." : "Gerar cobrança PIX"}
          </button>
        </section>
      )}

      {/* Cobrança ativa — QR + copia-e-cola. */}
      {cobranca && (
        <section className="flex flex-col items-center gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Valor: <strong>R$ {cobranca.valor}</strong>
          </p>
          {cobranca.qrCodeBase64 && (
            // next/image não otimiza data-URIs base64 (não há URL remota
            // para o loader processar) e a imagem do QR vem inline da API.
            // <img> é a escolha correta aqui — warning suprimido conscientemente.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${cobranca.qrCodeBase64}`}
              alt="QR code do PIX"
              className="h-56 w-56 rounded-md border border-zinc-300 dark:border-zinc-700"
            />
          )}
          <div className="flex w-full flex-col gap-1">
            <span className="text-xs font-medium">PIX copia-e-cola</span>
            <textarea
              readOnly
              value={cobranca.copiaECola}
              rows={3}
              className="rounded-md border border-zinc-300 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={copiar}
              className="min-h-[44px] rounded-md border border-zinc-400 px-4 text-sm font-medium dark:border-zinc-600"
            >
              {copiado ? "Copiado!" : "Copiar código"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Expira em: {new Date(cobranca.expiraEm).toLocaleString("pt-BR")}
          </p>
          <p className="rounded-md border border-blue-300 bg-blue-50 p-3 text-center text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300">
            Aguardando confirmação do pagamento. Assim que o PIX cair, a gente
            confirma automaticamente — você não precisa avisar.
          </p>
          <button
            type="button"
            onClick={gerar}
            disabled={agindo}
            className="min-h-[44px] rounded-md border border-zinc-300 px-4 text-xs disabled:opacity-50 dark:border-zinc-700"
          >
            {agindo ? "Gerando..." : "Gerar nova cobrança"}
          </button>
        </section>
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
