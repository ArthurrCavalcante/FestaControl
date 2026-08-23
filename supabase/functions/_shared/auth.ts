export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export type RequestContext<TClient = unknown> = {
  authorization: string;
  client: TClient;
  userId: string;
  companyId: string;
  isDemo: boolean;
  role?: "owner" | "manager" | "staff";
  subscription?: {
    status?: string | null;
    trial_ends_at?: string | null;
    grace_ends_at?: string | null;
  } | null;
};

type ContextResolver<TClient> = (
  authorization: string,
) => Promise<RequestContext<TClient> | null>;

export async function authenticateRequest<TClient>(
  req: Request,
  resolveContext: ContextResolver<TClient>,
): Promise<RequestContext<TClient>> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) {
    throw new HttpError(401, "Unauthorized");
  }

  try {
    const context = await resolveContext(authorization);
    if (!context) throw new HttpError(401, "Unauthorized");
    return context;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(401, "Unauthorized");
  }
}

export function requireLiveTenant(context: Pick<RequestContext, "isDemo">): void {
  if (context.isDemo) {
    throw new HttpError(403, "External actions are disabled for demo tenants");
  }
}

export function requireTenantResource<T extends { company_id: string }>(
  resource: T | null,
  companyId: string,
): T {
  if (!resource || resource.company_id !== companyId) {
    throw new HttpError(404, "Resource not found");
  }
  return resource;
}

export function errorResponse(error: unknown, headers: HeadersInit = {}): Response {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : "Internal server error";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
