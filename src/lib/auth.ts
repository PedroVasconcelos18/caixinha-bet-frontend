/**
 * Cliente de auth do front (Story 2.1).
 *
 * Espelha os endpoints do backend:
 *  - solicitarAcesso → POST /auth/solicitar-acesso
 *  - consumirCallback → GET /auth/callback?token=...
 *  - me → GET /auth/me
 *  - sair → POST /auth/sair
 *
 * Erros são RFC 9457 (ApiError em @/lib/api). Tom do front:
 * caloroso/NFR-6 (mensagens humanas para "link expirado" / "já usado" /
 * "não encontrado").
 */
import { ApiError, apiFetch, readApiResponse } from "./api";

export interface Sessao {
  email: string;
}

export async function solicitarAcesso(
  email: string,
  redirectTo?: string,
): Promise<void> {
  const resp = await apiFetch("/auth/solicitar-acesso", {
    method: "POST",
    body: JSON.stringify({ email, ...(redirectTo ? { redirectTo } : {}) }),
  });
  await readApiResponse(resp); // 204 = undefined
}

/**
 * Consome o callback. Não usa `apiFetch` direto porque o navegador segue
 * o 302 automaticamente quando o `redirect` da request fica em "follow"
 * (default) — e aí lemos no JS o que aconteceu via `resp.redirected`.
 *
 * Em caso de erro (404/410), o servidor responde JSON ProblemDetails sem
 * 302, e o `readApiResponse` empacota como ApiError.
 */
export async function consumirCallback(token: string): Promise<{
  redirectTo: string;
}> {
  const resp = await apiFetch(
    `/auth/callback?token=${encodeURIComponent(token)}`,
    {
      method: "GET",
      redirect: "manual",
    },
  );
  // Com redirect: 'manual', a Response tem type 'opaqueredirect' e status 0
  // quando o navegador detectou o 302. Não conseguimos ler o Location pelo
  // CORS, mas o cookie já foi gravado (Set-Cookie chega em paralelo).
  // Solução: depois do callback, perguntamos /auth/me para validar e
  // navegamos para o redirectTo conhecido pelo cliente (do query param).
  if (resp.type === "opaqueredirect" || resp.status === 0) {
    return { redirectTo: "/" };
  }
  // Se chegou aqui sem ser opaque, é erro (404/410) — ApiError.
  await readApiResponse(resp);
  return { redirectTo: "/" };
}

export async function me(): Promise<Sessao> {
  const resp = await apiFetch("/auth/me", { method: "GET" });
  const body = await readApiResponse<Sessao>(resp);
  if (!body) {
    throw new ApiError({
      type: "about:blank",
      title: "Resposta inesperada",
      status: 500,
      detail: "/auth/me devolveu corpo vazio",
    });
  }
  return body;
}

export async function sair(): Promise<void> {
  const resp = await apiFetch("/auth/sair", { method: "POST" });
  await readApiResponse(resp);
}
