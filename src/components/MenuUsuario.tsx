"use client";

/**
 * Dropdown do header: avatar + nome curto + menu (Minha Conta, 2026-05).
 *
 * Fecha em ESC e click-fora. Toques ≥44px (mobile-first). Itens "Meu perfil",
 * "Chave PIX", "Segurança", "Histórico" são deep-links na tela /minha-conta
 * via `?secao=...`. "Sair" chama `sair()` e redireciona para /entrar.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ChevronDown, LogOut, ShieldCheck, User, Zap } from "lucide-react";
import { Avatar } from "./Avatar";
import { sair, type Sessao } from "@/lib/auth";

export function MenuUsuario({ sessao }: { sessao: Sessao }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const nome = sessao.nomeCompleto ?? sessao.email;
  const primeiro = nome.split(" ")[0];

  const onSair = async () => {
    setOpen(false);
    await sair();
    router.push("/entrar");
  };

  const goto = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] items-center gap-2 rounded-full border border-line2 bg-surface px-3 py-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar fotoUrl={sessao.fotoUrl} nome={nome} tamanho="sm" />
        <span className="text-left">
          <span className="block text-[13px] font-semibold leading-none">{primeiro}</span>
          <span className="mt-0.5 block text-[11px] text-muted">Minha conta</span>
        </span>
        <ChevronDown size={15} className="text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[240px] rounded-2xl border border-line bg-card p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center gap-2.5 border-b border-line p-2.5 pb-3">
            <Avatar fotoUrl={sessao.fotoUrl} nome={nome} tamanho="md" />
            <div className="min-w-0">
              <b className="block text-[13.5px] font-bold leading-tight">{nome}</b>
              <span className="block truncate text-[11.5px] text-muted">{sessao.email}</span>
            </div>
          </div>
          <ItemMenu
            icone={<User size={16} />}
            label="Meu perfil"
            onClick={() => goto("/minha-conta?secao=perfil")}
          />
          <ItemMenu
            icone={<Zap size={16} />}
            label="Chave PIX"
            onClick={() => goto("/minha-conta?secao=pix")}
          />
          <ItemMenu
            icone={<ShieldCheck size={16} />}
            label="Segurança"
            onClick={() => goto("/minha-conta?secao=seguranca")}
          />
          <ItemMenu
            icone={<Activity size={16} />}
            label="Histórico"
            onClick={() => goto("/minha-conta?secao=historico")}
          />
          <div className="my-1 h-px bg-line" />
          <ItemMenu icone={<LogOut size={16} />} label="Sair" perigoso onClick={onSair} />
        </div>
      )}
    </div>
  );
}

function ItemMenu({
  icone,
  label,
  onClick,
  perigoso,
}: {
  icone: React.ReactNode;
  label: string;
  onClick: () => void;
  perigoso?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold hover:bg-surface ${
        perigoso ? "text-red" : "text-text"
      }`}
    >
      <span className={perigoso ? "text-red" : "text-muted"}>{icone}</span>
      {label}
    </button>
  );
}
