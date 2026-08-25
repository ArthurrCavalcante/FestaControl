import test from 'node:test';
import assert from 'node:assert/strict';

test('normalizes Evolution connection states for the UI', async () => {
  const module = await import('./whatsappClient.js').catch(() => ({}));
  assert.equal(typeof module.normalizeConnectionState, 'function');
  assert.equal(module.normalizeConnectionState({ instance: { state: 'open' } }), 'connected');
  assert.equal(module.normalizeConnectionState({ state: { instance: { state: 'open' } } }), 'connected');
  assert.equal(module.normalizeConnectionState({ state: 'connecting' }), 'connecting');
  assert.equal(module.normalizeConnectionState({ instance: { state: 'close' } }), 'disconnected');
});

test('starts WhatsApp status polling immediately and cleans up the interval', async () => {
  const module = await import('./whatsappClient.js').catch(() => ({}));
  assert.equal(typeof module.startWhatsAppStatusPolling, 'function');

  let checks = 0;
  let scheduledCallback;
  let clearedId;
  const stop = module.startWhatsAppStatusPolling(
    () => { checks += 1; },
    {
      setIntervalFn: (callback, interval) => {
        assert.equal(interval, 5_000);
        scheduledCallback = callback;
        return 42;
      },
      clearIntervalFn: (id) => { clearedId = id; },
    },
  );

  assert.equal(checks, 1);
  scheduledCallback();
  assert.equal(checks, 2);
  stop();
  assert.equal(clearedId, 42);
});

test('polls while connecting or connected so external logout is detected', async () => {
  const module = await import('./whatsappClient.js').catch(() => ({}));
  assert.equal(typeof module.shouldPollWhatsAppStatus, 'function');
  assert.equal(module.shouldPollWhatsAppStatus('connecting'), true);
  assert.equal(module.shouldPollWhatsAppStatus('connected'), true);
  assert.equal(module.shouldPollWhatsAppStatus('disconnected'), false);
  assert.equal(module.shouldPollWhatsAppStatus('error'), false);
});

test('sends a reply through the protected Edge Function contract', async () => {
  const module = await import('./whatsappClient.js').catch(() => ({}));
  assert.equal(typeof module.sendWhatsAppReply, 'function');

  const calls = [];
  const client = {
    functions: {
      invoke: async (name, options) => {
        calls.push([name, options]);
        return { data: { message: { id: 'message-1', content: 'Oi!' } }, error: null };
      },
    },
  };

  const message = await module.sendWhatsAppReply(client, 'conversation-1', '  Oi!  ');
  assert.deepEqual(calls, [['send-message', { body: { conversation_id: 'conversation-1', content: 'Oi!' } }]]);
  assert.equal(message.id, 'message-1');
});

test('rejects empty or oversized WhatsApp replies before network work', async () => {
  const module = await import('./whatsappClient.js').catch(() => ({}));
  assert.equal(typeof module.sendWhatsAppReply, 'function');
  const client = { functions: { invoke: () => assert.fail('network should not be called') } };

  await assert.rejects(() => module.sendWhatsAppReply(client, 'conversation-1', '   '), /mensagem/i);
  await assert.rejects(() => module.sendWhatsAppReply(client, 'conversation-1', 'x'.repeat(4001)), /4.000/);
});
