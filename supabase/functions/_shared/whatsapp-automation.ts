type WelcomeSettings = {
  welcome_enabled?: unknown;
  welcome_message?: unknown;
};

type MessageContext = {
  isNewConversation: boolean;
  fromMe: boolean;
};

export function normalizeEvolutionState(payload: Record<string, unknown>): "connected" | "connecting" | "disconnected" {
  const instance = payload.instance as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;
  const stateValue = payload.state;
  const nestedState = typeof stateValue === "object" && stateValue
    ? stateValue as Record<string, unknown>
    : undefined;
  const nestedInstance = nestedState?.instance as Record<string, unknown> | undefined;
  const rawState = instance?.state ?? data?.state ?? nestedInstance?.state ?? nestedState?.state ?? stateValue;
  const state = String(rawState ?? "").toLowerCase();

  if (["open", "connected", "online"].includes(state)) return "connected";
  if (["connecting", "qr", "pairing"].includes(state)) return "connecting";
  return "disconnected";
}

export function getWelcomeReply(settings: WelcomeSettings, context: MessageContext): string | null {
  if (!context.isNewConversation || context.fromMe || settings.welcome_enabled !== true) return null;
  if (typeof settings.welcome_message !== "string") return null;

  const message = settings.welcome_message.trim();
  if (!message || message.length > 1_000) return null;
  return message;
}
