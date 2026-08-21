import { test, expect } from '@playwright/test';

async function stabilize(page) {
  await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }' });
}

async function signInAsDemo(page) {
  await page.goto('/');
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
  await expect(page.getByText('Carregando informações...')).toHaveCount(0, { timeout: 15_000 });
}

test('login remains visually stable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Entrar na Conta' })).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot('login.png', { animations: 'disabled', fullPage: true });
});

test.describe('authenticated critical pages', () => {
  test.skip(process.env.E2E_DEMO_ENABLED !== 'true', 'Requires the read-only FestaFlow demo account.');

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
