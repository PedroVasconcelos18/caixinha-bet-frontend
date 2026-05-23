"use client";

/**
 * Sistema de toasts global (Story 7.2, Épico 7).
 *
 * Notificações efêmeras no canto da tela, no estilo do design aprovado.
 * Diferente do protótipo (que tinha uma fila simulada de eventos fake), aqui
 * os toasts são disparados por EVENTOS REAIS: sucesso/erro de chamadas à API
 * e transições de estado retornadas pelo backend. As páginas chamam
 * `useToast()` e disparam quando algo de fato acontece.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Mail, Zap, Trophy, AlertTriangle, Bell } from "lucide-react";

/** Tipo do toast — define ícone e cor de acento. */
export type ToastTipo = "mail" | "pix" | "win" | "alert";

interface Toast {
  id: string;
  msg: string;
  tipo: ToastTipo;
}

interface ToastContextValue {
  /** Dispara um toast. `tipo` default "mail". */
  notificar: (msg: string, tipo?: ToastTipo) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Tempo em tela antes do auto-dismiss (ms) — espelha o design (~4,2 s). */
const DURACAO_MS = 4200;

let contador = 0;
const novoId = () => `t${++contador}`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // guarda os timers por id para limpar no unmount/dismiss manual
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dispensar = useCallback((id: string) => {
    setToasts((atuais) => atuais.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notificar = useCallback(
    (msg: string, tipo: ToastTipo = "mail") => {
      const id = novoId();
      setToasts((atuais) => [...atuais, { id, msg, tipo }]);
      const timer = setTimeout(() => dispensar(id), DURACAO_MS);
      timers.current.set(id, timer);
    },
    [dispensar],
  );

  // limpa timers pendentes se o provider desmontar
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ notificar }), [notificar]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDispensar={dispensar} />
    </ToastContext.Provider>
  );
}

/** Hook para disparar toasts a partir de qualquer client component. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  }
  return ctx;
}

/* ----------------------------------------------------------------------- */
/* Viewport — pilha visual de toasts no canto superior direito.            */
/* ----------------------------------------------------------------------- */

const ICONE: Record<ToastTipo, ReactNode> = {
  mail: <Mail size={16} className="text-blue" />,
  pix: <Zap size={16} className="text-gold" />,
  win: <Trophy size={16} className="text-green" />,
  alert: <AlertTriangle size={16} className="text-amber" />,
};

const ACENTO: Record<ToastTipo, string> = {
  mail: "border-line2",
  pix: "border-gold/40",
  win: "border-green/40",
  alert: "border-amber/40",
};

function ToastViewport({
  toasts,
  onDispensar,
}: {
  toasts: Toast[];
  onDispensar: (id: string) => void;
}) {
  return (
    // inset garante que em 360px o toast nunca vaze a tela (NFR-3).
    // `!fixed` força o position:fixed contra a regra de `body > *` em
    // globals.css (que tem especificidade maior e o jogaria para relative).
    <div
      className="pointer-events-none !fixed inset-x-3 top-[76px] z-[90] flex flex-col gap-2.5 sm:left-auto sm:right-5 sm:w-[360px]"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`cx-fade pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface p-3.5 text-[13px] leading-snug shadow-[0_14px_36px_rgba(0,0,0,0.5)] ${ACENTO[t.tipo]}`}
        >
          <span className="mt-px shrink-0">{ICONE[t.tipo] ?? <Bell size={16} />}</span>
          <span className="min-w-0 flex-1">{t.msg}</span>
          <button
            type="button"
            onClick={() => onDispensar(t.id)}
            aria-label="Fechar notificação"
            className="-m-1 shrink-0 p-1 text-muted hover:text-text"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
