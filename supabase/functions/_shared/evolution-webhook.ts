import { HttpError } from "./auth.ts";

export function buildEvolutionWebhookConfig(urlValue: string | undefined, secretValue: string | undefined) {
  const url = urlValue?.trim();
  const secret = secretValue?.trim();
  if (!url || !secret) throw new HttpError(502, "WhatsApp webhook is not configured");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new HttpError(502, "WhatsApp webhook URL is invalid");
  }
  if (parsedUrl.protocol !== "https:") throw new HttpError(502, "WhatsApp webhook must use HTTPS");

  return {
    url: parsedUrl.toString(),
    byEvents: false,
    base64: false,
    headers: { "x-webhook-secret": secret },
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
  };
}

export function buildEvolutionWebhookSetPayload(
  webhook: ReturnType<typeof buildEvolutionWebhookConfig>,
) {
  return {
    webhook: {
      enabled: true,
      url: webhook.url,
      webhookByEvents: webhook.byEvents,
      webhookBase64: webhook.base64,
      headers: webhook.headers,
      events: webhook.events,
    },
  };
}
