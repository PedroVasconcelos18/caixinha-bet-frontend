/**
 * Placeholder de fundação (Story 1.2).
 *
 * NÃO é a tela de produto. O dashboard real é FR-17 (Épico 6); o wizard,
 * detalhe e aceite vêm nos Épicos 2/6. Esta página só prova que o App
 * Router roda e que o layout base é mobile-first (360×640, sem scroll
 * horizontal). NUNCA reproduzir o protótipo `remixed-7b210df2.tsx`.
 */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Caixinha Bet</h1>
      <p className="text-base text-zinc-600 dark:text-zinc-400">
        Fundação do frontend pronta. As telas chegam nos próximos épicos.
      </p>
    </main>
  );
}
