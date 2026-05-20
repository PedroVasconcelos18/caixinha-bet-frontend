import { defineConfig, devices } from "@playwright/test";

/**
 * Config do Playwright para os testes-guardrail da fundação (Story 1.2).
 *
 * - `webServer`: o Playwright sobe `pnpm dev` automaticamente antes do teste.
 *   `reuseExistingServer` permite rodar localmente sem religar o server.
 * - Viewport-alvo: 360×640 (NFR-3) — Chromium headless (já instalado).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    {
      name: "chromium-360x640",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 640 },
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
