/**
 * Cliente da tela /minha-conta (2026-05). Espelha os endpoints novos do
 * back. `enviarFoto` NÃO usa `apiFetch` para preservar o boundary do
 * multipart (apiFetch força `Content-Type: application/json` quando há body).
 */
import { ApiError, API_BASE_URL, apiFetch, isProblemDetails, readApiResponse } from "./api";
import type { Sessao } from "./auth";
import type { HistoricoResponse } from "@/types/conta";

function lerOuExplodir<T>(body: T | undefined, endpoint: string): T {
  if (body === undefined) {
    throw new ApiError({
      type: "about:blank",
      title: "Resposta inesperada",
      status: 500,
      detail: `${endpoint} devolveu corpo vazio`,
    });
  }
  return body;
}

/**
 * Atualiza campos do perfil. `PUT /auth/me/perfil`. Body parcial: campos
 * `undefined`/`null` não mudam; string vazia limpa os opcionais (telefone,
 * cidade, bio); `nomeCompleto` blank é ignorado (preserva o atual).
 */
export async function atualizarPerfil(dados: {
  nomeCompleto?: string | null;
  dataNascimento?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  bio?: string | null;
}): Promise<Sessao> {
  const resp = await apiFetch("/auth/me/perfil", {
    method: "PUT",
    body: JSON.stringify(dados),
  });
  return lerOuExplodir(await readApiResponse<Sessao>(resp), "/auth/me/perfil");
}

/** `PUT /auth/me/senha`. 401 com `type` `.../senha-atual-incorreta` se errada. */
export async function trocarSenha(senhaAtual: string, senhaNova: string): Promise<void> {
  const resp = await apiFetch("/auth/me/senha", {
    method: "PUT",
    body: JSON.stringify({ senhaAtual, senhaNova }),
  });
  // 401 aqui = senha atual incorreta (legítimo), não sessão expirada.
  await readApiResponse(resp, { semRedirect401: true }); // 204
}

/**
 * Upload da foto via multipart. 415 = tipo, 413 = tamanho — tratar via
 * `e.problem.type`. Note: fetch manual para preservar o boundary do
 * multipart (apiFetch força Content-Type: application/json).
 */
export async function enviarFoto(arquivo: File): Promise<Sessao> {
  const form = new FormData();
  form.append("foto", arquivo);
  const resp = await fetch(`${API_BASE_URL}/auth/me/foto`, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!resp.ok) {
    const texto = await resp.text();
    try {
      const parsed = JSON.parse(texto);
      if (isProblemDetails(parsed)) throw new ApiError(parsed);
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
    throw new ApiError({
      type: "about:blank",
      title: "Erro ao enviar foto",
      status: resp.status,
      detail: texto || `HTTP ${resp.status}`,
    });
  }
  const body = (await resp.json()) as Sessao;
  return body;
}

/** `DELETE /auth/me/foto`. */
export async function removerFoto(): Promise<Sessao> {
  const resp = await apiFetch("/auth/me/foto", { method: "DELETE" });
  return lerOuExplodir(await readApiResponse<Sessao>(resp), "/auth/me/foto");
}

/** `GET /auth/me/historico`. */
export async function consultarHistorico(): Promise<HistoricoResponse> {
  const resp = await apiFetch("/auth/me/historico", { method: "GET" });
  return lerOuExplodir(
    await readApiResponse<HistoricoResponse>(resp),
    "/auth/me/historico",
  );
}

/**
 * `DELETE /auth/me`. `confirmacao` precisa ser exatamente `"EXCLUIR"`.
 * 400 com `type` `.../confirmacao-invalida` se a string for outra coisa.
 */
export async function excluirConta(confirmacao: string): Promise<void> {
  const resp = await apiFetch("/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ confirmacao }),
  });
  await readApiResponse(resp); // 204
}
