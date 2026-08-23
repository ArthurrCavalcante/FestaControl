import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { HttpError } from "./auth.ts";
import {
  assertEvolutionWebhookSecret,
  isUuid,
  nextWhatsAppCircuit,
  subscriptionCanWrite,
} from "./saas-security.ts";

Deno.test("Evolution webhook fails closed when the server secret is missing", () => {
  assertThrows(
    () => assertEvolutionWebhookSecret("anything", ""),
    HttpError,
    "Evolution webhook is not configured",
  );
});

Deno.test("Evolution webhook rejects a mismatched secret", () => {
  assertThrows(
    () => assertEvolutionWebhookSecret("wrong", "expected"),
    HttpError,
    "Unauthorized",
  );
});

Deno.test("Evolution webhook accepts the configured secret", () => {
  assertEvolutionWebhookSecret("expected", "expected");
});

Deno.test("tenant identifiers must be UUIDs", () => {
  assertEquals(isUuid("8478d6aa-4721-48bc-bbc9-dae4edab5c21"), true);
  assertEquals(isUuid("../../other-company"), false);
});

Deno.test("active and unexpired trial subscriptions can write", () => {
  const now = new Date("2026-08-22T12:00:00Z");
  assertEquals(subscriptionCanWrite({ status: "active" }, now), true);
  assertEquals(
    subscriptionCanWrite({ status: "trialing", trial_ends_at: "2026-08-23T00:00:00Z" }, now),
    true,
  );
});

Deno.test("expired or suspended subscriptions are read only", () => {
  const now = new Date("2026-08-22T12:00:00Z");
  assertEquals(
    subscriptionCanWrite({ status: "trialing", trial_ends_at: "2026-08-21T00:00:00Z" }, now),
    false,
  );
  assertEquals(subscriptionCanWrite({ status: "suspended" }, now), false);
});

Deno.test("WhatsApp circuit opens after three consecutive provider failures", () => {
  assertEquals(nextWhatsAppCircuit(1, false).open, false);
  assertEquals(nextWhatsAppCircuit(2, false).open, true);
  assertEquals(nextWhatsAppCircuit(8, true), { failures: 0, open: false });
});
