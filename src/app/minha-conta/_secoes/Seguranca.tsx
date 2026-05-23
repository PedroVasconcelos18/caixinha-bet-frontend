"use client";

/**
 * Seção "Segurança" da tela /minha-conta (Minha Conta, 2026-05).
 *
 * Mostra status do e-mail verificado + form de troca de senha (atual + nova).
 * Trata 401 com `type` `.../senha-atual-incorreta` exibindo mensagem inline.
 */
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Botao, Campo, Card, Input, cx } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import { ApiError } from "@/lib/api";
import type { Sessao } from "@/lib/auth";
import { trocarSenha } from "@/lib/conta";

function forcaSenha(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return Math.min(s, 4);
}

const ROTULO_FORCA = ["", "Fraca", "Razoável", "Boa", "Forte"];

export function SegurancaSecao({ sessao }: { sessao: Sessao }) {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { notificar } = useToast();

  const score = forcaSenha(senhaNova);
  const podeEnviar =
    senhaAtual.length > 0 && score >= 2 && senhaNova === confirmar && !enviando;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      await trocarSenha(senhaAtual, senhaNova);
      notificar("Senha alterada", "win");
      setSenhaAtual("");
      setSenhaNova("");
      setConfirmar("");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.problem.type?.includes("senha-atual-incorreta")) {
          setErro("Senha atual incorreta.");
        } else {
          setErro(e.problem.detail ?? e.problem.title);
        }
      } else {
        setErro("Erro inesperado.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-[16px] font-bold">Status</h2>
        <div className="flex items-center gap-3 rounded-xl border border-line2 bg-bg2 p-3 text-[13px]">
          <ShieldCheck
            size={18}
            className={sessao.emailVerificado ? "text-green" : "text-amber"}
          />
          <div>
            <b className="block">E-mail</b>
            <span className="text-muted">
              {sessao.emailVerificado ? "Verificado" : "Pendente — confira sua caixa."}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-[16px] font-bold">Trocar senha</h2>
        <form onSubmit={enviar} className="flex flex-col gap-3.5">
          <Campo label="Senha atual">
            <Input
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              autoComplete="current-password"
            />
          </Campo>
          <Campo
            label="Nova senha"
            hint={
              senhaNova
                ? `Força: ${ROTULO_FORCA[score]} (mín. ≥8 com letra e número)`
                : "≥8 caracteres com letra e número."
            }
          >
            <Input
              type="password"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              autoComplete="new-password"
            />
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={cx(
                    "h-1 flex-1 rounded-full",
                    n <= score ? "bg-green" : "bg-line2",
                  )}
                />
              ))}
            </div>
          </Campo>
          <Campo
            label="Confirmar nova senha"
            hint={
              confirmar && confirmar !== senhaNova
                ? "As senhas não conferem."
                : undefined
            }
          >
            <Input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
            />
          </Campo>
          {erro && (
            <p className="rounded-lg border border-red/30 bg-red/10 p-2.5 text-[12.5px] text-red">
              {erro}
            </p>
          )}
          <Botao type="submit" variante="primary" disabled={!podeEnviar}>
            {enviando ? "Alterando…" : "Alterar senha"}
          </Botao>
        </form>
      </Card>
    </div>
  );
}
