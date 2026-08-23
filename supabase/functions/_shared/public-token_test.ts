import { assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1";
import { createPublicToken, hashPublicToken, ipPrefix } from "./public-token.ts";

Deno.test("public tokens are random URL-safe values and only hashes are persisted", async () => {
  const first = createPublicToken();
  const second = createPublicToken();

  assertMatch(first, /^[A-Za-z0-9_-]{43}$/);
  assertNotEquals(first, second);
  assertMatch(await hashPublicToken(first), /^[a-f0-9]{64}$/);
  assertNotEquals(await hashPublicToken(first), first);
});

Deno.test("IP addresses are truncated before proposal audit storage", () => {
  assertEquals(ipPrefix("203.0.113.42"), "203.0.113.0/24");
  assertEquals(ipPrefix("2001:db8:1234:5678:90ab:cdef:1234:5678"), "2001:db8:1234:5678::/64");
  assertEquals(ipPrefix(null), null);
});
