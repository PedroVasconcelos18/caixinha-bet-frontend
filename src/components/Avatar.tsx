"use client";

/**
 * Avatar circular: foto se houver, senão iniciais sobre gradiente verde.
 * (Minha Conta, 2026-05.)
 *
 * Mobile-first: tamanho default 40px (atende alvo de toque ≥44px quando o
 * pai aplica padding). Cross-origin com cookie via `crossOrigin="use-credentials"`
 * — o back já libera `Access-Control-Allow-Credentials: true` (SecurityConfig).
 */
import { cx } from "@/components/ui";

interface AvatarProps {
  fotoUrl: string | null;
  nome: string;
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}

const TAMANHO_CLASS = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-[78px] w-[78px] text-3xl",
} as const;

function iniciaisDe(nome: string): string {
  const partes = nome.split(" ").filter(Boolean).slice(0, 2);
  if (partes.length === 0) return "?";
  return partes.map((p) => p[0]).join("").toUpperCase();
}

export function Avatar({ fotoUrl, nome, tamanho = "md", className }: AvatarProps) {
  const tam = TAMANHO_CLASS[tamanho];
  if (fotoUrl) {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${base}${fotoUrl}`}
        alt={`Foto de ${nome}`}
        className={cx("rounded-full object-cover", tam, className)}
        crossOrigin="use-credentials"
      />
    );
  }
  return (
    <span
      className={cx(
        "grid place-items-center rounded-full bg-gradient-to-br from-green to-green-d font-display text-[#04210f]",
        tam,
        className,
      )}
    >
      {iniciaisDe(nome)}
    </span>
  );
}
