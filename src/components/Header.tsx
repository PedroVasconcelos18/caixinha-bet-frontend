"use client";

/**
 * Cabeçalho global Caixinha Bet (Story 7.2, Épico 7).
 *
 * Sticky no topo, com a marca "CAIXINHA BET" (clicar volta ao dashboard) e o
 * botão "Nova caixinha" — exibido apenas no dashboard, espelhando o design.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Plus } from "lucide-react";
import { BotaoLink } from "./ui";

export function Header() {
  const pathname = usePathname();
  // o CTA "Nova caixinha" só faz sentido no dashboard (design)
  const noDashboard = pathname === "/";

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

      {noDashboard && (
        <BotaoLink href="/caixinhas/nova" variante="primary">
          <Plus size={16} />
          <span className="hidden sm:inline">Nova caixinha</span>
          <span className="sm:hidden">Nova</span>
        </BotaoLink>
      )}
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
