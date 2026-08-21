import * as Sentry from "npm:@sentry/deno@10.70.0";

let initialized = false;

function initializeSentry(): boolean {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return false;
  if (!initialized) {
    Sentry.init({
      dsn,
      environment: Deno.env.get("SENTRY_ENVIRONMENT") ?? "production",
      defaultIntegrations: false,
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.Authorization;
            delete event.request.headers.apikey;
          }
        }
        delete event.user;
        event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
          ...breadcrumb,
          message: breadcrumb.message ? "[redacted]" : undefined,
          data: undefined,
        }));
        return event;
      },
    });
    initialized = true;
  }
  return true;
}

export async function captureEdgeError(error: unknown, functionName: string, req?: Request): Promise<void> {
  if (!initializeSentry()) return;
  Sentry.withScope((scope) => {
    scope.setTag("edge_function", functionName);
    if (req) {
      const url = new URL(req.url);
      scope.setContext("request", { method: req.method, path: url.pathname });
    }
    Sentry.captureException(error);
  });
  await Sentry.flush(2_000);
}
