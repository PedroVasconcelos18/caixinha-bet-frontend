"use client";

/**
 * Cabeçalho global Caixinha Bet (Story 7.2, Épico 7 + Minha Conta 2026-05).
 *
 * Sticky no topo, com a marca "CAIXINHA BET" (clicar volta ao dashboard),
 * o botão "Nova caixinha" (só no dashboard) e o dropdown do usuário logado.
 *
 * O dropdown lê o usuário com `useEffect + me()` na própria árvore —
 * sem provider novo. Falha silenciosa mostra só o logo (rota pública).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Plus } from "lucide-react";
import { BotaoLink } from "./ui";
import { MenuUsuario } from "./MenuUsuario";
import { me, type Sessao } from "@/lib/auth";

export function Header() {
  const pathname = usePathname();
  const noDashboard = pathname === "/";

  const ePublica =
    pathname === "/entrar" ||
    pathname.startsWith("/verificar-email") ||
    pathname.startsWith("/redefinir-senha");

  const [sessao, setSessao] = useState<Sessao | null>(null);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (ePublica) {
        if (!cancelado) setSessao(null);
        return;
      }
      try {
        const s = await me();
        if (!cancelado) setSessao(s);
      } catch {
        if (!cancelado) setSessao(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ePublica, pathname]);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-line bg-bg/80 px-4 py-3.5 backdrop-blur-md sm:px-6">
      <Link href="/" className="flex items-center gap-3" aria-label="Caixinha Bet — início">
        <span className="grid h-[42px] w-[42px] place-items-center rounded-xl bg-gradient-to-br from-green to-green-d text-[#04210f] shadow-[0_8px_24px_rgba(31,224,116,0.4)]">
          <Trophy size={20} />
        </span>
        <span className="leading-none">
          <span className="block font-display text-[22px] tracking-wide">
            CAIXINHA<span className="text-green">BET</span>
          </span>
          <span className="mt-0.5 block text-[11px] tracking-wide text-muted">
            Bolões da Copa entre amigos
          </span>
        </span>
      </Link>

      <div className="flex items-center gap-3">
        {noDashboard && (
          <BotaoLink href="/caixinhas/nova" variante="primary">
            <Plus size={16} />
            <span className="hidden sm:inline">Nova caixinha</span>
            <span className="sm:hidden">Nova</span>
          </BotaoLink>
        )}
        {sessao && <MenuUsuario sessao={sessao} />}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 border-t border-line px-6 py-6 text-center text-[11.5px] text-muted">
      ⚽ Caixinha Bet — Aposte com responsabilidade · +18
    </footer>
  );
}
