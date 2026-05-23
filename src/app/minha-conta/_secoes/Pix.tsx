"use client";

/**
 * Seção "Chave PIX" da tela /minha-conta (Minha Conta, 2026-05).
 *
 * Edita a chave PIX usada para receber prêmios. Tipo de chave é estado local
 * (não envia ao back — back só armazena a string). Aplica máscara progressiva
 * conforme o tipo: CPF `000.000.000-00`, Telefone `(00) 00000-0000`. E-mail
 * e aleatória ficam sem máscara.
 *
 * Botão "Copiar" usa `navigator.clipboard.writeText` (fallback silencioso se
 * indisponível).
 */
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Copy } from "lucide-react";
import { Callout, Campo, Card, Input, cx } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import type { Sessao } from "@/lib/auth";
import type { DraftPix } from "../page";
import { aplicarMascaraTelefone } from "./Perfil";

interface Props {
  sessao: Sessao;
  draft: DraftPix;
  onDraft: Dispatch<SetStateAction<DraftPix>>;
}

type TipoChave = "cpf" | "email" | "telefone" | "aleatoria";

const TIPOS: Array<{ id: TipoChave; label: string }> = [
  { id: "cpf", label: "CPF" },
  { id: "email", label: "E-mail" },
  { id: "telefone", label: "Telefone" },
  { id: "aleatoria", label: "Aleatória" },
];

/** Máscara progressiva de CPF: `000.000.000-00`. */
function aplicarMascaraCpf(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, "$1.$2");
  if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, "$1.$2.$3-$4");
}

function aplicarMascaraPorTipo(tipo: TipoChave, valor: string): string {
  if (tipo === "cpf") return aplicarMascaraCpf(valor);
  if (tipo === "telefone") return aplicarMascaraTelefone(valor);
  return valor;
}

function placeholderPorTipo(tipo: TipoChave): string {
  switch (tipo) {
    case "cpf":
      return "000.000.000-00";
    case "email":
      return "voce@email.com";
    case "telefone":
      return "(11) 98765-4321";
    case "aleatoria":
      return "chave aleatória";
  }
}

function inputModePorTipo(tipo: TipoChave): "numeric" | "email" | "text" {
  if (tipo === "cpf" || tipo === "telefone") return "numeric";
  if (tipo === "email") return "email";
  return "text";
}

function maxLenPorTipo(tipo: TipoChave): number | undefined {
  if (tipo === "cpf") return 14;
  if (tipo === "telefone") return 16;
  return undefined;
}

export function PixSecao({ sessao, draft, onDraft }: Props) {
  const [tipo, setTipo] = useState<TipoChave>("cpf");
  const { notificar } = useToast();

  const copiar = async () => {
    if (!sessao.chavePix) return;
    try {
      await navigator.clipboard.writeText(sessao.chavePix);
      notificar("Chave copiada", "pix");
    } catch {
      // sem clipboard — ignora silencioso
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-[16px] font-bold">Chave PIX atual</h2>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line2 bg-bg2 p-3">
          <span className="truncate text-[14px] font-semibold">
            {sessao.chavePix ?? "Ainda não cadastrada"}
          </span>
          {sessao.chavePix && (
            <button
              type="button"
              onClick={copiar}
              aria-label="Copiar chave"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line2 text-muted hover:text-green"
            >
              <Copy size={15} />
            </button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-[16px] font-bold">Atualizar chave PIX</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTipo(t.id);
                // re-aplica máscara do tipo novo (ex.: dígitos puros viram CPF formatado).
                onDraft((d) => ({
                  chavePix: aplicarMascaraPorTipo(t.id, d.chavePix),
                }));
              }}
              className={cx(
                "min-h-[36px] rounded-full border px-3.5 text-[12.5px] font-semibold",
                tipo === t.id
                  ? "border-green bg-green/10 text-green"
                  : "border-line2 bg-surface text-text hover:border-green/40",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Campo label="Chave">
          <Input
            value={draft.chavePix}
            onChange={(e) =>
              onDraft({ chavePix: aplicarMascaraPorTipo(tipo, e.target.value) })
            }
            placeholder={placeholderPorTipo(tipo)}
            inputMode={inputModePorTipo(tipo)}
            maxLength={maxLenPorTipo(tipo)}
          />
        </Campo>
      </Card>

      <Callout tom="neutral">
        <b>Como funciona o pagamento PIX:</b> os pagamentos só são processados
        quando a caixinha atinge o mínimo de pagantes. Os PIX são liberados em
        até 10 minutos após a apuração do resultado.
      </Callout>
    </div>
  );
}
