"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { criarCaixinha, sugerirResultados } from "@/lib/caixinha";
import { Decimal, moneyFromApi, moneyToApi } from "@/lib/money";

/**
 * Wizard de criação de Caixinha (Story 2.2).
 *
 * 6 etapas client-side (sem persistência intermediária — abandonar = perde,
 * mesma UX de carrinho de compra sem login). Submit no final = único
 * POST /caixinhas atômico.
 *
 * Validação inline para feedback rápido; back valida tudo de novo (422
 * com `violations` se algo passar).
 *
 * Mobile-first 360×640: inputs ≥44px, sem scroll horizontal, tom NFR-6
 * caloroso ("organize seu bolão, sem planilha", etc.).
 */
type Etapa = 1 | 2 | 3 | 4 | 5 | 6;

interface Dados {
  titulo: string;
  ladoA: string;
  ladoB: string;
  valorIngresso: string;
  minimoParticipantes: string;
  /** v5 FR-1: "1" | "2" | "3" (mantido como string para casar com inputs). */
  numeroGanhadores: string;
  prazoEntrada: string; // input datetime-local (sem timezone)
  dataApuracao: string;
  rotulosResultados: string[];
  emailsConvidados: string;
}

const VAZIO: Dados = {
  titulo: "",
  ladoA: "",
  ladoB: "",
  valorIngresso: "",
  minimoParticipantes: "",
  numeroGanhadores: "1", // default; usuário pode trocar p/ 2 ou 3 na etapa 3
  prazoEntrada: "",
  dataApuracao: "",
  rotulosResultados: ["", ""],
  emailsConvidados: "",
};

const TAXA_SERVICO_REAIS = "10.00";
const INGRESSO_MIN_REAIS = "5.00";

export default function NovaCaixinhaPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>(1);
  const [d, setD] = useState<Dados>(VAZIO);
  const [submetendo, setSubmetendo] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

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
      // Dinheiro: comparação via Decimal (NUNCA via parseFloat — NFR-1/AR-8).
      // Try/catch porque moneyFromApi lança em string inválida.
      let valorOk = false;
      try {
        if (d.valorIngresso.trim().length > 0) {
          const v = moneyFromApi(d.valorIngresso);
          valorOk = v.gte(new Decimal("5.00"));
        }
      } catch {
        valorOk = false;
      }
      if (!valorOk) {
        e.push("Valor de ingresso deve ser pelo menos R$ 5,00.");
      }
      const m = parseInt(d.minimoParticipantes, 10);
      if (!d.minimoParticipantes || isNaN(m) || m < 2) {
        e.push("Mínimo de Participantes deve ser >= 2.");
      }
      // v5 FR-1: Nº de Ganhadores (1, 2 ou 3) e ≤ Mínimo de Participantes.
      const g = parseInt(d.numeroGanhadores, 10);
      if (!d.numeroGanhadores || isNaN(g) || g < 1 || g > 3) {
        e.push("Nº de Ganhadores deve ser 1, 2 ou 3.");
      } else if (!isNaN(m) && g > m) {
        e.push("Nº de Ganhadores não pode ser maior que o Mínimo de Participantes.");
      }
    } else if (etapa === 4) {
      if (!d.prazoEntrada) e.push("Prazo de entrada é obrigatório.");
      if (!d.dataApuracao) e.push("Data de apuração é obrigatória.");
      if (
        d.prazoEntrada &&
        d.dataApuracao &&
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
      setErros(e);
      return;
    }
    setErros([]);
    setEtapa((etapa + 1) as Etapa);
  }

  function anterior() {
    setErros([]);
    setEtapa((etapa - 1) as Etapa);
  }

  async function confirmar() {
    setSubmetendo(true);
    setErros([]);
    try {
      const emails = d.emailsConvidados
        .split(/[\n,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const created = await criarCaixinha({
        titulo: d.titulo.trim(),
        ladoA: d.ladoA.trim(),
        ladoB: d.ladoB.trim(),
        // moneyToApi(moneyFromApi(...)) normaliza para 2 casas decimais sem
        // passar por Number (NFR-1/AR-8). Já validamos na etapa 3.
        valorIngresso: moneyToApi(moneyFromApi(d.valorIngresso)),
        minimoParticipantes: parseInt(d.minimoParticipantes, 10),
        numeroGanhadores: parseInt(d.numeroGanhadores, 10),
        prazoEntrada: new Date(d.prazoEntrada).toISOString(),
        dataApuracao: new Date(d.dataApuracao).toISOString(),
        rotulosResultados: d.rotulosResultados
          .map((r) => r.trim())
          .filter((r) => r.length > 0),
        emailsConvidados: emails,
      });
      router.push(`/caixinhas/${created.id}`);
    } catch (e) {
      setSubmetendo(false);
      if (e instanceof ApiError) {
        const violations = (e.problem as { violations?: string[] }).violations;
        if (Array.isArray(violations) && violations.length > 0) {
          setErros(violations);
        } else {
          setErros([e.problem.detail ?? e.problem.title]);
        }
      } else {
        setErros(["Algo deu errado. Tente de novo."]);
      }
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wider text-zinc-500">
          Etapa {etapa} de 6
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          {etapa === 1 && "Confronto"}
          {etapa === 2 && "Resultados Possíveis"}
          {etapa === 3 && "Financeiro"}
          {etapa === 4 && "Prazos"}
          {etapa === 5 && "Convidados"}
          {etapa === 6 && "Revisão"}
        </h1>
      </header>

      {erros.length > 0 && (
        <ul
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {erros.map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
        </ul>
      )}

      <section className="flex flex-1 flex-col gap-3">
        {etapa === 1 && (
          <>
            <Field label="Título">
              <input
                type="text"
                value={d.titulo}
                onChange={(ev) => setD({ ...d, titulo: ev.target.value })}
                placeholder="Brasil x Marrocos"
                className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
              />
            </Field>
            <Field label="Lado A">
              <input
                type="text"
                value={d.ladoA}
                onChange={(ev) => setD({ ...d, ladoA: ev.target.value })}
                placeholder="Brasil"
                className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
              />
            </Field>
            <Field label="Lado B">
              <input
                type="text"
                value={d.ladoB}
                onChange={(ev) => setD({ ...d, ladoB: ev.target.value })}
                placeholder="Marrocos"
                className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
              />
            </Field>
          </>
        )}

        {etapa === 2 && (
          <>
            <p className="text-sm text-zinc-600">
              Pelo menos 2 rótulos não-vazios.
            </p>
            <SugerirBotao
              ladoA={d.ladoA}
              ladoB={d.ladoB}
              rotulosAtuais={d.rotulosResultados}
              aoSugerir={(novos) =>
                setD({ ...d, rotulosResultados: novos })
              }
            />
            {d.rotulosResultados.map((r, i) => (
              <Field key={i} label={`Resultado ${i + 1}`}>
                <input
                  type="text"
                  value={r}
                  onChange={(ev) => {
                    const novo = [...d.rotulosResultados];
                    novo[i] = ev.target.value;
                    setD({ ...d, rotulosResultados: novo });
                  }}
                  className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
                />
              </Field>
            ))}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setD({
                    ...d,
                    rotulosResultados: [...d.rotulosResultados, ""],
                  })
                }
                className="min-h-[44px] flex-1 rounded-md border border-zinc-300 px-3 text-sm"
              >
                + Adicionar
              </button>
              {d.rotulosResultados.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setD({
                      ...d,
                      rotulosResultados: d.rotulosResultados.slice(0, -1),
                    })
                  }
                  className="min-h-[44px] flex-1 rounded-md border border-zinc-300 px-3 text-sm"
                >
                  − Remover
                </button>
              )}
            </div>
          </>
        )}

        {etapa === 3 && (
          <>
            <Field label="Valor de ingresso (R$)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={INGRESSO_MIN_REAIS}
                value={d.valorIngresso}
                onChange={(ev) =>
                  setD({ ...d, valorIngresso: ev.target.value })
                }
                placeholder="40.00"
                className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
              />
            </Field>
            <p className="text-xs text-zinc-600">
              Mínimo R$ {INGRESSO_MIN_REAIS}. Uma Taxa de Serviço de{" "}
              R$ {TAXA_SERVICO_REAIS} é descontada do prêmio final.
            </p>
            <Field label="Mínimo de Participantes">
              <input
                type="number"
                inputMode="numeric"
                min={2}
                value={d.minimoParticipantes}
                onChange={(ev) =>
                  setD({ ...d, minimoParticipantes: ev.target.value })
                }
                placeholder="5"
                className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
              />
            </Field>
            <p className="text-xs text-zinc-600">
              Este número é simultaneamente o mínimo de <em>aceites</em>{" "}
              (libera pagamento) e o mínimo de <em>pagantes</em> (forma a
              Caixinha).
            </p>
            <Field label="Nº de Ganhadores">
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      setD({ ...d, numeroGanhadores: String(n) })
                    }
                    aria-pressed={d.numeroGanhadores === String(n)}
                    className={
                      "min-h-[44px] flex-1 rounded-md border px-4 text-sm font-medium " +
                      (d.numeroGanhadores === String(n)
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100")
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <p className="text-xs text-zinc-600">
              Entre quantos o Prêmio é rateado. Se houver mais palpiteiros
              corretos que o Nº de Ganhadores na apuração, <em>você</em>{" "}
              (Organizador) escolhe quem leva.
            </p>
          </>
        )}

        {etapa === 4 && (
          <>
            <Field label="Prazo de entrada">
              <input
                type="datetime-local"
                value={d.prazoEntrada}
                onChange={(ev) =>
                  setD({ ...d, prazoEntrada: ev.target.value })
                }
                className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
              />
            </Field>
            <Field label="Data de apuração">
              <input
                type="datetime-local"
                value={d.dataApuracao}
                onChange={(ev) =>
                  setD({ ...d, dataApuracao: ev.target.value })
                }
                className="min-h-[44px] rounded-md border border-zinc-300 bg-white px-3 text-base"
              />
            </Field>
          </>
        )}

        {etapa === 5 && (
          <>
            <Field label="E-mails dos convidados (um por linha ou separados por vírgula)">
              <textarea
                rows={4}
                value={d.emailsConvidados}
                onChange={(ev) =>
                  setD({ ...d, emailsConvidados: ev.target.value })
                }
                placeholder="amigo@exemplo.com&#10;outroamigo@exemplo.com"
                className="rounded-md border border-zinc-300 bg-white p-3 text-base"
              />
            </Field>
            <p className="text-xs text-zinc-600">
              Opcional nesta etapa — você pode convidar depois (até o prazo
              de entrada). Envio real chega na próxima atualização.
            </p>
          </>
        )}

        {etapa === 6 && (
          <Revisao d={d} />
        )}
      </section>

      <footer className="flex gap-2">
        {etapa > 1 && (
          <button
            type="button"
            onClick={anterior}
            disabled={submetendo}
            className="min-h-[48px] flex-1 rounded-md border border-zinc-300 px-4 text-sm"
          >
            Voltar
          </button>
        )}
        {etapa < 6 && (
          <button
            type="button"
            onClick={proxima}
            className="min-h-[48px] flex-1 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Próximo
          </button>
        )}
        {etapa === 6 && (
          <button
            type="button"
            onClick={confirmar}
            disabled={submetendo}
            className="min-h-[48px] flex-1 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submetendo ? "Criando..." : "Confirmar Caixinha"}
          </button>
        )}
      </footer>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

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
  const taxa = new Decimal("10");
  const potencialBruto = v.times(m).minus(taxa);
  const premioMax = (potencialBruto.isPositive() ? potencialBruto : new Decimal(0)).toFixed(2);
  // Decimal.div arredonda; usamos as 2 casas finais.
  const porGanhador = (potencialBruto.isPositive() ? potencialBruto.div(g) : new Decimal(0)).toFixed(2);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <Linha k="Título" v={d.titulo} />
      <Linha k="Confronto" v={`${d.ladoA} × ${d.ladoB}`} />
      <Linha
        k="Resultados Possíveis"
        v={d.rotulosResultados
          .map((r) => r.trim())
          .filter((r) => r.length > 0)
          .join(", ")}
      />
      <Linha k="Valor do ingresso" v={`R$ ${v.toFixed(2)}`} />
      <Linha
        k="Mínimo único"
        v={`${d.minimoParticipantes} (aceites E pagantes — mesmo número)`}
      />
      <Linha
        k="Nº de Ganhadores"
        v={`${g} (entre quantos o Prêmio é rateado)`}
      />
      <Linha
        k="Prazo de entrada"
        v={d.prazoEntrada || "(não informado)"}
      />
      <Linha
        k="Data de apuração"
        v={d.dataApuracao || "(não informado)"}
      />
      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-medium">Taxa de Serviço: R$ {TAXA_SERVICO_REAIS}</p>
        <p className="mt-1">
          Prêmio máximo (se todos pagarem) = Σ ingressos − Taxa = R$ {premioMax}
        </p>
        {g > 1 && (
          <p className="mt-1">
            Rateado entre {g} Ganhador(es) = R$ {porGanhador} por Ganhador
            (resíduo de centavos vai ao 1º por ordem de pagamento).
          </p>
        )}
      </div>
      <div className="rounded-md border border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
        <p className="font-medium">Estas regras ficam imutáveis após criar:</p>
        <ul className="mt-1 list-disc pl-5">
          <li>Valor de ingresso</li>
          <li>Prazo de entrada</li>
          <li>Data de apuração</li>
          <li>Resultados Possíveis</li>
          <li>Nº de Ganhadores</li>
        </ul>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          Você ainda pode convidar mais Participantes depois (até o prazo).
        </p>
        {g < m && (
          <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
            <strong>Atenção:</strong> se na apuração houver mais palpiteiros
            corretos que {g}, <em>você</em> (Organizador) seleciona quem são
            os Ganhadores entre eles.
          </p>
        )}
      </div>
    </div>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{k}</span>
      <span className="text-sm">{v}</span>
    </div>
  );
}

/**
 * Botão "Sugerir automaticamente" (Story 2.3, FR-2).
 *
 * Só aparece se `sugerirResultados(ladoA, ladoB)` retorna não-`null`
 * (AC-2: não-render em vez de `disabled` — não confunde o usuário).
 *
 * Se já há rótulo digitado, confirma antes de substituir (AC-3) via
 * `window.confirm` nativo — zero deps, acessível, bloqueia foco.
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
  if (sugestao === null) {
    return null;
  }
  const temAlgumRotuloUtil = rotulosAtuais.some(
    (r) => r.trim().length > 0,
  );
  function handler() {
    if (temAlgumRotuloUtil) {
      const ok = window.confirm(
        "Isso vai substituir os Resultados Possíveis atuais. Continuar?",
      );
      if (!ok) return;
    }
    aoSugerir(sugestao!);
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handler}
        className="min-h-[44px] rounded-md border border-zinc-400 px-4 text-sm font-medium dark:border-zinc-600"
      >
        Sugerir automaticamente
      </button>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        Com base no confronto, geramos &quot;Vitória de {ladoA.trim()}&quot;,
        &quot;Empate&quot; e &quot;Vitória de {ladoB.trim()}&quot;. Você ainda
        pode editar depois.
      </p>
    </div>
  );
}
