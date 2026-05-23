"use client";

/**
 * Barra sticky de "alterações não salvas" (Minha Conta, 2026-05).
 *
 * Aparece quando o usuário modifica o draft do perfil/PIX e some quando
 * salva ou descarta. Mobile-first: ocupa toda a largura, alvos ≥44px.
 */
import { Botao } from "./ui";

interface SaveBarProps {
  visivel: boolean;
  salvando: boolean;
  onSalvar: () => void;
  onDescartar: () => void;
}

export function SaveBar({ visivel, salvando, onSalvar, onDescartar }: SaveBarProps) {
  if (!visivel) return null;
  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 border-t border-line bg-card/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <span className="text-[13px] text-text">
          Você tem alterações não salvas
        </span>
        <div className="flex gap-2">
          <Botao type="button" variante="ghost" onClick={onDescartar} disabled={salvando}>
            Descartar
          </Botao>
          <Botao type="button" variante="primary" onClick={onSalvar} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </div>
    </div>
  );
}
