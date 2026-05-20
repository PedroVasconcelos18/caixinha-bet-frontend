import { expect, test } from "@playwright/test";

/**
 * Story 2.1 — guardrails de UX da tela `/entrar` em viewport 360×640.
 *
 * NÃO acopla com backend real (CI sem back); usa `route.fulfill` para
 * interceptar `/auth/solicitar-acesso` e responder 204. Cobre:
 *  - mobile-first: sem scroll horizontal, alvos de toque ≥44px
 *  - feedback amigável após submit
 *  - erro RFC 9457 do back vira mensagem no front
 */

test.describe("/entrar (Story 2.1)", () => {
	test("renderiza em 360×640 sem scroll horizontal", async ({ page }) => {
		await page.goto("/entrar");

		const viewport = page.viewportSize();
		expect(viewport).toEqual({ width: 360, height: 640 });

		// Sem scroll horizontal no documento.
		const horizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth,
		);
		expect(horizontalOverflow).toBe(false);

		// Botão principal tem alvo de toque ≥44px.
		const botao = page.getByRole("button", { name: /me manda o link/i });
		await expect(botao).toBeVisible();
		const box = await botao.boundingBox();
		expect(box).not.toBeNull();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});

	test("submit com e-mail válido → tela de confirmação amigável", async ({ page }) => {
		await page.route("**/auth/solicitar-acesso", (route) =>
			route.fulfill({ status: 204 }),
		);

		await page.goto("/entrar");
		await page.getByLabel(/e-mail/i).fill("rafael@local");
		await page.getByRole("button", { name: /me manda o link/i }).click();

		await expect(page.getByRole("heading", { name: /confere o e-mail/i })).toBeVisible();
		await expect(page.getByText(/link mágico que vale por 15 minutos/i)).toBeVisible();
	});

	test("erro do backend RFC 9457 vira mensagem amigável", async ({ page }) => {
		await page.route("**/auth/solicitar-acesso", (route) =>
			route.fulfill({
				status: 400,
				contentType: "application/problem+json",
				body: JSON.stringify({
					type: "about:blank",
					title: "Bad Request",
					status: 400,
					detail: "E-mail mal formatado",
				}),
			}),
		);

		await page.goto("/entrar");
		// Usar e-mail que passe pela validação client-side (tem @) mas o back
		// rejeita — para garantir que o erro do back é exibido.
		await page.getByLabel(/e-mail/i).fill("foo@bar");
		await page.getByRole("button", { name: /me manda o link/i }).click();

		// `role="alert"` é ambíguo no Next 16 (route announcer também usa) — buscar dentro do form.
		await expect(page.locator("form [role=alert]")).toContainText(/mal formatado/i);
	});

	test("middleware redireciona / para /entrar quando sem cookie", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveURL(/\/entrar\?redirectTo=%2F$/);
	});
});
