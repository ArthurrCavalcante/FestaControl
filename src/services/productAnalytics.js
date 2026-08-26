const ALLOWED_EVENTS = new Set([
  'app_opened',
  'page_viewed',
  'onboarding_completed',
  'onboarding_step_completed',
  'proposal_created',
  'proposal_sent',
  'proposal_viewed',
  'proposal_accepted',
  'deposit_received',
  'event_completed',
  'whatsapp_connection_started',
  'whatsapp_connected',
  'whatsapp_message_sent',
  'whatsapp_auto_reply_sent',
  'invitation_accepted',
]);

const BLOCKED_PROPERTY = /email|phone|telefone|celular|message|mensagem|content|conteudo|name|nome|address|endereco|pix|document|documento|token|secret/i;

export function isProductEventAllowed(eventName) {
  return ALLOWED_EVENTS.has(eventName);
}

export function sanitizeProductProperties(properties = {}) {
  return Object.fromEntries(Object.entries(properties).filter(([key, value]) => {
    if (BLOCKED_PROPERTY.test(key)) return false;
    return value === null || ['string', 'number', 'boolean'].includes(typeof value);
  }));
}

export async function trackProductEvent(client, context, eventName, properties = {}) {
  if (!isProductEventAllowed(eventName) || !context?.companyId) return false;
  const { error } = await client.from('product_events').insert({
    company_id: context.companyId,
    user_id: context.userId ?? null,
    event_name: eventName,
    properties: sanitizeProductProperties(properties),
  });
  return !error;
}

export function summarizeProductEvents(events = []) {
  const companiesFor = (eventNames) => new Set(events
    .filter((event) => eventNames.includes(event.event_name))
    .map((event) => event.company_id)
    .filter(Boolean)).size;
  return {
    activeCompanies: companiesFor(['app_opened', 'page_viewed']),
    proposingCompanies: companiesFor(['proposal_created', 'proposal_sent']),
    whatsappCompanies: companiesFor(['whatsapp_connected', 'whatsapp_message_sent', 'whatsapp_auto_reply_sent']),
  };
}

export function summarizeOperationalHealth(health = {}) {
  const errors24h = Number(health.errors_24h || 0);
  const failedEvents24h = Number(health.failed_events_24h || 0);
  const orphanTenants = Number(health.orphan_tenants || 0);
  return {
    errors24h,
    failedEvents24h,
    orphanTenants,
    status: errors24h + failedEvents24h + orphanTenants > 0 ? 'attention' : 'healthy',
  };
}
