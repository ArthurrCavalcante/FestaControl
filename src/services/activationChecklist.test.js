import test from 'node:test';
import assert from 'node:assert/strict';

test('activation checklist separates required setup from optional WhatsApp', async () => {
  const module = await import('./activationChecklist.js').catch(() => ({}));
  assert.equal(typeof module.buildActivationChecklist, 'function');

  const result = module.buildActivationChecklist({
    hasCompanyDetails: true,
    inventoryCount: 2,
    memberCount: 1,
    invitationCount: 0,
    proposalCount: 1,
    whatsappConnected: false,
  });

  assert.equal(result.completedRequired, 3);
  assert.equal(result.requiredTotal, 4);
  assert.equal(result.steps.find((step) => step.id === 'whatsapp').optional, true);
});
