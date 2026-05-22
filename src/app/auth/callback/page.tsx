"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { consumirCallback } from "@/lib/auth";
import { BotaoLink, Card } from "@/components/ui";

/**
 * Callback do magic link (Story 2.1 / AC-2/AC-3 — redesenhada na Story 7.6
 * do Épico 7). Lê `token` (+`redirectTo`), consome via API; em sucesso
 * navega para `redirectTo`; em erro mostra tela amigável (NFR-6).
 */
interface Estado {
  fase: "verificando" | "erro";
  mensagem: string | null;
}

export default function AuthCallbackPage() {
  const [estado, setEstado] = useState<Estado>({ fase: "verificando", mensagem: null });

  useEffect(() => {
    let cancelado = false;

    async function consumir() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const redirectToParam = params.get("redirectTo") ?? "/";

      if (!token) {
        if (!cancelado) {
          setEstado({ fase: "erro", mensagem: "Link sem token. Solicite um novo." });
        }
        return;
      }

      try {
        await consumirCallback(token);
        if (!cancelado) window.location.assign(redirectToParam);
      } catch (e) {
        if (cancelado) return;
        setEstado({
          fase: "erro",
          mensagem:
            e instanceof ApiError
              ? (e.problem.detail ?? e.problem.title)
              : "Algo deu errado. Tente de novo.",
        });
      }
    }

    void consumir();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <main className="cx-fade flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-[400px] p-8 text-center">
        {estado.fase === "verificando" ? (
          <div className="flex flex-col items-center gap-4">
            <span className="grid h-14 w-14 animate-pulse place-items-center rounded-2xl bg-gradient-to-br from-green to-green-d text-[#04210f]">
              <Sparkles size={26} />
            </span>
            <h1 className="font-display text-xl tracking-wide">Entrando…</h1>
            <p className="text-sm text-muted">Validando seu link mágico.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber/15 text-amber">
              <AlertTriangle size={26} />
            </span>
            <h1 className="font-display text-xl tracking-wide">Não foi possível entrar</h1>
            <p className="text-sm text-muted">{estado.mensagem ?? "Link inválido ou expirado."}</p>
            <BotaoLink href="/entrar" variante="primary">
              Enviar novo link
            </BotaoLink>
          </div>
        )}
      </Card>
    </main>
  );
}
