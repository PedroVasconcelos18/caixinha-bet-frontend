"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Plus,
  X,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Trophy,
  Mail,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import { criarCaixinha, sugerirResultados } from "@/lib/caixinha";
import { Decimal, moneyFromApi, moneyToApi, formatBRL } from "@/lib/money";
import { bandeiraDe, formatarDataHora } from "@/lib/ui";
import { useToast } from "@/components/Toasts";
import { Botao, Card, Callout, Campo, Input, Chip, VoltarLink, cx } from "@/components/ui";

/**
 * Wizard de criação de Caixinha (Story 2.2 / FR-1, FR-3 — redesenhado na
 * Story 7.4 do Épico 7 para o design aprovado: stepper de 6 passos,
 * card-painel e callouts.
 *
 * A LÓGICA é preservada da implementação anterior (validação inline,
 * aritmética via Decimal/NFR-1, `criarCaixinha`, `SugerirBotao`). Só a
 * apresentação muda. Submit no final = único POST /caixinhas atômico.
 *
 * Mobile-first 360×640: inputs ≥44px, stepper que encolhe sem scroll
 * horizontal (NFR-3).
 */
type Etapa = 1 | 2 | 3 | 4 | 5 | 6;

interface Dados {
  titulo: string;
  ladoA: string;
  ladoB: string;
  valorIngresso: string;
  minimoParticipantes: string;
  /** v5 FR-1: "1" | "2" | "3" (string para casar com inputs). */
  numeroGanhadores: string;
  prazoEntrada: string; // "YYYY-MM-DDTHH:mm" (date + time, sem timezone)
  dataApuracao: string;
  rotulosResultados: string[];
  /** Lista de e-mails (gerenciada como chips, não textarea). */
  emailsConvidados: string[];
}

const VAZIO: Dados = {
  titulo: "",
  ladoA: "",
  ladoB: "",
  valorIngresso: "",
  minimoParticipantes: "",
  numeroGanhadores: "1",
  prazoEntrada: "",
  dataApuracao: "",
  rotulosResultados: ["", ""],
  emailsConvidados: [],
};

const TAXA_SERVICO = "10.00";
const INGRESSO_MIN = "5.00";
const PASSOS = ["Confronto", "Resultados", "Financeiro", "Prazos", "Convidados", "Revisão"];
const RE_EMAIL = /\S+@\S+\.\S+/;

/* Mapa de nomes de campos do contrato (camelCase) → rótulo humano em pt-BR.
   Usado para humanizar as violações 422 vindas do back, que chegam como
   strings cruas no formato "campoCamelCase: mensagem". */
const ROTULOS_CAMPO: Record<string, string> = {
  titulo: "Título",
  ladoA: "Time mandante",
  ladoB: "Time visitante",
  valorIngresso: "Valor de ingresso",
  minimoParticipantes: "Mínimo de participantes",
  numeroGanhadores: "Nº de ganhadores",
  prazoEntrada: "Prazo de entrada",
  dataApuracao: "Data de apuração",
  rotulosResultados: "Resultados possíveis",
  resultadosPossiveis: "Resultados possíveis",
  emailsConvidados: "Convidados",
};

/** Humaniza uma violação 422 do back ("campoCamelCase: msg" → "Campo: Msg"). */
function humanizarViolacao(raw: string): string {
  const sep = raw.indexOf(":");
  if (sep === -1) return raw;
  const campo = raw.slice(0, sep).trim();
  const msg = raw.slice(sep + 1).trim();
  const rotulo = ROTULOS_CAMPO[campo] ?? campo;
  const msgFinal = msg.charAt(0).toUpperCase() + msg.slice(1);
  return `${rotulo}: ${msgFinal}`;
}

/* ----------------------------------------------------------------------- */
/* Prazos — datas como `date` + `time` separados.                          */
/*                                                                          */
/* `<input type="datetime-local">` renderiza a máscara conforme o locale do */
/* navegador (mm/dd/aaaa + AM/PM em en-US). Não há atributo que force o     */
/* padrão BR. Por isso usamos `date` + `time` separados: o `time` é sempre  */
/* 24h e o rótulo textual comunica `dd/mm/aaaa`. O estado do wizard segue   */
/* guardando a string `YYYY-MM-DDTHH:mm` (forma do datetime-local) para que */
/* `confirmar()` e a validação cross-field fiquem inalterados.              */
/* ----------------------------------------------------------------------- */

/** Data local com offset em dias (`YYYY-MM-DD`). `0` = hoje, `1` = amanhã. */
function dataLocal(offsetDias = 0): string {
  const n = new Date();
  n.setDate(n.getDate() + offsetDias);
  const mes = String(n.getMonth() + 1).padStart(2, "0");
  const dia = String(n.getDate()).padStart(2, "0");
  return `${n.getFullYear()}-${mes}-${dia}`;
}

export default function NovaCaixinhaPage() {
  const router = useRouter();
  const { notificar } = useToast();
  const [etapa, setEtapa] = useState<Etapa>(1);
  // Default da Data limite de entrada: amanhã (sem hora — só a parte data).
  // String "YYYY-MM-DDT" é estado intermediário válido (data preenchida,
  // hora não). `validarEtapa()` exige hora explícita antes de continuar.
  // Lazy init garante que `dataLocal` rode na primeira montagem.
  const [d, setD] = useState<Dados>(() => ({
    ...VAZIO,
    prazoEntrada: `${dataLocal(1)}T`,
  }));
  const [emailIn, setEmailIn] = useState("");
  const [submetendo, setSubmetendo] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  /** Cabeçalho amigável do callout de erro (vem do `problem.detail` do back).
   *  Quando vazio, o callout mostra só a lista de erros (caso da validação
   *  inline do wizard, que não tem `detail`). */
  const [tituloErro, setTituloErro] = useState<string>("");

  function validarEtapa(): string[] {
    const e: string[] = [];
    if (etapa === 1) {
      if (!d.titulo.trim()) e.push("Título é obrigatório.");
      if (!d.ladoA.trim()) e.push("Lado A do confronto é obrigatório.");
      if (!d.ladoB.trim()) e.push("Lado B do confronto é obrigatório.");
    } else if (etapa === 2) {
      const naoVazios = d.rotulosResultados.filter((r) => r.trim().length > 0);
      if (naoVazios.length < 2) {
        e.push("Pelo menos 2 Resultados Possíveis com rótulo não-vazio.");
      }
    } else if (etapa === 3) {
      // Dinheiro: comparação via Decimal (NUNCA parseFloat — NFR-1/AR-8).
      let valorOk = false;
      try {
        if (d.valorIngresso.trim().length > 0) {
          valorOk = moneyFromApi(d.valorIngresso).gte(new Decimal(INGRESSO_MIN));
        }
      } catch {
        valorOk = false;
      }
      if (!valorOk) e.push(`Valor de ingresso deve ser pelo menos ${formatBRL(INGRESSO_MIN)}.`);
      const m = parseInt(d.minimoParticipantes, 10);
      if (!d.minimoParticipantes || isNaN(m) || m < 2) {
        e.push("Mínimo de Participantes deve ser ≥ 2.");
      }
      const g = parseInt(d.numeroGanhadores, 10);
      if (!d.numeroGanhadores || isNaN(g) || g < 1 || g > 3) {
        e.push("Nº de Ganhadores deve ser 1, 2 ou 3.");
      } else if (!isNaN(m) && g > m) {
        e.push("Nº de Ganhadores não pode ser maior que o Mínimo de Participantes.");
      }
    } else if (etapa === 4) {
      // String pode estar parcial ("YYYY-MM-DDT" sem hora) — só vale como
      // preenchida quando bate o formato completo.
      const prazoOk = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.prazoEntrada);
      const apuracaoOk = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.dataApuracao);
      if (!prazoOk) e.push("Prazo de entrada (data e hora) é obrigatório.");
      if (!apuracaoOk) e.push("Data de apuração (data e hora) é obrigatória.");
      // Prazo de entrada não pode ser no passado: ele é imutável após a
      // criação e um prazo já vencido nasce com o palpite congelado.
      if (prazoOk && new Date(d.prazoEntrada) <= new Date()) {
        e.push("O prazo de entrada deve ser uma data futura.");
      }
      if (
        prazoOk &&
        apuracaoOk &&
        new Date(d.dataApuracao) <= new Date(d.prazoEntrada)
      ) {
        e.push("Data de apuração deve ser depois do prazo de entrada.");
      }
    }
    return e;
  }

  function proxima() {
    const e = validarEtapa();
    if (e.length > 0) {
      setTituloErro("");
      setErros(e);
      return;
    }
    setTituloErro("");
    setErros([]);
    setEtapa((etapa + 1) as Etapa);
  }

  function anterior() {
    setTituloErro("");
    setErros([]);
    setEtapa((etapa - 1) as Etapa);
  }

  function adicionarEmail() {
    const v = emailIn.trim();
    if (!RE_EMAIL.test(v)) return;
    if (!d.emailsConvidados.includes(v)) {
      setD({ ...d, emailsConvidados: [...d.emailsConvidados, v] });
    }
    setEmailIn("");
  }

  async function confirmar() {
    setSubmetendo(true);
    setTituloErro("");
    setErros([]);
    try {
      const created = await criarCaixinha({
        titulo: d.titulo.trim(),
        ladoA: d.ladoA.trim(),
        ladoB: d.ladoB.trim(),
        // moneyToApi(moneyFromApi(...)) normaliza p/ 2 casas sem Number (NFR-1).
        valorIngresso: moneyToApi(moneyFromApi(d.valorIngresso)),
        minimoParticipantes: parseInt(d.minimoParticipantes, 10),
        numeroGanhadores: parseInt(d.numeroGanhadores, 10),
        prazoEntrada: new Date(d.prazoEntrada).toISOString(),
        dataApuracao: new Date(d.dataApuracao).toISOString(),
        rotulosResultados: d.rotulosResultados
          .map((r) => r.trim())
          .filter((r) => r.length > 0),
        emailsConvidados: d.emailsConvidados,
      });
      notificar(`Caixinha "${created.titulo}" criada com sucesso!`, "win");
      router.push(`/caixinhas/${created.id}`);
    } catch (e) {
      setSubmetendo(false);
      if (e instanceof ApiError) {
        const violations = (e.problem as { violations?: string[] }).violations;
        if (Array.isArray(violations) && violations.length > 0) {
          // Cabeçalho amigável + lista humanizada (campos em pt-BR).
          setTituloErro(e.problem.title || "Não foi possível criar a caixinha.");
          setErros(violations.map(humanizarViolacao));
        } else {
          setTituloErro("");
          setErros([e.problem.detail ?? e.problem.title]);
        }
      } else {
        setTituloErro("");
        setErros(["Algo deu errado. Tente de novo."]);
      }
    }
  }

  return (
    <main className="cx-fade mx-auto max-w-[760px]">
      <VoltarLink href="/">Cancelar</VoltarLink>

      <h1 className="mb-5 mt-1 font-display text-[28px] tracking-wide">
        Nova caixinha <span className="text-base font-medium text-muted">— resultado único</span>
      </h1>

      {/* ------- stepper ------- */}
      <ol className="mb-5 flex flex-wrap gap-2">
        {PASSOS.map((p, i) => {
          const n = (i + 1) as Etapa;
          const atual = n === etapa;
          const feito = n < etapa;
          return (
            <li
              key={p}
              className={cx(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px]",
                atual && "border-green bg-green/10 text-green",
                feito && "border-line bg-surface text-text",
                !atual && !feito && "border-line bg-surface text-muted",
              )}
            >
              <span
                className={cx(
                  "grid h-[19px] w-[19px] place-items-center rounded-full text-[11px] font-bold",
                  atual ? "bg-green text-[#04210f]" : "bg-line text-text",
                )}
              >
                {feito ? <CheckCircle2 size={14} /> : n}
              </span>
              {p}
            </li>
          );
        })}
      </ol>

      {erros.length > 0 && (
        <div className="mb-4">
          <Callout tom="warn" icone={<AlertTriangle size={18} />}>
            {tituloErro && (
              <div className="mb-1.5 font-bold text-text">{tituloErro}</div>
            )}
            {tituloErro && (
              <div className="mb-1 text-[13px]">Corrija os itens abaixo e tente de novo:</div>
            )}
            <ul role="alert" className="list-disc space-y-0.5 pl-5">
              {erros.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      {/* ------- card-painel do passo ------- */}
      <Card className="p-6">
        {etapa === 1 && (
          <div className="flex flex-col gap-4">
            <Campo label="Nome / título da caixinha" hint="Ex: Jogo Brasil vs Marrocos">
              <Input
                value={d.titulo}
                onChange={(e) => setD({ ...d, titulo: e.target.value })}
                placeholder="Dê um nome para o bolão"
              />
            </Campo>
            <div className="flex items-end gap-3">
              <Campo label="Time mandante">
                <Input
                  value={d.ladoA}
                  onChange={(e) => setD({ ...d, ladoA: e.target.value })}
                  placeholder="Ex: Brasil"
                />
              </Campo>
              <span className="hidden shrink-0 pb-3 font-display text-sm text-muted sm:block">
                {bandeiraDe(d.ladoA)} VS {bandeiraDe(d.ladoB)}
              </span>
              <Campo label="Time visitante">
                <Input
                  value={d.ladoB}
                  onChange={(e) => setD({ ...d, ladoB: e.target.value })}
                  placeholder="Ex: Marrocos"
                />
              </Campo>
            </div>
          </div>
        )}

        {etapa === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted">
              Mínimo de 2 opções. Os participantes escolherão uma delas como palpite.
            </p>
            {d.rotulosResultados.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="grid h-[44px] w-[30px] shrink-0 place-items-center rounded-lg bg-green/15 font-display text-green">
                  {i + 1}
                </span>
                <Input
                  aria-label={`Resultado ${i + 1}`}
                  value={r}
                  onChange={(e) => {
                    const novo = [...d.rotulosResultados];
                    novo[i] = e.target.value;
                    setD({ ...d, rotulosResultados: novo });
                  }}
                  placeholder={`Resultado ${i + 1}`}
                />
                {d.rotulosResultados.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remover a opção ${i + 1}`}
                    onClick={() =>
                      setD({
                        ...d,
                        rotulosResultados: d.rotulosResultados.filter((_, j) => j !== i),
                      })
                    }
                    className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-lg border border-line2 text-muted hover:border-red hover:text-red"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Botao
                variante="ghost"
                onClick={() =>
                  setD({ ...d, rotulosResultados: [...d.rotulosResultados, ""] })
                }
              >
                <Plus size={15} /> Adicionar resultado
              </Botao>
              <SugerirBotao
                ladoA={d.ladoA}
                ladoB={d.ladoB}
                rotulosAtuais={d.rotulosResultados}
                aoSugerir={(novos) => setD({ ...d, rotulosResultados: novos })}
              />
            </div>
          </div>
        )}

        {etapa === 3 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Valor de ingresso" hint="Quanto cada participante paga via PIX">
                <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-line2 bg-bg2 pl-3.5 focus-within:border-green">
                  <span className="text-sm font-bold text-muted">R$</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min={INGRESSO_MIN}
                    value={d.valorIngresso}
                    onChange={(e) => setD({ ...d, valorIngresso: e.target.value })}
                    placeholder="20,00"
                    className="border-none bg-transparent pl-0 focus:ring-0"
                  />
                </div>
              </Campo>
              <Campo label="Mínimo de participantes" hint="Pagantes para a caixinha ser formada">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  value={d.minimoParticipantes}
                  onChange={(e) => setD({ ...d, minimoParticipantes: e.target.value })}
                  placeholder="4"
                />
              </Campo>
            </div>

            {/* grupo de botões — NÃO usa <Campo> (que é <label>): um <label>
                não deve envolver vários controles, e isso polui o nome
                acessível de cada botão. */}
            <div className="flex flex-col">
              <span className="mb-2 text-[13px] font-semibold">Nº de ganhadores</span>
              <div className="flex gap-2" role="group" aria-label="Nº de ganhadores">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} ganhador${n > 1 ? "es" : ""}`}
                    aria-pressed={d.numeroGanhadores === String(n)}
                    onClick={() => setD({ ...d, numeroGanhadores: String(n) })}
                    className={cx(
                      "min-h-[44px] flex-1 rounded-xl border font-display text-lg",
                      d.numeroGanhadores === String(n)
                        ? "border-green bg-green/10 text-green"
                        : "border-line2 bg-bg2 text-text",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="mt-1.5 text-[11.5px] leading-snug text-muted">
                Entre quantos o Prêmio é rateado (1, 2 ou 3). Se mais palpiteiros
                acertarem, você escolhe quem leva.
              </span>
            </div>

            <Callout tom="info" icone={<ShieldCheck size={18} />}>
              <b>Taxa de serviço: {formatBRL(TAXA_SERVICO)} fixos</b> — descontados do
              total da caixinha, independente do valor apostado ou do número de
              convidados.
              <CalcPotencial valorIngresso={d.valorIngresso} minimo={d.minimoParticipantes} />
            </Callout>
          </div>
        )}

        {etapa === 4 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CampoDataHora
                label="Data limite de entrada"
                hint="Último dia para aceitar e pagar"
                valor={d.prazoEntrada}
                onChange={(v) => setD({ ...d, prazoEntrada: v })}
              />
              <CampoDataHora
                label="Data de apuração do resultado"
                hint="Quando o vencedor será definido"
                valor={d.dataApuracao}
                onChange={(v) => setD({ ...d, dataApuracao: v })}
              />
            </div>
            {d.prazoEntrada && new Date(d.prazoEntrada) <= new Date() && (
              <Callout tom="warn" icone={<AlertTriangle size={18} />}>
                O prazo de entrada deve ser uma data futura.
              </Callout>
            )}
            {d.prazoEntrada &&
              d.dataApuracao &&
              new Date(d.dataApuracao) <= new Date(d.prazoEntrada) && (
                <Callout tom="warn" icone={<AlertTriangle size={18} />}>
                  A apuração deve ser posterior ao prazo de entrada.
                </Callout>
              )}
            <Callout tom="neutral" icone={<Lock size={18} />}>
              Após a criação, <b>valor, prazo de entrada, data de apuração e resultados
              não poderão ser alterados</b>. Você ainda poderá convidar novas pessoas.
            </Callout>
          </div>
        )}

        {etapa === 5 && (
          <div className="flex flex-col gap-4">
            <Campo
              label="Convidar por e-mail"
              hint="Opcional aqui — dá para convidar depois (até o prazo). O código PIX só é enviado quando o mínimo de aceites é atingido."
            >
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={emailIn}
                  onChange={(e) => setEmailIn(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarEmail();
                    }
                  }}
                  placeholder="amigo@email.com"
                />
                <Botao variante="primary" onClick={adicionarEmail} aria-label="Adicionar convidado">
                  <Plus size={15} />
                </Botao>
              </div>
            </Campo>
            <div className="flex flex-wrap gap-2">
              <Chip dono>
                <Trophy size={13} /> você (organizador)
              </Chip>
              {d.emailsConvidados.map((e) => (
                <Chip
                  key={e}
                  onRemover={() =>
                    setD({
                      ...d,
                      emailsConvidados: d.emailsConvidados.filter((x) => x !== e),
                    })
                  }
                >
                  <Mail size={12} /> {e}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {etapa === 6 && <Revisao d={d} />}
      </Card>

      {/* ------- navegação ------- */}
      <div className="mt-5 flex items-center gap-3">
        {etapa > 1 && (
          <Botao variante="ghost" onClick={anterior} disabled={submetendo}>
            <ArrowLeft size={15} /> Voltar
          </Botao>
        )}
        <div className="flex-1" />
        {etapa < 6 ? (
          <Botao variante="primary" onClick={proxima}>
            Continuar <ChevronRight size={16} />
          </Botao>
        ) : (
          <Botao variante="primary" grande onClick={confirmar} disabled={submetendo}>
            <Trophy size={17} /> {submetendo ? "Criando…" : "Criar caixinha"}
          </Botao>
        )}
      </div>
    </main>
  );
}

/* ----------------------------------------------------------------------- */
/* CalcPotencial — prêmio potencial no mínimo (Decimal, NFR-1).            */
/* ----------------------------------------------------------------------- */
function CalcPotencial({ valorIngresso, minimo }: { valorIngresso: string; minimo: string }) {
  let v: Decimal;
  try {
    v = valorIngresso ? moneyFromApi(valorIngresso) : new Decimal(0);
  } catch {
    v = new Decimal(0);
  }
  const m = parseInt(minimo || "0", 10) || 0;
  const bruto = v.times(m).minus(new Decimal(TAXA_SERVICO));
  const potencial = bruto.isPositive() ? bruto : new Decimal(0);
  return (
    <div className="mt-2 text-[13px]">
      Prêmio potencial no mínimo:{" "}
      <b className="font-display text-base text-gold">{formatBRL(potencial)}</b>
      <span className="text-muted">
        {" "}
        ({m} × {formatBRL(v)} − {formatBRL(TAXA_SERVICO)})
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* CampoDataHora — inputs `dd/mm/aaaa` + `HH:MM` mascarados (etapa 4).      */
/*                                                                          */
/* É um campo CONTROLADO: a prop `valor` é a fonte da verdade e segue o    */
/* formato "YYYY-MM-DDTHH:mm" do wizard (pode ser parcial: "YYYY-MM-DDT",  */
/* "T20:30", "T", ""). O `useState` interno guarda só o BRUTO digitado     */
/* (com máscara aplicada) para preservar passos intermediários da          */
/* digitação — ex: usuário digita "2" e a máscara devolve "2" antes de     */
/* virar "26/05/2026" completo. Esse draft NÃO é fonte da verdade — quando */
/* o pai re-monta o componente (mudar de etapa), o estado é re-inicializado*/
/* a partir do `valor`, então não se perde o que estava preenchido.        */
/* ----------------------------------------------------------------------- */
function CampoDataHora({
  label,
  hint,
  valor,
  onChange,
}: {
  label: string;
  hint: string;
  /** Estado externo no formato "YYYY-MM-DDTHH:mm" (possivelmente parcial). */
  valor: string;
  onChange: (v: string) => void;
}) {
  const [dataIsoInicial, horaInicial] = partirValor(valor);
  // Draft local — preserva digitações parciais ("2", "26/0", etc) entre
  // re-renders. Inicializado a partir do `valor` (lazy) para sobreviver à
  // remontagem do componente quando se troca de etapa do wizard.
  const [dataBruto, setDataBruto] = useState(() => formatarDataBR(dataIsoInicial));
  const [horaBruto, setHoraBruto] = useState(() => horaInicial);

  function emitir(novaDataBruto: string, novaHoraBruto: string) {
    const iso = brParaIsoData(novaDataBruto);
    // Só propaga hora quando completa (HH:MM = 5 chars). Digitações
    // intermediárias ("14", "14:3") emitem hora vazia.
    const hora = novaHoraBruto.length === 5 ? novaHoraBruto : "";
    onChange(`${iso}T${hora}`);
  }

  function aoDigitarData(v: string) {
    const mascarado = mascararData(v);
    setDataBruto(mascarado);
    emitir(mascarado, horaBruto);
  }

  function aoDigitarHora(v: string) {
    const mascarado = mascararHora(v);
    setHoraBruto(mascarado);
    emitir(dataBruto, mascarado);
  }

  /* Inputs de texto com máscara JS — formato BR fixo (`dd/mm/aaaa` + `HH:MM`
     24h) independente do locale do navegador. */
  return (
    <div className="flex flex-col">
      <span className="mb-2 text-[13px] font-semibold">{label}</span>
      <div className="flex gap-2">
        <Input
          type="text"
          aria-label={`${label} — data (dd/mm/aaaa)`}
          value={dataBruto}
          onChange={(e) => aoDigitarData(e.target.value)}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          maxLength={10}
        />
        <Input
          type="text"
          aria-label={`${label} — hora (24h, HH:MM)`}
          value={horaBruto}
          onChange={(e) => aoDigitarHora(e.target.value)}
          placeholder="HH:MM"
          inputMode="numeric"
          maxLength={5}
        />
      </div>
      <span className="mt-1.5 text-[11.5px] leading-snug text-muted">{hint}</span>
    </div>
  );
}

/** "YYYY-MM-DDTHH:mm" → ["YYYY-MM-DD", "HH:MM"]; partes faltantes → "". */
function partirValor(v: string): [string, string] {
  const idx = v.indexOf("T");
  if (idx === -1) return [v, ""];
  return [v.slice(0, idx), v.slice(idx + 1)];
}

/** "YYYY-MM-DD" → "dd/mm/aaaa"; vazia/inválida → "". */
function formatarDataBR(yyyymmdd: string): string {
  if (!yyyymmdd) return "";
  const [y, m, d] = yyyymmdd.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** "dd/mm/aaaa" → "YYYY-MM-DD"; incompleta/inválida → "". */
function brParaIsoData(ddmmaaaa: string): string {
  const partes = ddmmaaaa.split("/");
  if (partes.length !== 3) return "";
  const [d, m, y] = partes;
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return "";
  // Validação leve: dia 01-31, mês 01-12. Não checa fim-de-mês (deixa pro
  // back / validarEtapa). Datas absurdas viram "" e travam o "Continuar".
  const di = Number(d);
  const mi = Number(m);
  if (!di || di < 1 || di > 31 || !mi || mi < 1 || mi > 12) return "";
  return `${y}-${m}-${d}`;
}

/** Aplica máscara `dd/mm/aaaa` enquanto o usuário digita. Aceita só dígitos. */
function mascararData(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, "").slice(0, 8);
  if (apenasNumeros.length <= 2) return apenasNumeros;
  if (apenasNumeros.length <= 4) return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2)}`;
  return `${apenasNumeros.slice(0, 2)}/${apenasNumeros.slice(2, 4)}/${apenasNumeros.slice(4)}`;
}

/** Aplica máscara `HH:MM` enquanto o usuário digita. Aceita só dígitos. */
function mascararHora(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, "").slice(0, 4);
  if (apenasNumeros.length <= 2) return apenasNumeros;
  return `${apenasNumeros.slice(0, 2)}:${apenasNumeros.slice(2)}`;
}

/* ----------------------------------------------------------------------- */
/* Revisao — passo 6.                                                      */
/* ----------------------------------------------------------------------- */
function Revisao({ d }: { d: Dados }) {
  // Aritmética monetária via Decimal — regra dura NFR-1/AR-8.
  let v: Decimal;
  try {
    v = d.valorIngresso ? moneyFromApi(d.valorIngresso) : new Decimal(0);
  } catch {
    v = new Decimal(0);
  }
  const m = parseInt(d.minimoParticipantes || "0", 10);
  const g = parseInt(d.numeroGanhadores || "1", 10) || 1;
  const bruto = v.times(m).minus(new Decimal(TAXA_SERVICO));
  const premioMax = bruto.isPositive() ? bruto : new Decimal(0);
  const porGanhador = bruto.isPositive() ? bruto.div(g) : new Decimal(0);
  const resultados = d.rotulosResultados.map((r) => r.trim()).filter((r) => r.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-center gap-5">
        <ConfrontoRevisao bandeira={bandeiraDe(d.ladoA)} nome={d.ladoA || "—"} />
        <span className="font-display tracking-wide text-muted">VS</span>
        <ConfrontoRevisao bandeira={bandeiraDe(d.ladoB)} nome={d.ladoB || "—"} />
      </div>
      <div className="text-center font-display text-xl">{d.titulo || "—"}</div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <ItemRevisao k="Valor de ingresso" v={formatBRL(v)} />
        <ItemRevisao k="Mínimo de pagantes" v={d.minimoParticipantes || "—"} />
        <ItemRevisao k="Nº de ganhadores" v={String(g)} />
        <ItemRevisao k="Prazo de entrada" v={formatarDataHora(d.prazoEntrada)} />
        <ItemRevisao k="Apuração" v={formatarDataHora(d.dataApuracao)} />
        <ItemRevisao k="Convidados" v={`${d.emailsConvidados.length + 1} pessoas`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {resultados.map((r, i) => (
          <span
            key={i}
            className="rounded-full border border-line2 bg-surface px-3.5 py-2 text-[13px]"
          >
            <b className="mr-1.5 text-green">{i + 1}</b>
            {r}
          </span>
        ))}
      </div>

      <Callout tom="neutral" icone={<ShieldCheck size={15} />}>
        <div className="mb-1.5 font-bold text-text">Regras desta caixinha</div>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>Todo o dinheiro acumulado é transferido via PIX para quem acertar o resultado.</li>
          <li>
            Havendo mais de um vencedor, o prêmio é <b className="text-text">dividido igualmente</b>.
          </li>
          <li>
            Taxa de serviço de <b className="text-text">{formatBRL(TAXA_SERVICO)}</b> descontada do
            total. Prêmio máximo: <b className="text-text">{formatBRL(premioMax)}</b>
            {g > 1 && <> · {formatBRL(porGanhador)} por ganhador</>}.
          </li>
          <li>O código PIX só é enviado quando o mínimo de aceites é atingido.</li>
          <li>Sem o mínimo de pagantes até o prazo, a caixinha é cancelada e os valores devolvidos.</li>
          <li>
            Valor, prazos, apuração e resultados <b className="text-text">não podem ser alterados</b>{" "}
            após a criação.
          </li>
        </ul>
      </Callout>
    </div>
  );
}

function ConfrontoRevisao({ bandeira, nome }: { bandeira: string; nome: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5 text-center text-sm font-bold">
      <span className="text-3xl leading-none" aria-hidden>
        {bandeira}
      </span>
      <span className="line-clamp-1">{nome}</span>
    </span>
  );
}

function ItemRevisao({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg2 p-3">
      <span className="block text-[11px] text-muted">{k}</span>
      <b className="text-sm">{v}</b>
    </div>
  );
}

/**
 * Botão "Sugerir automático" (Story 2.3, FR-2).
 *
 * Só aparece se `sugerirResultados(ladoA, ladoB)` retorna não-`null` (AC-2:
 * não-render em vez de `disabled`). Se já há rótulo digitado, confirma antes
 * de substituir (AC-3) via `window.confirm` nativo.
 */
function SugerirBotao({
  ladoA,
  ladoB,
  rotulosAtuais,
  aoSugerir,
}: {
  ladoA: string;
  ladoB: string;
  rotulosAtuais: string[];
  aoSugerir: (novos: string[]) => void;
}) {
  const sugestao = sugerirResultados(ladoA, ladoB);
  if (sugestao === null) return null;
  const temRotulo = rotulosAtuais.some((r) => r.trim().length > 0);

  function handler() {
    if (temRotulo) {
      const ok = window.confirm(
        "Isso vai substituir os Resultados Possíveis atuais. Continuar?",
      );
      if (!ok) return;
    }
    aoSugerir(sugestao!);
  }

  return (
    <Botao variante="ghost" onClick={handler}>
      <Sparkles size={15} /> Sugerir automático
    </Botao>
  );
}
