"use client";

/**
 * Seção "Meu perfil" da tela /minha-conta (Minha Conta, 2026-05).
 *
 * Edita nome, data de nascimento, telefone (com máscara), cidade e bio.
 * E-mail e CPF permanecem locked — alterar e-mail exigiria re-verificação;
 * CPF é fixo (sincroniza com Asaas).
 */
import type { Dispatch, SetStateAction } from "react";
import { Card, Campo, Input } from "@/components/ui";
import type { Sessao } from "@/lib/auth";
import type { DraftPerfil } from "../page";

interface Props {
  sessao: Sessao;
  draft: DraftPerfil;
  onDraft: Dispatch<SetStateAction<DraftPerfil>>;
}

function mascararCpf(cpf: string | null): string {
  if (!cpf || cpf.length < 11) return "—";
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.•••-••`;
}

/** Máscara progressiva: `(00) 00000-0000` para 11 dígitos, `(00) 0000-0000` para 10. */
export function aplicarMascaraTelefone(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function PerfilSecao({ sessao, draft, onDraft }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-4 text-[16px] font-bold">Informações do perfil</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome">
            <Input
              value={draft.nomeCompleto}
              onChange={(e) =>
                onDraft((d) => ({ ...d, nomeCompleto: e.target.value }))
              }
              placeholder="Como te chamam?"
              maxLength={160}
            />
          </Campo>
          <Campo label="E-mail" hint={sessao.emailVerificado ? "Verificado" : "Pendente"}>
            <Input value={sessao.email} disabled />
          </Campo>
          <Campo label="CPF" hint="Imutável.">
            <Input value={mascararCpf(sessao.cpf)} disabled />
          </Campo>
          <Campo label="Data de nascimento" hint="Pessoas com 18+ podem apostar.">
            <Input
              type="date"
              value={draft.dataNascimento}
              onChange={(e) =>
                onDraft((d) => ({ ...d, dataNascimento: e.target.value }))
              }
            />
          </Campo>
          <Campo label="Telefone">
            <Input
              value={draft.telefone}
              onChange={(e) =>
                onDraft((d) => ({
                  ...d,
                  telefone: aplicarMascaraTelefone(e.target.value),
                }))
              }
              placeholder="(11) 98765-4321"
              inputMode="numeric"
              maxLength={16}
            />
          </Campo>
          <Campo label="Cidade">
            <Input
              value={draft.cidade}
              onChange={(e) => onDraft((d) => ({ ...d, cidade: e.target.value }))}
              placeholder="São Paulo"
              maxLength={120}
            />
          </Campo>
        </div>

        <div className="mt-4">
          <Campo label="Bio" hint={`${draft.bio.length}/140`}>
            <textarea
              value={draft.bio}
              onChange={(e) => onDraft((d) => ({ ...d, bio: e.target.value.slice(0, 140) }))}
              placeholder="Fala um pouco sobre você…"
              rows={3}
              maxLength={140}
              className="w-full rounded-xl border border-line2 bg-bg2 px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-[#4c5870] focus:border-green focus:ring-[3px] focus:ring-green/15"
            />
          </Campo>
        </div>
      </Card>
    </div>
  );
}
