import { assertEquals } from "jsr:@std/assert@1.0.14";
import { resolveConnectedCompany, verifyMetaSignature } from "./webhook-security.ts";

const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");

Deno.test("valid Meta HMAC is accepted", async () => {
  const payload = '{"object":"page"}';
  const secret = "test-only-secret";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = `sha256=${hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))}`;

  assertEquals(await verifyMetaSignature(payload, signature, secret), true);
});

Deno.test("malformed and incorrect Meta signatures are rejected without throwing", async () => {
  assertEquals(await verifyMetaSignature("{}", "sha256=not-hex", "secret"), false);
  assertEquals(await verifyMetaSignature("{}", "sha1=00", "secret"), false);
  assertEquals(await verifyMetaSignature("{}", `sha256=${"00".repeat(32)}`, "secret"), false);
});

Deno.test("webhook without a matching connection is ignored without tenant fallback", async () => {
  const companyId = await resolveConnectedCompany("instagram", "external-unknown", async () => null);
  assertEquals(companyId, null);
});
