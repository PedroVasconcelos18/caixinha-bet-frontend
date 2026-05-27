/**
 * Helpers de domínio visual do design Caixinha Bet (Story 7.1).
 *
 * Mapeia estados/dados do backend para a apresentação do design aprovado
 * (docs/design/remixed-7b210df2.tsx). NÃO contém regra de negócio — só
 * tradução estado → rótulo/cor/bandeira.
 */

/** Slug de estado de cor — os estados de repasse herdam o visual de `apurada`. */
export type EstadoCor =
  | "coletando_convites"
  | "coletando_pagamentos"
  | "formada"
  | "apurada"
  | "cancelada";

interface EstadoVisual {
  /** Rótulo curto exibido na pill de status. */
  label: string;
  /** Slug usado para montar as CSS vars --status-<slug> / --status-<slug>-glow. */
  cor: EstadoCor;
}

/**
 * Tabela estado → apresentação. Os estados financeiros do backend
 * `repasse_parcial` e `repassada` não têm cor própria: caem no visual de
 * `apurada` (decisão do Épico 7 — repasse é etapa pós-apuração, não 5º nó),
 * com rótulo próprio para o usuário entender o progresso.
 */
const ESTADOS: Record<string, EstadoVisual> = {
  coletando_convites: { label: "Aguardando aceites", cor: "coletando_convites" },
  coletando_pagamentos: { label: "Aguardando PIX", cor: "coletando_pagamentos" },
  formada: { label: "Caixinha formada", cor: "formada" },
  apurada: { label: "Apurada", cor: "apurada" },
  repasse_parcial: { label: "Repasse em andamento", cor: "apurada" },
  repassada: { label: "Repasse concluído", cor: "apurada" },
  cancelada: { label: "Cancelada", cor: "cancelada" },
};

const ESTADO_FALLBACK: EstadoVisual = { label: "Em andamento", cor: "coletando_convites" };

/** Resolve a apresentação (rótulo + cor + glow) de um estado do backend. */
export function estadoVisual(estado: string): {
  label: string;
  /** Cor sólida — `var(--status-<slug>)`. */
  cor: string;
  /** Glow translúcido — `var(--status-<slug>-glow)`. */
  glow: string;
} {
  const v = ESTADOS[estado] ?? ESTADO_FALLBACK;
  return {
    label: v.label,
    cor: `var(--status-${v.cor})`,
    glow: `var(--status-${v.cor}-glow)`,
  };
}

/** Estados terminais — não contam como "ativos" em estatísticas (FR-17). */
const ESTADOS_TERMINAIS = new Set(["apurada", "repassada", "cancelada"]);

export function isEstadoTerminal(estado: string): boolean {
  return ESTADOS_TERMINAIS.has(estado);
}

/* ----------------------------------------------------------------------- */
/* Bandeiras — emoji por nome de seleção, com normalização de acentos.      */
/* ----------------------------------------------------------------------- */

/**
 * 48 seleções da Copa do Mundo 2026 (Canadá/México/EUA), mais alguns nomes
 * tradicionais (Itália, Rússia) que não se classificaram mas aparecem em
 * amistosos/Eurocopa. Chaves SEM acento (normalizadas via NFD em `bandeiraDe`)
 * e em minúsculas. Aliases comuns inclusos (ex.: "eua" → 🇺🇸, "coreia" → 🇰🇷).
 */
const BANDEIRAS: Record<string, string> = {
  // CONMEBOL (6)
  brasil: "🇧🇷",
  argentina: "🇦🇷",
  uruguai: "🇺🇾",
  colombia: "🇨🇴",
  paraguai: "🇵🇾",
  equador: "🇪🇨",

  // UEFA (16)
  inglaterra: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  franca: "🇫🇷",
  croacia: "🇭🇷",
  portugal: "🇵🇹",
  noruega: "🇳🇴",
  alemanha: "🇩🇪",
  holanda: "🇳🇱",
  "paises baixos": "🇳🇱",
  suica: "🇨🇭",
  escocia: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  espanha: "🇪🇸",
  austria: "🇦🇹",
  belgica: "🇧🇪",
  "bosnia e herzegovina": "🇧🇦",
  bosnia: "🇧🇦",
  suecia: "🇸🇪",
  turquia: "🇹🇷",
  "republica tcheca": "🇨🇿",
  tcheca: "🇨🇿",
  chequia: "🇨🇿",

  // CAF (9)
  marrocos: "🇲🇦",
  tunisia: "🇹🇳",
  egito: "🇪🇬",
  argelia: "🇩🇿",
  gana: "🇬🇭",
  "cabo verde": "🇨🇻",
  "africa do sul": "🇿🇦",
  senegal: "🇸🇳",
  "costa do marfim": "🇨🇮",

  // AFC (8)
  japao: "🇯🇵",
  "coreia do sul": "🇰🇷",
  coreia: "🇰🇷",
  australia: "🇦🇺",
  ira: "🇮🇷",
  "ira (republica islamica)": "🇮🇷",
  jordania: "🇯🇴",
  uzbequistao: "🇺🇿",
  catar: "🇶🇦",
  qatar: "🇶🇦",
  "arabia saudita": "🇸🇦",

  // CONCACAF (6)
  "estados unidos": "🇺🇸",
  eua: "🇺🇸",
  usa: "🇺🇸",
  mexico: "🇲🇽",
  canada: "🇨🇦",
  curacao: "🇨🇼",
  panama: "🇵🇦",
  haiti: "🇭🇹",

  // OFC (1)
  "nova zelandia": "🇳🇿",

  // Repescagem Intercontinental (2)
  "republica democratica do congo": "🇨🇩",
  "rd congo": "🇨🇩",
  "rdc congo": "🇨🇩",
  iraque: "🇮🇶",

  // Tradicionais que NÃO se classificaram à Copa 2026 mas aparecem em
  // amistosos/Eurocopa/Copa América — úteis para caixinhas fora do Mundial.
  italia: "🇮🇹",
  russia: "🇷🇺",
  chile: "🇨🇱",
  peru: "🇵🇪",
  venezuela: "🇻🇪",
  bolivia: "🇧🇴",
  polonia: "🇵🇱",
  dinamarca: "🇩🇰",
  servia: "🇷🇸",
  ucrania: "🇺🇦",
  grecia: "🇬🇷",
  romenia: "🇷🇴",
  hungria: "🇭🇺",
  "irlanda do norte": "🇬🇧",
  irlanda: "🇮🇪",
  "pais de gales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  gales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  nigeria: "🇳🇬",
  camaroes: "🇨🇲",
  china: "🇨🇳",
};

/**
 * Bandeira (emoji) de uma seleção pelo nome. Normaliza acentos e caixa;
 * cai num emoji de bola quando o país não está mapeado.
 */
export function bandeiraDe(nome = ""): string {
  const chave = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return BANDEIRAS[chave] ?? "⚽";
}

/* ----------------------------------------------------------------------- */
/* Datas — formatação no padrão brasileiro.                                 */
/* ----------------------------------------------------------------------- */

/**
 * Formata uma data ISO-8601 (vinda da API ou do wizard) no padrão
 * brasileiro `dd/mm/aaaa HH:mm` — 24h, sem AM/PM. Independe do locale do
 * navegador: o formato é fixado explicitamente.
 *
 * String vazia ou data inválida → `"—"`.
 */
export function formatarDataHora(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
