import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import * as automation from "./whatsapp-automation.ts";

const { getWelcomeReply } = automation;
const normalizeEvolutionState = (automation as unknown as Record<string, unknown>).normalizeEvolutionState as
  | undefined
  | ((payload: Record<string, unknown>) => string);

Deno.test("Evolution connection states are normalized", () => {
  assertEquals(typeof normalizeEvolutionState, "function");
  assertEquals(normalizeEvolutionState?.({ instance: { state: "open" } }), "connected");
  assertEquals(normalizeEvolutionState?.({ event: "connection.update", data: { state: "open" } }), "connected");
  assertEquals(normalizeEvolutionState?.({ state: "connecting" }), "connecting");
  assertEquals(normalizeEvolutionState?.({ instance: { state: "close" } }), "disconnected");
});

Deno.test("welcome automation only replies to the first inbound message", () => {
  assertEquals(typeof getWelcomeReply, "function");
  const settings = {
    welcome_enabled: true,
    welcome_message: "  Obrigado pelo contato!  ",
  };

  assertEquals(getWelcomeReply(settings, { isNewConversation: true, fromMe: false }), "Obrigado pelo contato!");
  assertEquals(getWelcomeReply(settings, { isNewConversation: false, fromMe: false }), null);
  assertEquals(getWelcomeReply(settings, { isNewConversation: true, fromMe: true }), null);
});

Deno.test("welcome automation fails closed for invalid configuration", () => {
  assertEquals(typeof getWelcomeReply, "function");
  assertEquals(getWelcomeReply({ welcome_enabled: false, welcome_message: "Oi" }, { isNewConversation: true, fromMe: false }), null);
  assertEquals(getWelcomeReply({ welcome_enabled: true, welcome_message: " " }, { isNewConversation: true, fromMe: false }), null);
  assertEquals(getWelcomeReply({ welcome_enabled: true, welcome_message: "x".repeat(1001) }, { isNewConversation: true, fromMe: false }), null);
});
