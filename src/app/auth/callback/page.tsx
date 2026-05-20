"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { consumirCallback } from "@/lib/auth";

/**
 * Tela de callback do magic link (Story 2.1, AC-2/AC-3).
 *
 * Lê `token` (e `redirectTo` opcional) do query, chama a API; em sucesso,
 * navega para `redirectTo` (ou `/`); em erro, mostra tela amigável com
 * botão para voltar a `/entrar`.
 */
interface Estado {
  fase: "verificando" | "erro";
  mensagem: string | null;
}

export default function AuthCallbackPage() {
  const [estado, setEstado] = useState<Estado>({
    fase: "verificando",
    mensagem: null,
  });

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
        if (!cancelado) {
          window.location.assign(redirectToParam);
        }
      } catch (e) {
        if (cancelado) return;
        if (e instanceof ApiError) {
          setEstado({ fase: "erro", mensagem: e.problem.detail ?? e.problem.title });
        } else {
          setEstado({ fase: "erro", mensagem: "Algo deu errado. Tente de novo." });
        }
      }
    }

    void consumir();
    return () => {
      cancelado = true;
    };
  }, []);

  if (estado.fase === "verificando") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-semibold">Entrando...</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Validando seu link mágico.
        </p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Não foi possível entrar</h1>
      <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-xs">
        {estado.mensagem ?? "Link inválido ou expirado."}
      </p>
      <a
        href="/entrar"
        className="min-h-[44px] flex items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Enviar novo link
      </a>
    </main>
  );
}
