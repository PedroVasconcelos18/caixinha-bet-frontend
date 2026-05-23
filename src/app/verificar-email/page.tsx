"use client";

/**
 * Landing do link de verificação de e-mail (Minha Conta, 2026-05).
 *
 * Lê `?token=...`, chama `confirmarVerificacao` no mount, e:
 *  - OK: mostra mensagem + redireciona para `/` (o back já abriu sessão).
 *  - 404 / 410: token inválido ou expirado/consumido. CTA "Voltar para o login".
 */
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, MailX } from "lucide-react";
import { BotaoLink, Card } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { confirmarVerificacao } from "@/lib/email-verificacao";

type Estado = "verificando" | "ok" | "erro";

export default function VerificarEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-12 sm:px-6">
          <Card className="w-full text-center">
            <p className="text-muted">Verificando…</p>
          </Card>
        </main>
      }
    >
      <VerificarEmailConteudo />
    </Suspense>
  );
}

function VerificarEmailConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [estado, setEstado] = useState<Estado>("verificando");
  const [problema, setProblema] = useState<{
    titulo: string;
    detalhe: string;
  } | null>(null);

  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      if (!token) {
        if (!cancelado) {
          setEstado("erro");
          setProblema({
            titulo: "Link inválido",
            detalhe: "Token ausente na URL.",
          });
        }
        return;
      }
      try {
        await confirmarVerificacao(token);
        if (cancelado) return;
        setEstado("ok");
        timer = setTimeout(() => router.push("/"), 1500);
      } catch (e) {
        if (cancelado) return;
        setEstado("erro");
        if (e instanceof ApiError) {
          setProblema({
            titulo: e.problem.title || "Não foi possível verificar",
            detalhe:
              e.problem.detail ??
              "O link pode ter expirado ou já ter sido usado.",
          });
        } else {
          setProblema({
            titulo: "Erro inesperado",
            detalhe: "Tente novamente em instantes.",
          });
        }
      }
    })();
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, router]);

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 py-12 sm:px-6">
      <Card className="w-full text-center">
        {estado === "verificando" && (
          <>
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-blue/15 text-blue">
              <MailX size={26} />
            </span>
            <h1 className="font-display text-[24px] leading-tight">
              Verificando…
            </h1>
            <p className="mt-2 text-sm text-muted">
              Aguarde um instante.
            </p>
          </>
        )}
        {estado === "ok" && (
          <>
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-green/15 text-green">
              <CheckCircle2 size={26} />
            </span>
            <h1 className="font-display text-[24px] leading-tight">
              E-mail verificado!
            </h1>
            <p className="mt-2 text-sm text-muted">Redirecionando…</p>
          </>
        )}
        {estado === "erro" && problema && (
          <>
            <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber/15 text-amber">
              <AlertTriangle size={26} />
            </span>
            <h1 className="font-display text-[24px] leading-tight">
              {problema.titulo}
            </h1>
            <p className="mt-2 text-sm text-muted">{problema.detalhe}</p>
            <div className="mt-5">
              <BotaoLink href="/entrar" variante="primary">
                Voltar para o login
              </BotaoLink>
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
