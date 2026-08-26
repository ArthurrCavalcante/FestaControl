import test from 'node:test';
import assert from 'node:assert/strict';

test('product analytics removes PII-like properties', async () => {
  const module = await import('./productAnalytics.js').catch(() => ({}));
  assert.equal(typeof module.sanitizeProductProperties, 'function');

  assert.deepEqual(module.sanitizeProductProperties({
    source: 'settings',
    connected: true,
    email: 'cliente@example.com',
    telefone: '11999999999',
    message: 'conteudo privado',
    nested: { safe: false },
  }), { source: 'settings', connected: true });
});

test('product analytics only accepts known activation events', async () => {
  const module = await import('./productAnalytics.js').catch(() => ({}));
  assert.equal(typeof module.isProductEventAllowed, 'function');
  assert.equal(module.isProductEventAllowed('page_viewed'), true);
  assert.equal(module.isProductEventAllowed('whatsapp_message_sent'), true);
  assert.equal(module.isProductEventAllowed('customer_phone_captured'), false);
});

test('product analytics summarizes company activation without PII', async () => {
  const module = await import('./productAnalytics.js');
  assert.equal(typeof module.summarizeProductEvents, 'function');
  const summary = module.summarizeProductEvents([
    { company_id: 'a', event_name: 'app_opened' },
    { company_id: 'a', event_name: 'page_viewed' },
    { company_id: 'b', event_name: 'proposal_sent' },
    { company_id: 'b', event_name: 'whatsapp_connected' },
  ]);
  assert.deepEqual(summary, { activeCompanies: 1, proposingCompanies: 1, whatsappCompanies: 1 });
});

test('operational health flags failures and tenant integrity issues without exposing log contents', async () => {
  const module = await import('./productAnalytics.js');
  assert.equal(typeof module.summarizeOperationalHealth, 'function');
  assert.deepEqual(module.summarizeOperationalHealth({ errors_24h: 2, failed_events_24h: 1, orphan_tenants: 3 }), {
    errors24h: 2,
    failedEvents24h: 1,
    orphanTenants: 3,
    status: 'attention',
  });
  assert.equal(module.summarizeOperationalHealth({}).status, 'healthy');
});
