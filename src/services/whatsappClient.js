const MAX_MESSAGE_LENGTH = 4_000;

export function normalizeConnectionState(payload) {
  const rawState = payload?.instance?.state
    ?? payload?.state?.instance?.state
    ?? payload?.state?.state
    ?? payload?.state
    ?? payload?.instance?.connectionStatus;
  const state = String(rawState ?? '').toLowerCase();

  if (['open', 'connected', 'online'].includes(state)) return 'connected';
  if (['connecting', 'qr', 'pairing'].includes(state)) return 'connecting';
  return 'disconnected';
}

export function startWhatsAppStatusPolling(checkStatus, options = {}) {
  const setIntervalFn = options.setIntervalFn ?? window.setInterval.bind(window);
  const clearIntervalFn = options.clearIntervalFn ?? window.clearInterval.bind(window);
  const runCheck = () => Promise.resolve(checkStatus()).catch(() => undefined);

  void runCheck();
  const intervalId = setIntervalFn(runCheck, 5_000);
  return () => clearIntervalFn(intervalId);
}

export function shouldPollWhatsAppStatus(status) {
  return status === 'connecting' || status === 'connected';
}

export async function sendWhatsAppReply(client, conversationId, content) {
  const normalizedContent = String(content ?? '').trim();
  if (!normalizedContent) throw new Error('Escreva uma mensagem antes de enviar.');
  if (normalizedContent.length > MAX_MESSAGE_LENGTH) throw new Error('A mensagem deve ter no máximo 4.000 caracteres.');

  const { data, error } = await client.functions.invoke('send-message', {
    body: { conversation_id: conversationId, content: normalizedContent },
  });
  if (error) throw error;
  if (!data?.message) throw new Error('O provedor não confirmou o envio da mensagem.');
  return data.message;
}
