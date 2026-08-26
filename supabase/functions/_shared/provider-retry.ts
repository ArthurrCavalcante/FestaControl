export class ProviderHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

type RetryOptions = {
  maxAttempts?: number;
  sleep?: (delay: number) => Promise<void>;
};

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export async function sendWithProviderRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.min(3, Math.max(1, options.maxAttempts ?? 2));
  const sleep = options.sleep ?? ((delay: number) => new Promise((resolve) => setTimeout(resolve, delay)));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable = error instanceof ProviderHttpError && RETRYABLE_STATUSES.has(error.status);
      if (!retryable || attempt === maxAttempts) throw error;
      await sleep(250 * (2 ** (attempt - 1)));
    }
  }

  throw new Error("Provider retry exhausted");
}
