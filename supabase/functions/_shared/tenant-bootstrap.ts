import { HttpError } from "./auth.ts";

type BootstrapInput = {
  company_name?: unknown;
  user_name?: unknown;
  phone?: unknown;
  pix_key?: unknown;
};

function optionalText(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new HttpError(400, `${label} inválido.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 200) throw new HttpError(400, `${label} muito longo.`);
  return normalized;
}

export function validateTenantBootstrapInput(value: unknown) {
  const input = (value && typeof value === "object" ? value : {}) as BootstrapInput;
  const companyName = typeof input.company_name === "string" ? input.company_name.trim() : "";
  const userName = typeof input.user_name === "string" ? input.user_name.trim() : "";
  if (companyName.length < 2 || companyName.length > 120) throw new HttpError(400, "Nome da empresa inválido.");
  if (userName.length < 2 || userName.length > 120) throw new HttpError(400, "Nome do usuário inválido.");

  return {
    companyName,
    userName,
    phone: optionalText(input.phone, "Telefone"),
    pixKey: optionalText(input.pix_key, "Chave PIX"),
  };
}
