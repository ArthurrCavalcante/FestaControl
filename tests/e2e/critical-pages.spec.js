import { test, expect } from '@playwright/test';

async function stabilize(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
}

async function signInAsDemo(page) {
  await page.goto('/entrar');
  await page.getByRole('button', { name: 'Acessar como Visitante (Demo)' }).click();
  await expect(page.getByTitle('Menu da Conta')).toBeVisible({ timeout: 15_000 });
  await stabilize(page);
}

async function openSection(page, title) {
  const target = page.getByTitle(title);
  if (!(await target.isVisible())) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  }
  await target.click();
  await expect(page.getByText(/Carregando (informações|operação|módulo)/)).toHaveCount(0, { timeout: 15_000 });
}

test('login remains visually stable', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('button', { name: 'Entrar na Conta' })).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot('login.png', { animations: 'disabled', fullPage: true });
});

test('public product page remains visually stable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FestaControl' })).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot('public-product.png', { animations: 'disabled', fullPage: true });
});

test('public proposal can be reviewed and accepted idempotently', async ({ page }) => {
  await page.route('**/functions/v1/public-proposal**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, status: 'accepted' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        company: { nome: 'Festas Aurora' },
        settings: { pix_key: 'financeiro@festasaurora.test', primary_color: '#156f53' },
        proposal: {
          id: '00000000-0000-4000-8000-000000000001', version: 2, status: 'viewed', customer_name: 'Cliente piloto',
          event_date: '2026-09-20', event_address: 'Espaço Jardim', theme: 'Jardim colorido', valid_until: '2026-09-01',
          subtotal: 1200, discount: 100, total: 1100, terms: 'Sinal de 30% para confirmação.',
          proposal_items: [
            { description: 'Decoração completa', quantity: 1, unit_price: 900, sort_order: 0 },
            { description: 'Montagem e desmontagem', quantity: 1, unit_price: 300, sort_order: 1 },
          ],
        },
      }),
    });
  });
  await page.goto('/proposta/test-token-with-more-than-thirty-two-characters');
  await expect(page.getByText('Festas Aurora')).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot('public-proposal.png', { animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: 'Aceitar proposta' }).click();
  await expect(page.getByText(/Proposta aceita/)).toBeVisible();
});

test('invitation route offers account creation', async ({ page }) => {
  await page.goto('/convite/test-invitation-token');
  await expect(page.getByRole('button', { name: 'Entrar na Conta' })).toBeVisible();
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('heading', { name: 'FestaControl CRM' })).toBeVisible();
});

test.describe('authenticated critical pages', () => {
  test.skip(process.env.E2E_DEMO_ENABLED !== 'true', 'Requires the read-only FestaControl demo account.');

  test('Kanban remains visually stable', async ({ page }) => {
    await signInAsDemo(page);
    await openSection(page, 'Orçamentos (CRM)');
    await expect(page).toHaveScreenshot('kanban.png', { animations: 'disabled', fullPage: true });
  });

  test('agenda remains visually stable', async ({ page }) => {
    await signInAsDemo(page);
    await openSection(page, 'Agenda');
    await expect(page).toHaveScreenshot('agenda.png', { animations: 'disabled', fullPage: true });
  });

  test('inbox remains visually stable', async ({ page }) => {
    await signInAsDemo(page);
    await openSection(page, 'Inbox');
    await expect(page).toHaveScreenshot('inbox.png', { animations: 'disabled', fullPage: true });
  });

  test('event operations remain visually stable', async ({ page }) => {
    await signInAsDemo(page);
    await openSection(page, 'Operação');
    await expect(page).toHaveScreenshot('operacao.png', { animations: 'disabled', fullPage: true });
  });
});
