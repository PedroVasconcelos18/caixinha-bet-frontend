/**
 * Cliente da verificação de e-mail (Minha Conta, 2026-05).
 * Espelha `/auth/verificar-email/{confirmar,reenviar}`.
 */
import { ApiError, apiFetch, readApiResponse } from "./api";
import type { Sessao } from "./auth";

/**
 * Consome o token do link do e-mail. `POST /auth/verificar-email/confirmar`.
 * Em sucesso, abre sessão (Set-Cookie) e devolve `Sessao` — o usuário sai
 * logado direto da landing /verificar-email.
 * Erros: 404 (token inválido), 410 (expirado/usado).
 */
export async function confirmarVerificacao(token: string): Promise<Sessao> {
  const resp = await apiFetch("/auth/verificar-email/confirmar", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  const body = await readApiResponse<Sessao>(resp);
  if (!body) {
    throw new ApiError({
      type: "about:blank",
      title: "Resposta inesperada",
      status: 500,
      detail: "/auth/verificar-email/confirmar devolveu corpo vazio",
    });
  }
  return body;
}

/**
 * Reenvia o link de verificação. `POST /auth/verificar-email/reenviar`.
 * Sempre 204 — anti-enumeração. O back só dispara se o e-mail existe e
 * ainda não foi verificado.
 */
export async function reenviarVerificacao(email: string): Promise<void> {
  const resp = await apiFetch("/auth/verificar-email/reenviar", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  await readApiResponse(resp);
}
