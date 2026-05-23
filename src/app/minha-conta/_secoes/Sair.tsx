"use client";

/**
 * Seção "Sair / Excluir conta" (Minha Conta, 2026-05).
 *
 * - Sair: confirma via window.confirm; chama sair() e redireciona.
 * - Excluir: modal exige digitar "EXCLUIR" — botão só habilita quando bate.
 *   Confirma → excluirConta("EXCLUIR") → redireciona para /entrar.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Trash2 } from "lucide-react";
import { Botao, Callout, Card, Input } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import { ApiError } from "@/lib/api";
import { sair } from "@/lib/auth";
import { excluirConta } from "@/lib/conta";

export function SairSecao() {
  const router = useRouter();
  const { notificar } = useToast();
  const [modal, setModal] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const sairAgora = async () => {
    if (!confirm("Tem certeza que quer sair?")) return;
    await sair();
    router.push("/entrar");
  };

  const confirmarExclusao = async () => {
    if (confirmacao !== "EXCLUIR") return;
    setExcluindo(true);
    try {
      await excluirConta("EXCLUIR");
      router.push("/entrar");
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Erro";
      notificar(msg, "alert");
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-2 text-[16px] font-bold">Sair da conta</h2>
        <p className="mb-3 text-[13px] text-muted">
          Encerra sua sessão neste dispositivo.
        </p>
        <Botao type="button" variante="ghost" onClick={sairAgora}>
          <LogOut size={16} />
          Sair desta conta
        </Botao>
      </Card>

      <Card className="border-red/40">
        <h2 className="mb-2 text-[16px] font-bold text-red">Excluir minha conta</h2>
        <p className="mb-3 text-[13px] text-muted">
          Sua conta fica indisponível para login imediatamente. Caixinhas em
          andamento das quais você participa continuarão normalmente — o ledger
          do Caixinha Bet é imutável e suas vitórias passadas permanecem
          registradas.
        </p>
        <Botao
          type="button"
          variante="ghost"
          className="border-red/40 text-red"
          onClick={() => setModal(true)}
        >
          <Trash2 size={16} />
          Excluir minha conta
        </Botao>
      </Card>

      {modal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-sm">
            <h3 className="text-[16px] font-bold text-red">Confirmar exclusão</h3>
            <p className="mt-2 text-[13px] text-muted">
              Digite <b className="text-text">EXCLUIR</b> para confirmar:
            </p>
            <div className="mt-3">
              <Input
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="EXCLUIR"
                autoFocus
              />
            </div>
            <Callout tom="warn">
              Esta ação não pode ser desfeita pelo app — apenas pelo suporte.
            </Callout>
            <div className="mt-3 flex justify-end gap-2">
              <Botao
                type="button"
                variante="ghost"
                onClick={() => {
                  setModal(false);
                  setConfirmacao("");
                }}
                disabled={excluindo}
              >
                Cancelar
              </Botao>
              <Botao
                type="button"
                variante="primary"
                className="!bg-gradient-to-br !from-red !to-[#b03030] !text-white !shadow-none"
                onClick={confirmarExclusao}
                disabled={confirmacao !== "EXCLUIR" || excluindo}
              >
                {excluindo ? "Excluindo…" : "Excluir conta"}
              </Botao>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
