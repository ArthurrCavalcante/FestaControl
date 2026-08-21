const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;

export async function resolveConnectedCompany(
  platform: string,
  externalId: string | null,
  lookup: (platform: string, externalId: string) => Promise<string | null>,
): Promise<string | null> {
  if (!externalId) return null;
  return await lookup(platform, externalId);
}

export async function verifyMetaSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const match = SIGNATURE_PATTERN.exec(signature);
  if (!secret || !match) return false;

  try {
    const signatureBytes = new Uint8Array(
      match[1].match(/.{2}/g)!.map((value) => Number.parseInt(value, 16)),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}
