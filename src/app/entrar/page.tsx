"use client";

import { useState } from "react";
import { Mail, Sparkles, CheckCircle2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { solicitarAcesso } from "@/lib/auth";
import { Botao, Card, Campo, Input, Callout } from "@/components/ui";

/**
 * Tela de entrada (Story 2.1 / AC-1 — redesenhada na Story 7.6 do Épico 7).
 *
 * Magic link por e-mail, sem senha. Tom caloroso (NFR-6): "Hora de entrar".
 * `redirectTo` chega como query param e segue para o back.
 * Mobile-first 360×640 (NFR-3).
 */
export default function EntrarPage() {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "enviado" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  function lerRedirectTo(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("redirectTo") ?? undefined;
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
          ? (e.problem.detail ?? e.problem.title)
          : "Algo deu errado. Tente de novo.",
      );
    }
  }

  return (
    <main className="cx-fade flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-[400px] p-7">
        {estado === "enviado" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-green/15 text-green">
              <CheckCircle2 size={26} />
            </span>
            <h1 className="font-display text-2xl tracking-wide">Confere o e-mail!</h1>
            <p className="text-sm text-muted">
              Se este e-mail estiver válido, te mandamos um link mágico que vale por 15
              minutos.
            </p>
            <button
              type="button"
              onClick={() => {
                setEstado("idle");
                setEmail("");
              }}
              className="min-h-[44px] text-sm text-green underline"
            >
              Mandar para outro e-mail
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 text-center">
              <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-green to-green-d text-[#04210f]">
                <Sparkles size={26} />
              </span>
              <h1 className="font-display text-[26px] tracking-wide">Hora de entrar</h1>
              <p className="mt-1.5 text-sm text-muted">
                Coloca seu e-mail e te mandamos um link mágico — sem senha, sem cadastro.
              </p>
            </div>

            <form onSubmit={enviar} className="flex flex-col gap-3">
              <Campo label="E-mail">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                />
              </Campo>

              <Botao
                type="submit"
                variante="primary"
                bloco
                grande
                disabled={estado === "enviando" || !email.includes("@")}
              >
                <Mail size={17} />
                {estado === "enviando" ? "Enviando…" : "Me manda o link"}
              </Botao>

              {erro && (
                <Callout tom="warn">
                  <span role="alert">{erro}</span>
                </Callout>
              )}
            </form>
          </>
        )}
      </Card>
    </main>
  );
}
