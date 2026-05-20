import { expect, test } from "@playwright/test";

/**
 * Guardrail mobile-first (NFR-3, Story 1.2 AC-3).
 *
 * Viewport-alvo: 360×640. O layout base NÃO pode causar scroll horizontal
 * — qualquer estilo que pressuponha desktop quebra o requisito load-bearing
 * do produto. Este teste roda no CI a cada push (ver `.github/workflows/ci.yml`).
 */
test.describe("Fundação mobile-first 360×640", () => {
  test("a página inicial carrega sem scroll horizontal", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  });

  test("a página declara viewport mobile-first (width=device-width)", async ({
    page,
  }) => {
    await page.goto("/");
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(viewport).toContain("width=device-width");
    expect(viewport).toContain("initial-scale=1");
  });
});
