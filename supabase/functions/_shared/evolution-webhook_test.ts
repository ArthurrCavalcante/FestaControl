import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildEvolutionWebhookConfig,
  buildEvolutionWebhookSetPayload,
} from "./evolution-webhook.ts";

Deno.test("Evolution webhook configuration carries the shared secret and inbound event", () => {
  assertEquals(buildEvolutionWebhookConfig("https://example.test/webhook", "secret-value"), {
    url: "https://example.test/webhook",
    byEvents: false,
    base64: false,
    headers: { "x-webhook-secret": "secret-value" },
    events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
  });
});

Deno.test("Evolution connection fails closed without webhook configuration", () => {
  assertThrows(() => buildEvolutionWebhookConfig("", "secret-value"));
  assertThrows(() => buildEvolutionWebhookConfig("https://example.test/webhook", ""));
});

Deno.test("Evolution webhook set payload uses the v2 nested contract", () => {
  const webhook = buildEvolutionWebhookConfig("https://example.test/webhook", "secret-value");

  assertEquals(buildEvolutionWebhookSetPayload(webhook), {
    webhook: {
      enabled: true,
      url: "https://example.test/webhook",
      webhookByEvents: false,
      webhookBase64: false,
      headers: { "x-webhook-secret": "secret-value" },
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    },
  });
});
