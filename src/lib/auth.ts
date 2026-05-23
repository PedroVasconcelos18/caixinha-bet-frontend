/**
 * Cliente de auth do front (Story 2.1).
 *
 * Espelha os endpoints do backend:
 *  - registrar → POST /auth/registrar
 *  - login → POST /auth/login
 *  - recuperarSenha → POST /auth/recuperar-senha
 *  - redefinirSenha → POST /auth/redefinir-senha
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
  /** v5 FR-5: chave PIX cadastrada no perfil, ou `null` se ainda não. */
  chavePix: string | null;
  /** v5 FR-16: nome do perfil de pagamento, ou `null`. */
  nomeCompleto: string | null;
  /** v5 FR-16: CPF (só dígitos) do perfil de pagamento, ou `null`. */
  cpf: string | null;
  /** Minha Conta (2026-05): ISO date "YYYY-MM-DD" ou null para legados. */
  dataNascimento: string | null;
  /** Minha Conta: telefone só com dígitos (10/11), ou null. */
  telefone: string | null;
  cidade: string | null;
  bio: string | null;
  /** Path relativo `/auth/me/foto?v=...` (cache-buster) ou null. */
  fotoUrl: string | null;
  /** Minha Conta: false após cadastro novo, true após click no link. */
  emailVerificado: boolean;
  /** v5 Story 3.2: true se nome+CPF+chave PIX estão todos preenchidos. */
  perfilPagamentoCompleto: boolean;
}

/**
 * Cadastro explícito (Minha Conta, 2026-05). `POST /auth/registrar`.
 *
 * Resposta: 202 Accepted sem cookie — o backend dispara link de
 * verificação de e-mail. O usuário só fica logado após clicar no link
 * (rota `/verificar-email`).
 *
 * Erros possíveis: 400 (CPF inválido, idade <18, etc.), 409 com `type`
 * `.../email-ja-cadastrado` ou `.../cpf-ja-cadastrado`.
 */
export async function registrar(dados: {
  nomeCompleto: string;
  cpf: string;
  email: string;
  senha: string;
  dataNascimento: string; // "YYYY-MM-DD"
}): Promise<void> {
  const resp = await apiFetch("/auth/registrar", {
    method: "POST",
    body: JSON.stringify(dados),
  });
  await readApiResponse(resp); // 202 → undefined
}

/**
 * Login por e-mail + senha. `POST /auth/login`. Em sucesso, abre a sessão
 * (Set-Cookie) e devolve a `Sessao`. 401 = e-mail ou senha incorretos
 * (mensagem genérica, anti-enumeração).
 */
export async function login(email: string, senha: string): Promise<Sessao> {
  const resp = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
  // 401 legítimo aqui = credenciais incorretas; não redireciona (já está em /entrar).
  const body = await readApiResponse<Sessao>(resp, { semRedirect401: true });
  if (!body) {
    throw new ApiError({
      type: "about:blank",
      title: "Resposta inesperada",
      status: 500,
      detail: "/auth/login devolveu corpo vazio",
    });
  }
  return body;
}

/**
 * Solicita o link de recuperação de senha. `POST /auth/recuperar-senha`.
 * Responde sempre 204 — não revela se o e-mail tem conta (anti-enumeração).
 */
export async function recuperarSenha(email: string): Promise<void> {
  const resp = await apiFetch("/auth/recuperar-senha", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  await readApiResponse(resp); // 204 = undefined
}

/**
 * Redefine a senha a partir do token recebido por e-mail.
 * `POST /auth/redefinir-senha`. Em sucesso, abre a sessão e devolve a
 * `Sessao` (o usuário sai logado). Erros: 404 (token inválido), 410
 * (token expirado/usado), 400 (senha fraca).
 */
export async function redefinirSenha(
  token: string,
  senha: string,
): Promise<Sessao> {
  const resp = await apiFetch("/auth/redefinir-senha", {
    method: "POST",
    body: JSON.stringify({ token, senha }),
  });
  const body = await readApiResponse<Sessao>(resp);
  if (!body) {
    throw new ApiError({
      type: "about:blank",
      title: "Resposta inesperada",
      status: 500,
      detail: "/auth/redefinir-senha devolveu corpo vazio",
    });
  }
  return body;
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

/**
 * Atualiza a chave PIX de recebimento no perfil (Story 2.5 v5).
 *
 * `PUT /auth/me/chave-pix`. Retorna a sessão atualizada. 422 se a chave
 * estiver vazia (validação Bean Validation @NotBlank).
 */
export async function atualizarChavePix(chavePix: string): Promise<Sessao> {
  const resp = await apiFetch("/auth/me/chave-pix", {
    method: "PUT",
    body: JSON.stringify({ chavePix }),
  });
  const body = await readApiResponse<Sessao>(resp);
  if (!body) {
    throw new ApiError({
      type: "about:blank",
      title: "Resposta inesperada",
      status: 500,
      detail: "/auth/me/chave-pix devolveu corpo vazio",
    });
  }
  return body;
}

/**
 * Atualiza o perfil de pagamento — nome + CPF (Story 3.2 v5).
 *
 * `PUT /auth/me/perfil-pagamento`. Exigidos pelo Asaas para criar o
 * customer. 422 se o CPF for inválido.
 */
export async function atualizarPerfilPagamento(
  nomeCompleto: string,
  cpf: string,
): Promise<Sessao> {
  const resp = await apiFetch("/auth/me/perfil-pagamento", {
    method: "PUT",
    body: JSON.stringify({ nomeCompleto, cpf }),
  });
  const body = await readApiResponse<Sessao>(resp);
  if (!body) {
    throw new ApiError({
      type: "about:blank",
      title: "Resposta inesperada",
      status: 500,
      detail: "/auth/me/perfil-pagamento devolveu corpo vazio",
    });
  }
  return body;
}
