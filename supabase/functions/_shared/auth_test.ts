import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.14";
import {
  authenticateRequest,
  HttpError,
  requireTenantResource,
  requireLiveTenant,
} from "./auth.ts";

const request = (authorization?: string) =>
  new Request("https://example.test", {
    headers: authorization ? { Authorization: authorization } : {},
  });

Deno.test("missing bearer token is rejected before identity lookup", async () => {
  let called = false;
  const error = await assertRejects(
    () => authenticateRequest(request(), async () => {
      called = true;
      throw new Error("must not run");
    }),
    HttpError,
  );

  assertEquals((error as HttpError).status, 401);
  assertEquals(called, false);
});

Deno.test("invalid bearer token returns 401", async () => {
  const error = await assertRejects(
    () => authenticateRequest(request("Bearer invalid"), async () => null),
    HttpError,
  );

  assertEquals((error as HttpError).status, 401);
});

Deno.test("authenticated context preserves tenant and demo status", async () => {
  const context = await authenticateRequest(
    request("Bearer valid-token"),
    async (authorization: string) => ({
      authorization,
      client: { kind: "user-client" },
      userId: "user-a",
      companyId: "company-a",
      isDemo: true,
    }),
  );

  assertEquals(context.companyId, "company-a");
  assertEquals(context.isDemo, true);
  assertEquals(context.authorization, "Bearer valid-token");
});

Deno.test("demo tenant is blocked before external work", () => {
  const error = (() => {
    try {
      requireLiveTenant({ isDemo: true });
      return null;
    } catch (caught) {
      return caught;
    }
  })();

  assertEquals(error instanceof HttpError, true);
  assertEquals((error as HttpError).status, 403);
});

Deno.test("own tenant resource is returned and foreign resource is hidden as 404", () => {
  const own = requireTenantResource({ id: "resource-a", company_id: "company-a" }, "company-a");
  assertEquals(own.id, "resource-a");

  const error = (() => {
    try {
      requireTenantResource({ id: "resource-b", company_id: "company-b" }, "company-a");
      return null;
    } catch (caught) {
      return caught;
    }
  })();
  assertEquals(error instanceof HttpError, true);
  assertEquals((error as HttpError).status, 404);
});
