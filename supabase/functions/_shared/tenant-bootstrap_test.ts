import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";

const module = await import("./tenant-bootstrap.ts").catch(() => ({}));
const validate = (module as Record<string, unknown>).validateTenantBootstrapInput as
  | undefined
  | ((value: unknown) => { companyName: string; userName: string; phone: string | null; pixKey: string | null });

Deno.test("tenant bootstrap trims and limits onboarding input", () => {
  assertEquals(typeof validate, "function");
  assertEquals(validate?.({ company_name: "  Festa Feliz  ", user_name: "  Ana  ", phone: " 11999999999 ", pix_key: " " }), {
    companyName: "Festa Feliz",
    userName: "Ana",
    phone: "11999999999",
    pixKey: null,
  });
});

Deno.test("tenant bootstrap rejects invalid names and oversized optional fields", () => {
  assertEquals(typeof validate, "function");
  assertThrows(() => validate?.({ company_name: "x", user_name: "Ana" }), Error, "Nome da empresa");
  assertThrows(() => validate?.({ company_name: "Festa Feliz", user_name: "A" }), Error, "Nome do usuário");
  assertThrows(() => validate?.({ company_name: "Festa Feliz", user_name: "Ana", pix_key: "x".repeat(201) }), Error, "Chave PIX");
});
