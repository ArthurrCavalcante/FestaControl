import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as automation from "./whatsapp-automation.ts";

const { getWelcomeReply } = automation;
const normalizeEvolutionState = (automation as unknown as Record<string, unknown>).normalizeEvolutionState as
  | undefined
  | ((payload: Record<string, unknown>) => string);
const isEvolutionAlreadyDisconnected = (automation as unknown as Record<string, unknown>).isEvolutionAlreadyDisconnected as
  | undefined
  | ((status: number, payload: Record<string, unknown>) => boolean);

Deno.test("Evolution connection states are normalized", () => {
  assertEquals(typeof normalizeEvolutionState, "function");
  assertEquals(normalizeEvolutionState?.({ instance: { state: "open" } }), "connected");
  assertEquals(normalizeEvolutionState?.({ event: "connection.update", data: { state: "open" } }), "connected");
  assertEquals(normalizeEvolutionState?.({ state: "connecting" }), "connecting");
  assertEquals(normalizeEvolutionState?.({ instance: { state: "close" } }), "disconnected");
});

Deno.test("logout is idempotent when Evolution reports an already closed instance", () => {
  assertEquals(typeof isEvolutionAlreadyDisconnected, "function");
  assertEquals(isEvolutionAlreadyDisconnected?.(404, {}), true);
  assertEquals(isEvolutionAlreadyDisconnected?.(400, {
    response: { message: ['The instance is not connected'] },
  }), true);
  assertEquals(isEvolutionAlreadyDisconnected?.(502, { error: 'provider unavailable' }), false);
});

Deno.test("welcome automation only replies after an atomic delivery claim", () => {
  assertEquals(typeof getWelcomeReply, "function");
  const settings = {
    welcome_enabled: true,
    welcome_message: "  Obrigado pelo contato!  ",
  };

  assertEquals(getWelcomeReply(settings, { deliveryClaimed: true, fromMe: false }), "Obrigado pelo contato!");
  assertEquals(getWelcomeReply(settings, { deliveryClaimed: false, fromMe: false }), null);
  assertEquals(getWelcomeReply(settings, { deliveryClaimed: true, fromMe: true }), null);
});

Deno.test("welcome automation fails closed for invalid configuration", () => {
  assertEquals(typeof getWelcomeReply, "function");
  assertEquals(getWelcomeReply({ welcome_enabled: false, welcome_message: "Oi" }, { deliveryClaimed: true, fromMe: false }), null);
  assertEquals(getWelcomeReply({ welcome_enabled: true, welcome_message: " " }, { deliveryClaimed: true, fromMe: false }), null);
  assertEquals(getWelcomeReply({ welcome_enabled: true, welcome_message: "x".repeat(1001) }, { deliveryClaimed: true, fromMe: false }), null);
});
