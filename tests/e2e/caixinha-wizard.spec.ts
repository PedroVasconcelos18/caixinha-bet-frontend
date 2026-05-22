import { expect, test } from "@playwright/test";
import { sugerirResultados } from "../../src/lib/caixinha";

/**
 * Story 2.2 — wizard de criação de Caixinha mobile-first.
 *
 * Mocka `/caixinhas` para evitar dependência de backend rodando no CI.
 * Cobre:
 *  - viewport 360×640 sem scroll horizontal
 *  - alvos de toque ≥44px (botão "Próximo")
 *  - validação inline na etapa Financeiro (valorIngresso < 5)
 *  - fluxo completo até POST + redirect para /caixinhas/{id}
 */

test.describe("/caixinhas/nova (Story 2.2)", () => {
	test("renderiza em 360×640 sem scroll horizontal e botão ≥44px", async ({
		page,
	}) => {
		// Bypass do proxy de auth: setar cookie de presença antes de navegar.
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);
		await page.goto("/caixinhas/nova");

		const viewport = page.viewportSize();
		expect(viewport).toEqual({ width: 360, height: 640 });

		const horizontalOverflow = await page.evaluate(
			() => document.documentElement.scrollWidth > document.documentElement.clientWidth,
		);
		expect(horizontalOverflow).toBe(false);

		const proximo = page.getByRole("button", { name: /^Continuar$/i });
		await expect(proximo).toBeVisible();
		const box = await proximo.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
	});

	test("validação inline: valorIngresso < R$ 5 bloqueia avanço", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);
		await page.goto("/caixinhas/nova");

		// Etapa 1: Confronto
		await page.getByLabel("Nome / título da caixinha").fill("Brasil x Marrocos");
		await page.getByLabel("Time mandante").fill("Brasil");
		await page.getByLabel("Time visitante").fill("Marrocos");
		await page.getByRole("button", { name: /Continuar/ }).click();

		// Etapa 2: Resultados — preencher dois
		await page.getByLabel("Resultado 1").fill("Vitória A");
		await page.getByLabel("Resultado 2").fill("Vitória B");
		await page.getByRole("button", { name: /Continuar/ }).click();

		// Etapa 3: Financeiro — valor inválido
		await page.getByLabel("Valor de ingresso").fill("4");
		await page.getByLabel("Mínimo de participantes").fill("5");
		await page.getByRole("button", { name: /Continuar/ }).click();

		// Validação inline disparou. Escopar para `ul[role=alert]` porque
		// o Next 16 também usa role=alert para o route announcer.
		await expect(page.locator("ul[role=alert]")).toContainText(/R\$.5,00/i);
	});

	test("v5: Nº de Ganhadores > Mínimo bloqueia avanço (FR-1 v5)", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);
		await page.goto("/caixinhas/nova");

		await page.getByLabel("Nome / título da caixinha").fill("Brasil x Marrocos");
		await page.getByLabel("Time mandante").fill("Brasil");
		await page.getByLabel("Time visitante").fill("Marrocos");
		await page.getByRole("button", { name: /Continuar/ }).click();

		await page.getByLabel("Resultado 1").fill("Vitória A");
		await page.getByLabel("Resultado 2").fill("Vitória B");
		await page.getByRole("button", { name: /Continuar/ }).click();

		// Etapa 3: Mínimo=2, Nº de Ganhadores=3 → inválido (3 > 2).
		await page.getByLabel("Valor de ingresso").fill("40.00");
		await page.getByLabel("Mínimo de participantes").fill("2");
		await page.getByRole("button", { name: /3 ganhadores/i }).click();
		await page.getByRole("button", { name: /Continuar/ }).click();

		await expect(page.locator("ul[role=alert]")).toContainText(
			/Nº de Ganhadores/i,
		);
	});

	test("fluxo feliz: 6 etapas + POST + navega para /caixinhas/{id}", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);

		const caixinhaPayload = {
			id: 42,
			titulo: "Brasil x Marrocos",
			ladoA: "Brasil",
			ladoB: "Marrocos",
			valorIngresso: "40.00",
			minimoParticipantes: 5,
			numeroGanhadores: 1,
			prazoEntrada: "2026-06-01T12:00:00Z",
			dataApuracao: "2026-06-01T14:00:00Z",
			estado: "coletando_convites",
			taxaServico: "10.00",
			premioMaximoTeorico: "190.00",
			totalCustodiado: "0.00",
			premioPotencial: "0.00",
			criadoEm: "2026-05-20T10:00:00Z",
			resultadosPossiveis: [
				{ ordem: 0, rotulo: "Vitória A" },
				{ ordem: 1, rotulo: "Vitória B" },
			],
			participantes: [
				{
					email: "rafael@local",
					dono: true,
					status: "convidado",
					palpiteResultadoPossivelId: null,
					palpiteRotulo: null,
				},
			],
		};

		// Mock do POST /caixinhas e GET /caixinhas/42
		await page.route("**/caixinhas", (route) => {
			if (route.request().method() === "POST") {
				route.fulfill({
					status: 201,
					contentType: "application/json",
					headers: { Location: "/caixinhas/42" },
					body: JSON.stringify(caixinhaPayload),
				});
				return;
			}
			route.fallback();
		});
		await page.route("**/caixinhas/42", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(caixinhaPayload),
			}),
		);

		await page.goto("/caixinhas/nova");

		await page.getByLabel("Nome / título da caixinha").fill("Brasil x Marrocos");
		await page.getByLabel("Time mandante").fill("Brasil");
		await page.getByLabel("Time visitante").fill("Marrocos");
		await page.getByRole("button", { name: /Continuar/ }).click();

		await page.getByLabel("Resultado 1").fill("Vitória A");
		await page.getByLabel("Resultado 2").fill("Vitória B");
		await page.getByRole("button", { name: /Continuar/ }).click();

		await page.getByLabel("Valor de ingresso").fill("40.00");
		await page.getByLabel("Mínimo de participantes").fill("5");
		await page.getByRole("button", { name: /Continuar/ }).click();

		await page.getByLabel("Data limite de entrada").fill("2026-06-01T12:00");
		await page.getByLabel("Data de apuração do resultado").fill("2026-06-01T14:00");
		await page.getByRole("button", { name: /Continuar/ }).click();

		await page.getByRole("button", { name: /Continuar/ }).click(); // pular convidados

		await expect(page.getByText(/Taxa de serviço de/i)).toBeVisible();
		await expect(page.getByText(/Regras desta caixinha/i)).toBeVisible();

		await page.getByRole("button", { name: /Criar caixinha/ }).click();

		await page.waitForURL("**/caixinhas/42");
		await expect(
			page.getByRole("heading", { name: "Brasil x Marrocos" }),
		).toBeVisible();
	});
});

/**
 * Story 2.3 — função pura `sugerirResultados`.
 *
 * Testes unitários embarcados no spec do Playwright (zero deps novas —
 * Vitest/Jest não foram introduzidos). Playwright roda os specs em Node,
 * então `import` + `expect()` funcionam aqui como testes unitários.
 */
test.describe("sugerirResultados (Story 2.3)", () => {
	test("lados válidos → 3 rótulos com Vitória/Empate/Vitória", () => {
		expect(sugerirResultados("Brasil", "Marrocos")).toEqual([
			"Vitória de Brasil",
			"Empate",
			"Vitória de Marrocos",
		]);
	});

	test("ladoA vazio → null", () => {
		expect(sugerirResultados("", "X")).toBeNull();
	});

	test("ladoB vazio → null", () => {
		expect(sugerirResultados("X", "")).toBeNull();
	});

	test("ambos vazios → null", () => {
		expect(sugerirResultados("", "")).toBeNull();
	});

	test("whitespace puro → null (após trim)", () => {
		expect(sugerirResultados("   ", "X")).toBeNull();
		expect(sugerirResultados("X", "\t")).toBeNull();
		expect(sugerirResultados("  ", "  ")).toBeNull();
	});

	test("trim aplicado nos rótulos finais", () => {
		expect(sugerirResultados("  Brasil  ", "  Marrocos  ")).toEqual([
			"Vitória de Brasil",
			"Empate",
			"Vitória de Marrocos",
		]);
	});
});

/**
 * Story 2.3 — UX do botão "Sugerir automaticamente" na etapa 2 do wizard.
 *
 * Cobre AC-1 (botão aparece e substitui), AC-2 (não aparece sem lados —
 * implícito pelo invariante do wizard que não deixa avançar sem lados),
 * AC-3 (confirma antes de substituir se há trabalho a perder).
 */
test.describe("/caixinhas/nova → etapa 2 (Story 2.3)", () => {
	test("AC-1: clicar 'Sugerir' substitui por 3 rótulos com Vitória/Empate", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);
		await page.goto("/caixinhas/nova");

		// Etapa 1: Confronto
		await page.getByLabel("Nome / título da caixinha").fill("Brasil x Marrocos");
		await page.getByLabel("Time mandante").fill("Brasil");
		await page.getByLabel("Time visitante").fill("Marrocos");
		await page.getByRole("button", { name: /Continuar/ }).click();

		// Etapa 2: deve mostrar o botão
		const sugerir = page.getByRole("button", { name: /Sugerir automático/i });
		await expect(sugerir).toBeVisible();
		const box = await sugerir.boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);

		// Clica: como rótulos estão vazios, NÃO confirma
		await sugerir.click();

		// Agora há 3 inputs preenchidos
		await expect(page.getByLabel("Resultado 1")).toHaveValue(
			"Vitória de Brasil",
		);
		await expect(page.getByLabel("Resultado 2")).toHaveValue("Empate");
		await expect(page.getByLabel("Resultado 3")).toHaveValue(
			"Vitória de Marrocos",
		);
	});

	test("AC-3: com rótulo digitado, confirma e cancelar mantém o atual", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);
		await page.goto("/caixinhas/nova");

		await page.getByLabel("Nome / título da caixinha").fill("Brasil x Marrocos");
		await page.getByLabel("Time mandante").fill("Brasil");
		await page.getByLabel("Time visitante").fill("Marrocos");
		await page.getByRole("button", { name: /Continuar/ }).click();

		await page.getByLabel("Resultado 1").fill("Meu rótulo custom");

		// Registra handler ANTES do clique (Playwright recomenda) — cancelar
		page.once("dialog", (d) => d.dismiss());
		await page.getByRole("button", { name: /Sugerir automático/i }).click();
		await expect(page.getByLabel("Resultado 1")).toHaveValue("Meu rótulo custom");

		// Agora aceitar
		page.once("dialog", (d) => d.accept());
		await page.getByRole("button", { name: /Sugerir automático/i }).click();
		await expect(page.getByLabel("Resultado 1")).toHaveValue(
			"Vitória de Brasil",
		);
	});
});

/**
 * Story 2.4 — seção "Convidar mais Participantes" no detalhe da Caixinha.
 *
 * Mocka /auth/me e /caixinhas/{id} para controlar o cenário (usuário
 * logado é dono → seção aparece) e /caixinhas/{id}/convites para validar
 * o feedback. Não depende de back rodando.
 */
test.describe("/caixinhas/[id] → Convidar mais (Story 2.4)", () => {
	const caixinhaPayload = {
		id: 42,
		titulo: "Brasil x Marrocos",
		ladoA: "Brasil",
		ladoB: "Marrocos",
		valorIngresso: "40.00",
		minimoParticipantes: 5,
		prazoEntrada: "2026-06-01T12:00:00Z",
		dataApuracao: "2026-06-01T14:00:00Z",
		estado: "coletando_convites",
		taxaServico: "10.00",
		premioMaximoTeorico: "190.00",
		totalCustodiado: "0.00",
		premioPotencial: "0.00",
		criadoEm: "2026-05-20T10:00:00Z",
		resultadosPossiveis: [
			{ ordem: 0, rotulo: "Vitória A" },
			{ ordem: 1, rotulo: "Vitória B" },
		],
		participantes: [
			{
				email: "rafael@local",
				dono: true,
				status: "convidado",
				palpiteResultadoPossivelId: null,
				palpiteRotulo: null,
			},
		],
	};

	test("dono vê a seção e convida com sucesso", async ({ page }) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);

		await page.route("http://localhost:8080/auth/me", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "rafael@local", chavePix: "rafael@pix" }),
			}),
		);
		// Escopar para localhost:8080 (a API) — sem isso a route intercepta
		// também a NAVEGAÇÃO do front para /caixinhas/42 e devolve JSON
		// como página HTML, quebrando o teste.
		let callCount = 0;
		await page.route("http://localhost:8080/caixinhas/42", (r) => {
			callCount++;
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(caixinhaPayload),
			});
		});
		await page.route("http://localhost:8080/caixinhas/42/convites", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					convidados: ["alice@local"],
					jaPresentes: [],
				}),
			}),
		);

		await page.goto("/caixinhas/42");

		// O campo de convite (placeholder) só aparece para o dono.
		const campoConvite = page.getByPlaceholder("Convidar mais alguém por e-mail");
		await expect(campoConvite).toBeVisible();

		await campoConvite.fill("alice@local");
		await page.getByRole("button", { name: /Convidar/i }).click();

		// Feedback via toast global.
		await expect(page.getByText(/1 convidado/i)).toBeVisible();
		expect(callCount).toBeGreaterThanOrEqual(2); // recarregou após convidar
	});

	test("não-dono NÃO vê a seção", async ({ page }) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake-presence",
				url: "http://localhost:3000",
			},
		]);
		await page.route("http://localhost:8080/auth/me", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "outro@local", chavePix: null }),
			}),
		);
		await page.route("http://localhost:8080/caixinhas/42", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(caixinhaPayload),
			}),
		);
		await page.goto("/caixinhas/42");
		// O título da caixinha aparece, mas o campo de convidar (só do dono) não.
		await expect(page.getByText("Brasil x Marrocos")).toBeVisible();
		await expect(
			page.getByPlaceholder("Convidar mais alguém por e-mail"),
		).toHaveCount(0);
	});
});

/**
 * Story 2.5 — tela do convite e fluxo aceitar/palpitar.
 */
test.describe("/convites/[id] (Story 2.5)", () => {
	const conviteFuturo = {
		caixinhaId: 99,
		titulo: "Brasil x Marrocos",
		ladoA: "Brasil",
		ladoB: "Marrocos",
		valorIngresso: "40.00",
		taxaServico: "10.00",
		estado: "coletando_convites",
		prazoEntrada: "2027-06-01T12:00:00Z",
		resultadosPossiveis: [
			{ id: 10, ordem: 0, rotulo: "Vitória Brasil" },
			{ id: 11, ordem: 1, rotulo: "Empate" },
		],
		eu: {
			email: "alice@local",
			status: "convidado",
			palpiteResultadoPossivelId: null,
		},
	};

	const convitePassado = {
		...conviteFuturo,
		prazoEntrada: "2020-01-01T00:00:00Z",
		eu: { ...conviteFuturo.eu, status: "aceito" },
	};

	test("convidado vê botão 'Aceitar convite' e Resultados Possíveis", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake",
				url: "http://localhost:3000",
			},
		]);
		// v5 Story 2.5: /convites/[id] agora chama /auth/me para saber se há chave PIX.
		await page.route("http://localhost:8080/auth/me", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "alice@local", chavePix: "alice@pix" }),
			}),
		);
		await page.route("http://localhost:8080/caixinhas/99/convite", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(conviteFuturo),
			}),
		);

		await page.goto("/convites/99");
		await expect(page.getByRole("heading", { name: "Brasil x Marrocos" })).toBeVisible();
		await expect(page.getByRole("button", { name: /Aceitar convite/i })).toBeVisible();
		await expect(page.getByText("Vitória Brasil")).toBeVisible();
		await expect(page.getByText("Empate")).toBeVisible();
	});

	test("clicar em radio palpita (PUT /palpite)", async ({ page }) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake",
				url: "http://localhost:3000",
			},
		]);
		const conviteAceito = {
			...conviteFuturo,
			eu: { ...conviteFuturo.eu, status: "aceito" },
		};
		let putCalled = false;
		// v5: mock /auth/me com chave PIX cadastrada para não disparar o form.
		await page.route("http://localhost:8080/auth/me", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "alice@local", chavePix: "alice@pix" }),
			}),
		);
		await page.route("http://localhost:8080/caixinhas/99/convite", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(conviteAceito),
			}),
		);
		await page.route("http://localhost:8080/caixinhas/99/palpite", (r) => {
			putCalled = true;
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					id: 1,
					caixinhaId: 99,
					email: "alice@local",
					status: "aceito",
					dono: false,
					palpiteResultadoPossivelId: 10,
				}),
			});
		});

		await page.goto("/convites/99");
		// .click() em vez de .check(): o onChange dispara setAgindo(true) que
		// desabilita o fieldset (e o radio nunca é marcado pelo Playwright);
		// click é suficiente para disparar o handler.
		await page.getByRole("radio", { name: "Vitória Brasil" }).click();
		await expect(page.getByText(/Palpite salvo/i)).toBeVisible();
		expect(putCalled).toBe(true);
	});

	test("prazo passado: radios desabilitados + mensagem amigável", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake",
				url: "http://localhost:3000",
			},
		]);
		await page.route("http://localhost:8080/auth/me", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "alice@local", chavePix: "alice@pix" }),
			}),
		);
		await page.route("http://localhost:8080/caixinhas/99/convite", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(convitePassado),
			}),
		);

		await page.goto("/convites/99");
		await expect(page.getByText(/Palpite congelado/i)).toBeVisible();
		const radio = page.getByRole("radio", { name: "Vitória Brasil" });
		await expect(radio).toBeDisabled();
	});

	test("v5 FR-5: sem chave PIX, clicar em radio abre form e palpita após salvar", async ({
		page,
	}) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake",
				url: "http://localhost:3000",
			},
		]);
		const conviteAceito = {
			...conviteFuturo,
			eu: { ...conviteFuturo.eu, status: "aceito" },
		};
		// 1ª chamada: chavePix=null. Após PUT, retorna 'meu@pix' e os
		// próximos GETs já têm chave.
		let chaveAtual: string | null = null;
		await page.route("http://localhost:8080/auth/me", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "alice@local", chavePix: chaveAtual }),
			}),
		);
		await page.route("http://localhost:8080/auth/me/chave-pix", (r) => {
			chaveAtual = "alice@pix";
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "alice@local", chavePix: chaveAtual }),
			});
		});
		await page.route("http://localhost:8080/caixinhas/99/convite", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(conviteAceito),
			}),
		);
		await page.route("http://localhost:8080/caixinhas/99/palpite", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					id: 1,
					caixinhaId: 99,
					email: "alice@local",
					status: "aceito",
					dono: false,
					palpiteResultadoPossivelId: 10,
				}),
			}),
		);

		await page.goto("/convites/99");
		// Clicar em radio NÃO palpita ainda — abre o form de chave PIX.
		await page.getByRole("radio", { name: "Vitória Brasil" }).click();
		await expect(page.getByText(/Cadastre sua chave PIX/i)).toBeVisible();

		// Preenche a chave e salva — o palpite pendente é retomado.
		await page.getByLabel(/Sua chave PIX/i).fill("alice@pix");
		await page.getByRole("button", { name: /Salvar e palpitar/i }).click();
		await expect(page.getByText(/Palpite salvo/i)).toBeVisible();
	});

	test("404 → tela amigável 'Convite não encontrado'", async ({ page }) => {
		await page.context().addCookies([
			{
				name: "caixinhabet_sessao",
				value: "fake",
				url: "http://localhost:3000",
			},
		]);
		await page.route("http://localhost:8080/auth/me", (r) =>
			r.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ email: "alice@local", chavePix: null }),
			}),
		);
		await page.route("http://localhost:8080/caixinhas/99/convite", (r) =>
			r.fulfill({
				status: 404,
				contentType: "application/problem+json",
				body: JSON.stringify({
					type: "about:blank",
					title: "Not Found",
					status: 404,
					detail: "Caixinha não encontrada.",
				}),
			}),
		);

		await page.goto("/convites/99");
		await expect(
			page.getByText(/Convite não encontrado ou você não foi convidado/i),
		).toBeVisible();
	});
});
