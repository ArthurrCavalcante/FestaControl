import { assertEquals } from "jsr:@std/assert@1.0.14";
import { validateThemePayload } from "./theme-validation.ts";

Deno.test("theme analysis accepts the legacy single-image body", () => {
  const result = validateThemePayload({ imageBase64: "a".repeat(64) });
  assertEquals(result.ok, true);
  if (result.ok) assertEquals(result.images.length, 1);
});

Deno.test("theme analysis rejects too many images", () => {
  const result = validateThemePayload({ imagesBase64: Array(6).fill("abc") });
  assertEquals(result, { ok: false, status: 413, error: "Too many images" });
});

Deno.test("theme analysis rejects oversized and malformed image values", () => {
  const oversized = validateThemePayload({ imageBase64: "a".repeat(7_000_001) });
  const malformed = validateThemePayload({ imagesBase64: [42] });

  assertEquals(oversized.ok, false);
  assertEquals(oversized.ok ? 0 : oversized.status, 413);
  assertEquals(malformed, { ok: false, status: 400, error: "Invalid image payload" });
});
