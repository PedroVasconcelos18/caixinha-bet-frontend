/**
 * Contrato HTTP com o backend — stub de fundação (Story 1.2).
 *
 * Regras DURAS (espelham architecture#Format/Naming Patterns):
 *  - Sucesso = corpo direto (SEM envelope). O tipo de resposta é o recurso.
 *  - Erro = RFC 9457 `application/problem+json` com `type`/`title`/`status`/
 *    `detail`. NUNCA inventar um formato de erro próprio.
 *  - camelCase 1:1 com a API — o backend já entrega camelCase; NÃO converter
 *    naming no front.
 *  - Dinheiro: campos monetários chegam como string decimal; converter SEMPRE
 *    via `moneyFromApi` (ver `./money`). NUNCA `Number` em dinheiro.
 *
 * Esta story NÃO implementa o cliente HTTP real (sem fetch). O cliente
 * concreto entra no épico que consumir a API. Aqui ficam os tipos do
 * contrato, fixados por construção.
 */

/** Erro padrão da API conforme RFC 9457 (application/problem+json). */
export interface ProblemDetails {
  /** URI que identifica o tipo do problema. */
  type: string;
  /** Resumo legível e curto do tipo do problema. */
  title: string;
  /** Código HTTP. */
  status: number;
  /** Explicação específica desta ocorrência. */
  detail?: string;
  /** URI da ocorrência específica (opcional). */
  instance?: string;
}

/** Base da API, vinda de env (ver `.env.example`). */
export const API_BASE_URL: string =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

/**
 * Type guard: a resposta é um ProblemDetails (erro RFC 9457)?
 * Útil para o cliente real (épico futuro) ramificar sucesso vs. erro sem
 * inventar convenção própria.
 */
export function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "title" in value &&
    "status" in value
  );
}

/**
 * fetch com `credentials: 'include'` (Story 2.1). Sem isso o navegador
 * não enviaria/aceitaria o cookie de sessão emitido pelo backend cross-
 * origin (front 3000 ↔ back 8080).
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

/**
 * Erro estruturado da API — `ProblemDetails` empacotado como Error JS para
 * `throw`. Carrega o status e o corpo original para ramificação no front.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.status = problem.status;
    this.problem = problem;
  }
}

/**
 * Lê uma resposta como ProblemDetails se for erro, ou como JSON do recurso
 * se for sucesso. 204 No Content devolve `undefined`. Erros não-RFC-9457
 * (raro) viram ApiError sintética com title genérico.
 */
export async function readApiResponse<T = unknown>(
  resp: Response,
): Promise<T | undefined> {
  if (resp.status === 204) return undefined;

  const texto = await resp.text();
  if (!resp.ok) {
    try {
      const parsed = JSON.parse(texto);
      if (isProblemDetails(parsed)) throw new ApiError(parsed);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      // fallthrough — JSON parse falhou
    }
    throw new ApiError({
      type: "about:blank",
      title: "Erro de comunicação",
      status: resp.status,
      detail: texto || `HTTP ${resp.status}`,
    });
  }
  return texto ? (JSON.parse(texto) as T) : undefined;
}
