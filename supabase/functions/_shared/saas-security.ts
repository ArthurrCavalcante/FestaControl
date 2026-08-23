import { HttpError } from "./auth.ts";

type Subscription = {
  status?: string | null;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function assertEvolutionWebhookSecret(provided: string | null, expected: string): void {
  if (!expected) throw new HttpError(503, "Evolution webhook is not configured");
  if (!provided || provided.length !== expected.length) throw new HttpError(401, "Unauthorized");

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  if (difference !== 0) throw new HttpError(401, "Unauthorized");
}

export function subscriptionCanWrite(subscription: Subscription | null, now = new Date()): boolean {
  if (!subscription) return false;
  if (subscription.status === "active") return true;
  if (subscription.status === "past_due" && subscription.grace_ends_at) {
    return new Date(subscription.grace_ends_at).getTime() > now.getTime();
  }
  if (subscription.status !== "trialing" || !subscription.trial_ends_at) return false;
  return new Date(subscription.trial_ends_at).getTime() > now.getTime();
}

export function nextWhatsAppCircuit(currentFailures: number, success: boolean) {
  if (success) return { failures: 0, open: false };
  const failures = Math.max(0, currentFailures) + 1;
  return { failures, open: failures >= 3 };
}
