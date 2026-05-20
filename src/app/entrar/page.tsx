"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { solicitarAcesso } from "@/lib/auth";

/**
 * Tela de entrada (Story 2.1, AC-1).
 *
 * Mobile-first 360×640: input grande (alvo ≥44px), botão grande, sem
 * scroll horizontal. Tom caloroso (NFR-6): "Hora de entrar — coloca seu
 * e-mail, te mandamos um link mágico".
 *
 * Não usa rotas dinâmicas — o `redirectTo` chega como query param e é
 * enviado ao back para sair no link do e-mail.
 */
export default function EntrarPage() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "erro">(
    "idle",
  );
  const [erro, setErro] = useState<string | null>(null);

  function lerRedirectTo(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    return params.get("redirectTo") ?? undefined;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    setErro(null);
    try {
      await solicitarAcesso(email.trim(), lerRedirectTo());
      setEstado("enviado");
    } catch (e) {
      setEstado("erro");
      setErro(
        e instanceof ApiError
          ? e.problem.detail ?? e.problem.title
          : "Algo deu errado. Tente de novo.",
      );
    }
  }

  if (estado === "enviado") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Confere o e-mail!
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400 max-w-xs">
          Se este e-mail estiver válido, te mandamos um link mágico que vale por
          15 minutos.
        </p>
        <button
          type="button"
          onClick={() => {
            setEstado("idle");
            setEmail("");
          }}
          className="mt-2 min-h-[44px] px-4 text-sm underline text-zinc-700 dark:text-zinc-300"
        >
          Mandar para outro e-mail
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-xs text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Hora de entrar</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Coloca seu e-mail e te mandamos um link mágico — sem senha, sem
          cadastro.
        </p>
      </div>

      <form onSubmit={enviar} className="flex w-full max-w-xs flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            E-mail
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <button
          type="submit"
          disabled={estado === "enviando" || !email.includes("@")}
          className="min-h-[48px] rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {estado === "enviando" ? "Enviando..." : "Me manda o link"}
        </button>

        {erro && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {erro}
          </p>
        )}
      </form>
    </main>
  );
}
