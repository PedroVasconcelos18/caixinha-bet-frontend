import type { Metadata, Viewport } from "next";
import { Anton, Sora } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toasts";
import { Header, Footer } from "@/components/Header";

/**
 * Fontes do design Caixinha Bet (Story 7.1):
 * - Anton → display/títulos (logo, headings, valores em destaque)
 * - Sora  → corpo de texto
 * Carregadas via `next/font` (self-hosted, sem @import de CDN). As variáveis
 * `--font-anton`/`--font-sora` são consumidas pelos tokens em globals.css.
 */
const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Caixinha Bet",
  description: "Bolões da Copa entre amigos — custódia automática, sem ninguém segurar o pote.",
};

/**
 * Viewport mobile-first (NFR-3, load-bearing). No Next 16 o viewport é um
 * export próprio (separado de `metadata`). `width=device-width` +
 * `initialScale=1` garantem que a UI se ajusta ao dispositivo (360×640 alvo),
 * sem zoom-out forçado nem scroll horizontal. `themeColor` casa com o tema
 * escuro do design.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#070b14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${anton.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <Header />
          {/*
            Wrapper de conteúdo. As páginas redesenhadas (Stories 7.3–7.6)
            renderizam seu próprio conteúdo direto aqui — o landmark <main>
            vive em cada página, não no layout, para não aninhar <main>.
          */}
          <div className="mx-auto w-full max-w-[1080px] flex-1 px-4 py-7 sm:px-6 sm:py-8">
            {children}
          </div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
