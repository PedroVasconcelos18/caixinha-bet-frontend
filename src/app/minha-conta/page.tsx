"use client";

/**
 * /minha-conta — gerenciamento da conta do usuário (Minha Conta, 2026-05).
 *
 * Estrutura: sidebar com avatar + nav de seções (perfil / pix / segurança /
 * histórico / sair) + conteúdo da seção selecionada. Deep-link via
 * `?secao=...` (o `MenuUsuario` no header navega para cá com esse param).
 *
 * Estado: `sessao` é o snapshot servidor; `draft` é a cópia editável da
 * seção atual. O `SaveBar` aparece quando `draft != sessao`. Salvar chama
 * `atualizarPerfil` (ou `atualizarChavePix` na seção PIX) e atualiza
 * `sessao` com o retorno.
 *
 * Mobile-first 360×640 (NFR-3): sidebar em coluna no mobile (nav horizontal
 * no topo) e fixa lateral ≥880px.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Camera, LogOut, ShieldCheck, User, Zap } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Card, cx } from "@/components/ui";
import { SaveBar } from "@/components/SaveBar";
import { useToast } from "@/components/Toasts";
import { ApiError } from "@/lib/api";
import { atualizarChavePix, me, type Sessao } from "@/lib/auth";
import { atualizarPerfil, enviarFoto, removerFoto } from "@/lib/conta";
import { PerfilSecao } from "./_secoes/Perfil";
import { PixSecao } from "./_secoes/Pix";
import { SegurancaSecao } from "./_secoes/Seguranca";
import { HistoricoSecao } from "./_secoes/Historico";
import { SairSecao } from "./_secoes/Sair";

type Secao = "perfil" | "pix" | "seguranca" | "historico" | "sair";

const SECOES: Array<{ id: Secao; label: string; icone: React.ReactNode }> = [
  { id: "perfil", label: "Meu perfil", icone: <User size={16} /> },
  { id: "pix", label: "Chave PIX", icone: <Zap size={16} /> },
  { id: "seguranca", label: "Segurança", icone: <ShieldCheck size={16} /> },
  { id: "historico", label: "Histórico", icone: <Activity size={16} /> },
  { id: "sair", label: "Sair / Excluir", icone: <LogOut size={16} /> },
];

export interface DraftPerfil {
  nomeCompleto: string;
  dataNascimento: string;
  telefone: string;
  cidade: string;
  bio: string;
}

export interface DraftPix {
  chavePix: string;
}

export default function MinhaContaPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <p className="text-muted">Carregando…</p>
        </main>
      }
    >
      <MinhaContaConteudo />
    </Suspense>
  );
}

function MinhaContaConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const secaoUrl = (searchParams.get("secao") as Secao | null) ?? "perfil";
  const secao: Secao = SECOES.some((s) => s.id === secaoUrl) ? secaoUrl : "perfil";
  const { notificar } = useToast();

  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [draftPerfil, setDraftPerfil] = useState<DraftPerfil>({
    nomeCompleto: "",
    dataNascimento: "",
    telefone: "",
    cidade: "",
    bio: "",
  });
  const [draftPix, setDraftPix] = useState<DraftPix>({ chavePix: "" });

  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const s = await me();
      setSessao(s);
      setDraftPerfil({
        nomeCompleto: s.nomeCompleto ?? "",
        dataNascimento: s.dataNascimento ?? "",
        telefone: s.telefone ?? "",
        cidade: s.cidade ?? "",
        bio: s.bio ?? "",
      });
      setDraftPix({ chavePix: s.chavePix ?? "" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      if (cancelado) return;
      await carregar();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregar]);

  const trocarSecao = (s: Secao) => {
    router.replace(`/minha-conta?secao=${s}`);
  };

  const perfilSujo = useMemo(() => {
    if (!sessao) return false;
    return (
      draftPerfil.nomeCompleto !== (sessao.nomeCompleto ?? "") ||
      draftPerfil.dataNascimento !== (sessao.dataNascimento ?? "") ||
      draftPerfil.telefone !== (sessao.telefone ?? "") ||
      draftPerfil.cidade !== (sessao.cidade ?? "") ||
      draftPerfil.bio !== (sessao.bio ?? "")
    );
  }, [sessao, draftPerfil]);

  const pixSujo = useMemo(() => {
    if (!sessao) return false;
    return draftPix.chavePix !== (sessao.chavePix ?? "");
  }, [sessao, draftPix]);

  const saveBarVisivel =
    (secao === "perfil" && perfilSujo) || (secao === "pix" && pixSujo);

  const descartar = () => {
    if (!sessao) return;
    if (secao === "perfil") {
      setDraftPerfil({
        nomeCompleto: sessao.nomeCompleto ?? "",
        dataNascimento: sessao.dataNascimento ?? "",
        telefone: sessao.telefone ?? "",
        cidade: sessao.cidade ?? "",
        bio: sessao.bio ?? "",
      });
    } else if (secao === "pix") {
      setDraftPix({ chavePix: sessao.chavePix ?? "" });
    }
  };

  const salvar = async () => {
    if (!sessao) return;
    setSalvando(true);
    try {
      if (secao === "perfil") {
        const atualizado = await atualizarPerfil({
          nomeCompleto: draftPerfil.nomeCompleto.trim(),
          dataNascimento: draftPerfil.dataNascimento || null,
          telefone: draftPerfil.telefone,
          cidade: draftPerfil.cidade,
          bio: draftPerfil.bio,
        });
        setSessao(atualizado);
        notificar("Alterações salvas", "win");
      } else if (secao === "pix") {
        const atualizado = await atualizarChavePix(draftPix.chavePix.trim());
        setSessao(atualizado);
        notificar("Chave PIX atualizada", "pix");
      }
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Erro ao salvar";
      notificar(msg, "alert");
    } finally {
      setSalvando(false);
    }
  };

  const onTrocarFoto = async (arquivo: File) => {
    try {
      const atualizado = await enviarFoto(arquivo);
      setSessao(atualizado);
      notificar("Foto atualizada", "win");
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Erro ao enviar foto";
      notificar(msg, "alert");
    }
  };

  const onRemoverFoto = async () => {
    try {
      const atualizado = await removerFoto();
      setSessao(atualizado);
      notificar("Foto removida", "mail");
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.problem.detail ?? e.problem.title : "Erro";
      notificar(msg, "alert");
    }
  };

  if (carregando) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-muted">Carregando…</p>
      </main>
    );
  }
  if (!sessao || erro) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Card>
          <p className="text-red">{erro ?? "Não foi possível carregar sua conta."}</p>
        </Card>
      </main>
    );
  }

  const nome = sessao.nomeCompleto ?? sessao.email;

  return (
    <>
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[280px_1fr] md:py-8">
        <aside className="flex flex-col gap-4">
          <Card>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <Avatar fotoUrl={sessao.fotoUrl} nome={nome} tamanho="lg" />
                <BotaoFoto
                  onArquivo={onTrocarFoto}
                  podeRemover={sessao.fotoUrl !== null}
                  onRemover={onRemoverFoto}
                />
              </div>
              <div>
                <b className="block text-[15px]">{nome}</b>
                <span className="block text-[12px] text-muted">{sessao.email}</span>
              </div>
            </div>
          </Card>

          <nav className="md:block">
            <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-1.5">
              {SECOES.map((s) => (
                <li key={s.id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    onClick={() => trocarSecao(s.id)}
                    className={cx(
                      "flex min-h-[44px] w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-semibold whitespace-nowrap",
                      secao === s.id
                        ? "border border-green/30 bg-green/10 text-green"
                        : "border border-line2 bg-surface text-text hover:border-green/40",
                    )}
                  >
                    <span className="text-muted">{s.icone}</span>
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section>
          {secao === "perfil" && (
            <PerfilSecao
              sessao={sessao}
              draft={draftPerfil}
              onDraft={setDraftPerfil}
            />
          )}
          {secao === "pix" && (
            <PixSecao sessao={sessao} draft={draftPix} onDraft={setDraftPix} />
          )}
          {secao === "seguranca" && <SegurancaSecao sessao={sessao} />}
          {secao === "historico" && <HistoricoSecao />}
          {secao === "sair" && <SairSecao />}
        </section>
      </main>

      <SaveBar
        visivel={saveBarVisivel}
        salvando={salvando}
        onSalvar={salvar}
        onDescartar={descartar}
      />
    </>
  );
}

/**
 * Botão dourado de câmera sobre o avatar — abre file picker, valida no front
 * (mime + tamanho ≤ 2 MB), e chama `onArquivo`. Se já há foto, oferece
 * "Remover" via um menu simples.
 */
function BotaoFoto({
  onArquivo,
  podeRemover,
  onRemover,
}: {
  onArquivo: (f: File) => void;
  podeRemover: boolean;
  onRemover: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const abrirSeletor = () => {
    inputRef.current?.click();
  };

  const onChangeArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      alert("Arquivo excede 2 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      alert("Use JPG, PNG ou WebP.");
      return;
    }
    onArquivo(f);
  };

  return (
    <div className="absolute -bottom-1 -right-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onChangeArquivo}
      />
      <button
        type="button"
        onClick={() => (podeRemover ? setMenuOpen((o) => !o) : abrirSeletor())}
        aria-label="Trocar foto"
        className="grid h-9 w-9 place-items-center rounded-full bg-gold text-[#3a2a00] shadow-md hover:scale-105"
      >
        <Camera size={16} />
      </button>
      {podeRemover && menuOpen && (
        <div className="absolute right-0 top-10 z-20 min-w-[160px] rounded-xl border border-line bg-card p-1.5 shadow-xl">
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-surface"
            onClick={() => {
              setMenuOpen(false);
              abrirSeletor();
            }}
          >
            Trocar foto
          </button>
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-red hover:bg-surface"
            onClick={() => {
              setMenuOpen(false);
              onRemover();
            }}
          >
            Remover foto
          </button>
        </div>
      )}
    </div>
  );
}
