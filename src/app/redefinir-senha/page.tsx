"use client";

import { useState } from "react";
import { Lock, CheckCircle2, AlertTriangle } from "lucide-react";
import { ApiError } from "@/lib/api";
import { redefinirSenha } from "@/lib/auth";
import { Botao, Card, Campo, Input, Callout, BotaoLink } from "@/components/ui";

/**
 * Tela de redefinição de senha (auth por senha, 2026-05). Acessada pelo
 * link do e-mail: `/redefinir-senha?token=...`. Em sucesso o backend abre
 * a sessão — navegamos para a home. Mobile-first 360×640 (NFR-3).
 */
export default function RedefinirSenhaPage() {
  const [senha, setSenha] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  function lerToken(): string | null {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("token");
  }

  // Força mínima espelha o backend (Senha): 8+ chars, com letra e número.
  const senhaForte =
    senha.length >= 8 && /[a-zA-Z]/.test(senha) && /\d/.test(senha);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const token = lerToken();
    if (!token) {
      setEstado("erro");
      setErro("Link sem token. Solicite uma nova recuperação.");
      return;
    }
    setEstado("enviando");
    setErro(null);
    try {
      await redefinirSenha(token, senha);
      window.location.assign("/");
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
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-green to-green-d text-[#04210f]">
            <Lock size={26} />
          </span>
          <h1 className="font-display text-[26px] tracking-wide">Nova senha</h1>
          <p className="mt-1.5 text-sm text-muted">
            Escolha uma senha forte — pelo menos 8 caracteres, com letras e
            números.
          </p>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-3">
          <Campo label="Nova senha">
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua nova senha"
            />
          </Campo>

          <Botao
            type="submit"
            variante="primary"
            bloco
            grande
            disabled={estado === "enviando" || !senhaForte}
          >
            <CheckCircle2 size={17} />
            {estado === "enviando" ? "Salvando…" : "Salvar nova senha"}
          </Botao>

          {erro && (
            <Callout tom="warn" icone={<AlertTriangle size={16} />}>
              <span role="alert">{erro}</span>
            </Callout>
          )}
        </form>

        <p className="mt-4 text-center text-[13px] text-muted">
          <BotaoLink href="/entrar" variante="ghost" bloco>
            Voltar para entrar
          </BotaoLink>
        </p>
      </Card>
    </main>
  );
}
