"use client";

import { useState } from "react";
import {
  Mail,
  Lock,
  User,
  IdCard,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Users,
  ShieldCheck,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { registrar, login, recuperarSenha } from "@/lib/auth";

/**
 * Tela de entrada (auth por senha, 2026-05 — substitui o magic link).
 *
 * Layout de dois painéis fiel a docs/design/Login.html: à esquerda o painel
 * de marca (hero da Copa, card de jogo, bullets); à direita o card de auth
 * com três modos — login, cadastro e "esqueci a senha". O painel de marca
 * some em telas estreitas (≤880px) — mobile-first (NFR-3).
 *
 * O logo "CAIXINHABET" e o rodapé "+18" já vêm do Header/Footer globais
 * (layout.tsx) — não são repetidos aqui. Login social (Google) fica fora
 * de escopo: não há botão de Google. Recriado com Tailwind/tokens do
 * projeto, sem portar código do protótipo (AGENTS.md regra 4).
 */
type Modo = "login" | "cadastro" | "recuperar";

/* ---------- validação (espelha o backend) ---------- */

/** Validação de CPF (dígitos verificadores) — espelha o backend `Cpf`. */
function cpfValido(bruto: string): boolean {
  const d = bruto.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digito = (qtd: number, peso: number) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(d[i]) * (peso - i);
    const resto = 11 - (soma % 11);
    return resto > 9 ? 0 : resto;
  };
  return digito(9, 10) === Number(d[9]) && digito(10, 11) === Number(d[10]);
}

/** Máscara progressiva de CPF: 000.000.000-00. */
function formatarCpf(bruto: string): string {
  const d = bruto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.replace(/(\d{3})(\d+)/, "$1.$2");
  if (d.length <= 9) return d.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, "$1.$2.$3-$4");
}

/**
 * Pontua a força da senha de 0 a 4 — espelha `scorePwd` do Login.html.
 * O backend (`Senha`) exige o mínimo "razoável": ≥8 chars com letra e
 * número (equivale a score ≥ 2).
 */
function forcaSenha(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return Math.min(s, 4);
}

const ROTULO_FORCA = ["", "Fraca", "Razoável", "Boa", "Forte"];

function redirectTo(): string {
  if (typeof window === "undefined") return "/";
  return new URLSearchParams(window.location.search).get("redirectTo") ?? "/";
}

/* ==================================================================== */
/* Campos com ícone — recriam o `input-wrap` do Login.html.               */
/* O Input de @/components/ui não suporta adorno; estes ficam locais à    */
/* tela de login para não alterar o componente compartilhado.             */
/* ==================================================================== */

/** Wrapper de input com ícone à esquerda e foco verde. */
function CampoIcone({
  id,
  label,
  acaoLabel,
  erro,
  icone,
  children,
}: {
  id: string;
  label: string;
  /** elemento opcional alinhado à direita do label (ex.: "Esqueceu a senha?") */
  acaoLabel?: React.ReactNode;
  erro?: string;
  icone: React.ReactNode;
  /** o <input> (ou input + botão de toggle) */
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3.5 flex flex-col">
      <label
        htmlFor={id}
        className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold"
      >
        <span>{label}</span>
        {acaoLabel}
      </label>
      <div
        className={
          "flex items-center rounded-xl border bg-bg2 transition focus-within:ring-[3px] " +
          (erro
            ? "border-red focus-within:border-red focus-within:ring-red/15"
            : "border-line2 focus-within:border-green focus-within:ring-green/15")
        }
      >
        <span className="flex pl-3.5 pr-3 text-muted">{icone}</span>
        {children}
      </div>
      {erro && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red">
          <AlertCircle size={13} />
          <span role="alert">{erro}</span>
        </div>
      )}
    </div>
  );
}

/** Input cru estilizado para viver dentro do CampoIcone. */
function InputCru(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="min-h-[44px] w-full min-w-0 flex-1 bg-transparent py-3 pr-3.5 text-sm text-text outline-none placeholder:text-[#4c5870]"
    />
  );
}

/** Botão de mostrar/ocultar senha — adorno à direita do input. */
function ToggleSenha({
  mostrando,
  onClick,
}: {
  mostrando: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={mostrando ? "Ocultar senha" : "Mostrar senha"}
      className="flex min-h-[44px] items-center px-3.5 text-muted hover:text-text"
    >
      {mostrando ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

/** Bloco de erro de autenticação (credenciais, conflito) acima do botão. */
function ErroAuth({ mensagem }: { mensagem: string }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 rounded-xl border border-red/25 bg-red/[0.08] px-3 py-2.5 text-xs text-red">
      <AlertCircle size={14} />
      <span role="alert">{mensagem}</span>
    </div>
  );
}

/** Botão primário em gradiente verde — espelha `.btn-primary`. */
function BotaoPrimario({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-br from-green to-green-d px-6 font-bold text-[14.5px] text-[#04210f] shadow-[0_8px_22px_rgba(31,224,116,0.32)] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

/** Spinner do estado "enviando" — espelha `.spinner`. */
function Spinner() {
  return (
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04210f]/30 border-t-[#04210f]" />
  );
}

/* ==================================================================== */
/* Página                                                                */
/* ==================================================================== */
export default function EntrarPage() {
  const [modo, setModo] = useState<Modo>("login");

  return (
    <main className="cx-fade grid min-h-[calc(100vh-180px)] grid-cols-1 content-center items-center gap-8 md:grid-cols-[1.05fr_1fr] md:gap-10">
      <PainelMarca />

      <section className="flex items-center justify-center">
        <div className="w-full max-w-[430px]">
          {modo === "recuperar" ? (
            <Recuperar onVoltar={() => setModo("login")} />
          ) : (
            <>
              {/* Tabs Entrar / Criar conta */}
              <div
                role="tablist"
                className="mb-6 flex gap-1 rounded-[13px] border border-line bg-surface p-1.5"
              >
                <BotaoTab
                  ativo={modo === "login"}
                  onClick={() => setModo("login")}
                >
                  Entrar
                </BotaoTab>
                <BotaoTab
                  ativo={modo === "cadastro"}
                  onClick={() => setModo("cadastro")}
                >
                  Criar conta
                </BotaoTab>
              </div>

              {modo === "login" ? (
                <Login
                  onEsqueci={() => setModo("recuperar")}
                  onTrocar={() => setModo("cadastro")}
                />
              ) : (
                <Cadastro onTrocar={() => setModo("login")} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

/** Aba do seletor login/cadastro. */
function BotaoTab({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={
        "min-h-[44px] flex-1 rounded-[9px] text-[13px] font-bold transition " +
        (ativo
          ? "bg-bg2 text-text shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
          : "text-muted hover:text-text")
      }
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- */
/* Painel de marca (esquerda) — some em telas estreitas                   */
/* -------------------------------------------------------------------- */
function PainelMarca() {
  return (
    <aside className="relative hidden flex-col justify-center overflow-hidden rounded-[20px] border border-line bg-gradient-to-br from-[#0e1a2e] to-[#0a1322] p-9 md:flex">
      {/* glows decorativos */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-28 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(31,224,116,0.28),transparent_65%)] blur-2xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(245,197,24,0.16),transparent_65%)] blur-2xl"
      />

      <div className="relative z-[1]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/15 px-3 py-1.5 text-[11.5px] font-bold tracking-wide text-gold">
          <Sparkles size={13} /> COPA DO MUNDO 2026
        </span>

        <h1 className="mt-4 font-display text-[44px] leading-[1.05] tracking-wide">
          Cravou o placar?
          <br />
          <span className="text-green">Leva o bolo.</span>
        </h1>
        <p className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-muted">
          Crie caixinhas com os amigos, palpite jogo a jogo e divida o prêmio
          com quem acertar — tudo no PIX, sem dor de cabeça.
        </p>

        {/* bullets de features */}
        <ul className="mt-7 flex flex-col gap-2.5">
          <BulletMarca icone={<Zap size={13} />}>
            <b className="font-bold text-green">Pagamento por PIX</b> — só
            libera quando o mínimo de aceites é atingido.
          </BulletMarca>
          <BulletMarca icone={<Users size={13} />}>
            <b className="font-bold text-green">Convide a galera</b> por e-mail
            e acompanhe quem já entrou.
          </BulletMarca>
          <BulletMarca icone={<ShieldCheck size={13} />}>
            <b className="font-bold text-green">Sem mínimo, devolve.</b> Se não
            bater o número de pagantes, todo mundo recebe de volta.
          </BulletMarca>
        </ul>
      </div>
    </aside>
  );
}

function BulletMarca({
  icone,
  children,
}: {
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-[13.5px] leading-snug text-text">
      <span className="mt-px grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md bg-green/[0.14] text-green">
        {icone}
      </span>
      <span>{children}</span>
    </li>
  );
}

/* -------------------------------------------------------------------- */
/* Login                                                                 */
/* -------------------------------------------------------------------- */
function Login({
  onEsqueci,
  onTrocar,
}: {
  onEsqueci: () => void;
  onTrocar: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [conectado, setConectado] = useState(true);
  const [estado, setEstado] = useState<"idle" | "enviando" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  const podeEnviar = email.includes("@") && senha.length > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEstado("enviando");
    setErro(null);
    try {
      await login(email.trim(), senha);
      window.location.assign(redirectTo());
    } catch (e) {
      setEstado("erro");
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Algo deu errado. Tente de novo.",
      );
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="mb-6">
        <h2 className="font-display text-[34px] leading-[1.05] tracking-wide">
          Bem-vindo de volta.
        </h2>
        <p className="mt-2 text-sm text-muted">
          Entre para acessar suas caixinhas, palpites e prêmios. Novo por aqui?{" "}
          <button
            type="button"
            onClick={onTrocar}
            className="font-bold text-green hover:underline"
          >
            Criar conta
          </button>
          .
        </p>
      </div>

      <CampoIcone id="li-email" label="E-mail" icone={<Mail size={17} />}>
        <InputCru
          id="li-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </CampoIcone>

      <CampoIcone
        id="li-senha"
        label="Senha"
        icone={<Lock size={17} />}
        acaoLabel={
          <button
            type="button"
            onClick={onEsqueci}
            className="text-xs font-bold text-green hover:underline"
          >
            Esqueceu sua senha?
          </button>
        }
      >
        <InputCru
          id="li-senha"
          type={verSenha ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Sua senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <ToggleSenha
          mostrando={verSenha}
          onClick={() => setVerSenha((v) => !v)}
        />
      </CampoIcone>

      <Checkbox
        marcado={conectado}
        onChange={setConectado}
        className="mb-[18px] mt-1"
      >
        Manter conectado neste dispositivo
      </Checkbox>

      {erro && <ErroAuth mensagem={erro} />}

      <BotaoPrimario type="submit" disabled={!podeEnviar || estado === "enviando"}>
        {estado === "enviando" ? (
          <>
            <Spinner /> Entrando…
          </>
        ) : (
          <>
            Entrar <ArrowRight size={16} />
          </>
        )}
      </BotaoPrimario>

      <p className="mt-[22px] text-center text-[12.5px] text-muted">
        Ainda não tem conta?{" "}
        <button
          type="button"
          onClick={onTrocar}
          className="font-bold text-green hover:underline"
        >
          Criar caixinha agora
        </button>
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------- */
/* Cadastro                                                              */
/* -------------------------------------------------------------------- */
function Cadastro({ onTrocar }: { onTrocar: () => void }) {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [tocado, setTocado] = useState<Record<string, boolean>>({});
  const [estado, setEstado] = useState<"idle" | "enviando" | "erro">("idle");
  const [erro, setErro] = useState<string | null>(null);

  const nomeOk = nome.trim().length >= 2;
  const cpfOk = cpfValido(cpf);
  const emailOk = email.includes("@");
  const score = forcaSenha(senha);
  // Força mínima espelha o backend (Senha): score ≥ 2.
  const senhaOk = senha.length >= 8 && /[a-zA-Z]/.test(senha) && /\d/.test(senha);
  const podeEnviar = nomeOk && cpfOk && emailOk && senhaOk && aceito;

  const erroNome = tocado.nome && !nomeOk ? "Informe seu nome." : undefined;
  const erroCpf = tocado.cpf && !cpfOk ? "Informe um CPF válido." : undefined;
  const erroEmail =
    tocado.email && !emailOk ? "Informe um e-mail válido." : undefined;
  const erroSenha =
    tocado.senha && !senhaOk
      ? "Use 8+ caracteres com letras e números."
      : undefined;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTocado({ nome: true, cpf: true, email: true, senha: true });
    if (!podeEnviar) return;
    setEstado("enviando");
    setErro(null);
    try {
      await registrar({
        nomeCompleto: nome.trim(),
        cpf: cpf.replace(/\D/g, ""),
        email: email.trim(),
        senha,
      });
      window.location.assign(redirectTo());
    } catch (e) {
      setEstado("erro");
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Algo deu errado. Tente de novo.",
      );
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <div className="mb-6">
        <h2 className="font-display text-[34px] leading-[1.05] tracking-wide">
          Crie sua conta.
        </h2>
        <p className="mt-2 text-sm text-muted">
          Em 30 segundos você já está convidando a galera para a primeira
          caixinha. Já tem conta?{" "}
          <button
            type="button"
            onClick={onTrocar}
            className="font-bold text-green hover:underline"
          >
            Entrar
          </button>
          .
        </p>
      </div>

      <CampoIcone
        id="ca-nome"
        label="Nome completo"
        icone={<User size={17} />}
        erro={erroNome}
      >
        <InputCru
          id="ca-nome"
          type="text"
          autoComplete="name"
          placeholder="Como te chamam?"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => setTocado((t) => ({ ...t, nome: true }))}
        />
      </CampoIcone>

      <CampoIcone
        id="ca-cpf"
        label="CPF"
        icone={<IdCard size={17} />}
        erro={erroCpf}
      >
        <InputCru
          id="ca-cpf"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={14}
          value={cpf}
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
          onBlur={() => setTocado((t) => ({ ...t, cpf: true }))}
        />
      </CampoIcone>

      <CampoIcone
        id="ca-email"
        label="E-mail"
        icone={<Mail size={17} />}
        erro={erroEmail}
      >
        <InputCru
          id="ca-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTocado((t) => ({ ...t, email: true }))}
        />
      </CampoIcone>

      <CampoIcone
        id="ca-senha"
        label="Senha"
        icone={<Lock size={17} />}
        erro={erroSenha}
      >
        <InputCru
          id="ca-senha"
          type={verSenha ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Crie uma senha forte"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onBlur={() => setTocado((t) => ({ ...t, senha: true }))}
        />
        <ToggleSenha
          mostrando={verSenha}
          onClick={() => setVerSenha((v) => !v)}
        />
      </CampoIcone>

      {senha && <MedidorForca score={score} />}

      <Checkbox
        marcado={aceito}
        onChange={setAceito}
        className="mb-[18px] mt-1"
      >
        Li e aceito os{" "}
        <span className="font-semibold text-text">Termos de uso</span> e a{" "}
        <span className="font-semibold text-text">Política de privacidade</span>
        . Confirmo que tenho 18 anos ou mais.
      </Checkbox>

      {erro && <ErroAuth mensagem={erro} />}

      <BotaoPrimario type="submit" disabled={!podeEnviar || estado === "enviando"}>
        {estado === "enviando" ? (
          <>
            <Spinner /> Criando conta…
          </>
        ) : (
          <>
            Criar conta <ArrowRight size={16} />
          </>
        )}
      </BotaoPrimario>

      <p className="mt-[22px] text-center text-[12.5px] text-muted">
        Ao criar a conta, você poderá criar caixinhas e participar de bolões com
        seus amigos.
      </p>
    </form>
  );
}

/** Medidor de força da senha — 4 barras + rótulo, espelha `.strength`. */
function MedidorForca({ score }: { score: number }) {
  const cor = ["", "bg-red", "bg-amber", "bg-gold", "bg-green"][score];
  return (
    <div className="-mt-1 mb-3.5">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={
              "h-1 flex-1 rounded-full transition " +
              (i < score ? cor : "bg-line2")
            }
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted">
        <span>Força da senha</span>
        <span className="font-semibold text-text">
          {ROTULO_FORCA[score] || "—"}
        </span>
      </div>
    </div>
  );
}

/** Checkbox custom — espelha `.check` do Login.html. */
function Checkbox({
  marcado,
  onChange,
  className,
  children,
}: {
  marcado: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-muted " +
        (className ?? "")
      }
    >
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={
          "mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition peer-focus-visible:ring-[3px] peer-focus-visible:ring-green/20 " +
          (marcado
            ? "border-green bg-green text-[#04210f]"
            : "border-line2 bg-bg2")
        }
      >
        {marcado && <CheckCircle2 size={12} strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </label>
  );
}

/* -------------------------------------------------------------------- */
/* Recuperar senha                                                       */
/* -------------------------------------------------------------------- */
function Recuperar({ onVoltar }: { onVoltar: () => void }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<
    "idle" | "enviando" | "enviado" | "erro"
  >("idle");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setEstado("enviando");
    setErro(null);
    try {
      await recuperarSenha(email.trim());
      setEstado("enviado");
    } catch (e) {
      setEstado("erro");
      setErro(
        e instanceof ApiError
          ? (e.problem.detail ?? e.problem.title)
          : "Algo deu errado. Tente de novo.",
      );
    }
  }

  if (estado === "enviado") {
    return (
      <div className="rounded-[18px] border border-line bg-card p-7 text-center">
        <span className="mx-auto mb-[18px] grid h-16 w-16 place-items-center rounded-[18px] bg-green/[0.14] text-green shadow-[0_0_0_6px_rgba(31,224,116,0.06)]">
          <Mail size={28} />
        </span>
        <h3 className="font-display text-2xl tracking-wide">
          Confira seu e-mail
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Se este e-mail tiver uma conta, enviamos um link de recuperação para{" "}
          <span className="font-bold text-text">{email}</span>.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          O link expira em 15 minutos. Se não chegar, confira a pasta de spam.
        </p>
        <div className="mt-[22px] flex gap-2.5">
          <button
            type="button"
            onClick={() => setEstado("idle")}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-line2 bg-surface px-4 text-sm font-bold text-text transition hover:border-green hover:text-green"
          >
            Reenviar
          </button>
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-green to-green-d px-4 text-sm font-bold text-[#04210f]"
          >
            Voltar para entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate>
      <button
        type="button"
        onClick={onVoltar}
        className="mb-[18px] inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-green"
      >
        <ArrowRight size={14} className="rotate-180" /> Voltar para login
      </button>

      <div className="mb-6">
        <h2 className="font-display text-[34px] leading-[1.05] tracking-wide">
          Esqueceu sua senha?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Sem stress — informe o e-mail da sua conta e a gente envia um link
          seguro para você criar uma nova senha.
        </p>
      </div>

      <CampoIcone
        id="rc-email"
        label="E-mail da conta"
        icone={<Mail size={17} />}
      >
        <InputCru
          id="rc-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      </CampoIcone>

      {erro && <ErroAuth mensagem={erro} />}

      <BotaoPrimario
        type="submit"
        disabled={!email.includes("@") || estado === "enviando"}
      >
        {estado === "enviando" ? (
          <>
            <Spinner /> Enviando…
          </>
        ) : (
          <>
            Enviar link de recuperação <ArrowRight size={16} />
          </>
        )}
      </BotaoPrimario>

      <p className="mt-[22px] text-center text-[12.5px] text-muted">
        Lembrou da senha?{" "}
        <button
          type="button"
          onClick={onVoltar}
          className="font-bold text-green hover:underline"
        >
          Voltar para login
        </button>
      </p>
    </form>
  );
}
