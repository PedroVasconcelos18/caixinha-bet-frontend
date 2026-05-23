import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy de auth do front (Story 2.1, Next 16+).
 *
 * <p>Verifica a PRESENÇA do cookie {@code caixinhabet_sessao} — não a
 * validade (validade é responsabilidade do backend nas rotas que exigem
 * `/auth/me` ou similar). Se ausente, redireciona para
 * `/entrar?redirectTo=<atual>`.
 *
 * <p>Whitelist: rotas públicas do próprio fluxo de entrada
 * ({@code /entrar}, {@code /auth/*}) e assets do Next.
 *
 * <p>No Next 16 a convenção é {@code proxy.ts} (renomeado de
 * {@code middleware.ts}, que foi deprecado).
 */
const COOKIE_SESSAO = "caixinhabet_sessao";

const ROTAS_PUBLICAS = new Set<string>([
  "/entrar",
  "/verificar-email",
  "/redefinir-senha",
]);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /auth/* é público (consome o token).
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }
  if (ROTAS_PUBLICAS.has(pathname)) {
    return NextResponse.next();
  }

  const temCookie = req.cookies.get(COOKIE_SESSAO);
  if (temCookie) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/entrar";
  url.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(url);
}

/**
 * `matcher` exclui assets do Next e ícones — o proxy só roda em páginas
 * reais. Sem isso, cada request a {@code /_next/static/*} faria o
 * redirect e quebraria o build.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
