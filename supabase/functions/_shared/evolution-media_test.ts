import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const media = await import("./evolution-media.ts").catch(() => ({}));
const decodeEvolutionMedia = (media as Record<string, unknown>).decodeEvolutionMedia as
  | undefined
  | ((payload: Record<string, unknown>, maxBytes?: number) => Promise<{ bytes: Uint8Array; mimeType: string; extension: string }>);
const buildPrivateMediaPath = (media as Record<string, unknown>).buildPrivateMediaPath as
  | undefined
  | ((companyId: string, conversationId: string, messageId: string, extension: string) => string);

Deno.test("Evolution media is decoded only for an allowed MIME type", async () => {
  assertEquals(typeof decodeEvolutionMedia, "function");
  const decoded = await decodeEvolutionMedia?.({
    base64: btoa("image"),
    mimetype: "image/jpeg",
  });

  assertEquals(new TextDecoder().decode(decoded?.bytes), "image");
  assertEquals(decoded?.mimeType, "image/jpeg");
  assertEquals(decoded?.extension, "jpg");
});

Deno.test("Evolution media rejects disallowed and oversized files", async () => {
  assertEquals(typeof decodeEvolutionMedia, "function");
  await assertRejects(() => decodeEvolutionMedia!({ base64: btoa("x"), mimetype: "text/html" }));
  await assertRejects(() => decodeEvolutionMedia!({ base64: btoa("too big"), mimetype: "audio/ogg" }, 3));
});

Deno.test("Evolution Buffer payloads are decoded without spreading large arrays", async () => {
  assertEquals(typeof decodeEvolutionMedia, "function");
  const source = new Array(200_000).fill(65);
  const decoded = await decodeEvolutionMedia?.({
    base64: { type: "Buffer", data: source },
    mimetype: "application/pdf",
  }, 250_000);

  assertEquals(decoded?.bytes.length, source.length);
  assertEquals(decoded?.bytes[0], 65);
});

Deno.test("private media path cannot escape its tenant and conversation", () => {
  assertEquals(typeof buildPrivateMediaPath, "function");
  assertEquals(
    buildPrivateMediaPath?.("company-1", "conversation-1", "../message:1", "JPG"),
    "companies/company-1/conversations/conversation-1/message-1.jpg",
  );
});
