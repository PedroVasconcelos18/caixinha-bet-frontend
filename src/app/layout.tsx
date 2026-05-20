import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caixinha Bet",
  description: "Bolões da Copa entre amigos — custódia automática, sem ninguém segurar o pote.",
};

/**
 * Viewport mobile-first (NFR-3, load-bearing). No Next 16 o viewport é um
 * export próprio (separado de `metadata`). `width=device-width` +
 * `initialScale=1` garantem que a UI se ajusta ao dispositivo (360×640 alvo),
 * sem zoom-out forçado nem scroll horizontal.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
