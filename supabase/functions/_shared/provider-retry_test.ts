import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";

const retry = await import("./provider-retry.ts").catch(() => ({}));
const ProviderHttpError = (retry as Record<string, unknown>).ProviderHttpError as
  | undefined
  | (new (status: number, message: string) => Error);
const sendWithProviderRetry = (retry as Record<string, unknown>).sendWithProviderRetry as
  | undefined
  | (<T>(operation: () => Promise<T>, options?: Record<string, unknown>) => Promise<T>);

Deno.test("provider send retries an explicit temporary rejection", async () => {
  assertEquals(typeof ProviderHttpError, "function");
  assertEquals(typeof sendWithProviderRetry, "function");

  let attempts = 0;
  const delays: number[] = [];
  const result = await sendWithProviderRetry?.(async () => {
    attempts += 1;
    if (attempts === 1) throw new ProviderHttpError!(429, "busy");
    return "sent";
  }, {
    maxAttempts: 2,
    sleep: (delay: number) => { delays.push(delay); return Promise.resolve(); },
  });

  assertEquals(result, "sent");
  assertEquals(attempts, 2);
  assertEquals(delays, [250]);
});

Deno.test("provider send does not retry ambiguous network errors", async () => {
  assertEquals(typeof sendWithProviderRetry, "function");
  let attempts = 0;

  await assertRejects(() => sendWithProviderRetry!(async () => {
    attempts += 1;
    throw new TypeError("connection reset");
  }, { maxAttempts: 3, sleep: () => Promise.resolve() }));

  assertEquals(attempts, 1);
});

Deno.test("provider send does not retry permanent provider errors", async () => {
  assertEquals(typeof ProviderHttpError, "function");
  assertEquals(typeof sendWithProviderRetry, "function");
  let attempts = 0;

  await assertRejects(() => sendWithProviderRetry!(async () => {
    attempts += 1;
    throw new ProviderHttpError!(400, "bad request");
  }, { maxAttempts: 3, sleep: () => Promise.resolve() }));

  assertEquals(attempts, 1);
});
