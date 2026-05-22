/**
 * Componentes base do design system Caixinha Bet (Story 7.1, Épico 7).
 *
 * Recriam a linguagem visual do design aprovado (docs/design/remixed-7b210df2.tsx)
 * de forma idiomática em React + Tailwind v4 — nenhuma linha do protótipo é
 * portada (AGENTS.md regra 4). Todos os alvos de toque têm ≥44px de altura
 * (NFR-3) e nada depende de hover.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/* -------------------------------------------------------------------- */
/* cx — concatena classes condicionais (substitui clsx, zero dep).        */
/* -------------------------------------------------------------------- */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ==================================================================== */
/* Botao                                                                 */
/* ==================================================================== */
type VarianteBotao = "primary" | "ghost" | "pix" | "mini";

const ESTILO_BOTAO: Record<VarianteBotao, string> = {
  // verde — ação principal
  primary:
    "bg-gradient-to-br from-green to-green-d text-[#04210f] shadow-[0_8px_22px_rgba(31,224,116,0.32)] hover:enabled:-translate-y-0.5",
  // contorno — ação secundária
  ghost: "bg-surface border border-line2 text-text hover:enabled:border-green hover:enabled:text-green",
  // dourado — pagar PIX
  pix: "bg-gradient-to-br from-gold to-[#e0a800] text-[#3a2a00]",
  // compacto — ações inline em listas (ainda ≥44px de alvo via min-h)
  mini: "bg-surface border border-line2 text-text text-[12.5px] hover:enabled:border-green hover:enabled:text-green",
};

interface BotaoBaseProps {
  variante?: VarianteBotao;
  /** Ocupa 100% da largura do container. */
  bloco?: boolean;
  /** Botão grande — usado em CTAs de destaque. */
  grande?: boolean;
}

type BotaoProps = BotaoBaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

function classesBotao({ variante = "primary", bloco, grande }: BotaoBaseProps): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-[transform,border-color,color]",
    "min-h-[44px] px-[18px] disabled:opacity-40 disabled:cursor-not-allowed",
    grande ? "text-[15px] px-[26px] min-h-[52px]" : "text-sm",
    bloco && "w-full",
    ESTILO_BOTAO[variante],
  );
}

/** Botão de ação. Mantém `type="button"` por padrão (evita submit acidental). */
export function Botao({ variante, bloco, grande, className, type, ...rest }: BotaoProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(classesBotao({ variante, bloco, grande }), className)}
      {...rest}
    />
  );
}

type BotaoLinkProps = BotaoBaseProps & {
  href: string;
  children: ReactNode;
  className?: string;
};

/** Mesma aparência do `Botao`, mas navega via `next/link`. */
export function BotaoLink({ variante, bloco, grande, href, className, children }: BotaoLinkProps) {
  return (
    <Link href={href} className={cx(classesBotao({ variante, bloco, grande }), className)}>
      {children}
    </Link>
  );
}

/* ==================================================================== */
/* VoltarLink — link de retorno discreto (seta + texto)                   */
/* ==================================================================== */
export function VoltarLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-muted hover:text-green min-h-[44px]"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

/* ==================================================================== */
/* Card / Painel                                                          */
/* ==================================================================== */
export function Card({
  children,
  className,
  /** Cor de acento aplicada na borda superior (slug de estado). */
  acento,
}: {
  children: ReactNode;
  className?: string;
  acento?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-[18px] border border-line bg-card p-5",
        acento && "border-t-[3px]",
        className,
      )}
      style={acento ? { borderTopColor: acento } : undefined}
    >
      {children}
    </div>
  );
}

/* ==================================================================== */
/* StatusPill — pill de estado da Caixinha                                */
/* ==================================================================== */
export function StatusPill({
  label,
  cor,
  glow,
}: {
  label: string;
  cor: string;
  glow: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
      style={{ background: glow, color: cor }}
    >
      <span
        className="h-[7px] w-[7px] rounded-full"
        style={{ background: cor, boxShadow: "0 0 8px currentColor" }}
        aria-hidden
      />
      {label}
    </span>
  );
}

/* ==================================================================== */
/* Pill — pill genérica (ex.: "COPA DO MUNDO 2026")                       */
/* ==================================================================== */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/15 px-3 py-1.5 text-[11.5px] font-bold tracking-wide text-gold">
      {children}
    </span>
  );
}

/* ==================================================================== */
/* Callout — bloco de aviso/informação                                   */
/* ==================================================================== */
export function Callout({
  children,
  /** "info" (verde) | "warn" (âmbar) | "neutral" (azul). */
  tom = "info",
  icone,
}: {
  children: ReactNode;
  tom?: "info" | "warn" | "neutral";
  icone?: ReactNode;
}) {
  const tons = {
    info: "bg-green/[0.07] border-green/20 [&_svg]:text-green",
    warn: "bg-amber/[0.08] border-amber/30 [&_svg]:text-amber",
    neutral: "bg-blue/[0.05] border-blue/20 [&_svg]:text-blue",
  } as const;
  return (
    <div
      className={cx(
        "flex gap-3 rounded-xl border p-4 text-[13px] leading-relaxed",
        tons[tom],
      )}
    >
      {icone && <span className="mt-0.5 shrink-0">{icone}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ==================================================================== */
/* Campo — label + input/conteúdo + hint                                  */
/* ==================================================================== */
export function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col">
      <span className="mb-2 text-[13px] font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 text-[11.5px] leading-snug text-muted">{hint}</span>}
    </label>
  );
}

/** Input estilizado do design — altura ≥44px (NFR-3). */
export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "min-h-[44px] w-full rounded-xl border border-line2 bg-bg2 px-3.5 text-sm text-text outline-none transition",
        "placeholder:text-[#4c5870] focus:border-green focus:ring-[3px] focus:ring-green/15",
        className,
      )}
      {...rest}
    />
  );
}

/* ==================================================================== */
/* Chip — tag de e-mail/convidado                                         */
/* ==================================================================== */
export function Chip({
  children,
  dono,
  onRemover,
}: {
  children: ReactNode;
  dono?: boolean;
  onRemover?: () => void;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px]",
        dono ? "border-gold/30 bg-gold/10 text-gold" : "border-line2 bg-surface",
      )}
    >
      {children}
      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover"
          className="text-muted hover:text-red"
        >
          ✕
        </button>
      )}
    </span>
  );
}
