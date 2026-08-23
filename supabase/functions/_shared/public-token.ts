function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function createPublicToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashPublicToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ipPrefix(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",", 1)[0].trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(first)) {
    const octets = first.split(".").map(Number);
    if (octets.every((part) => part >= 0 && part <= 255)) return `${octets.slice(0, 3).join(".")}.0/24`;
    return null;
  }
  if (first.includes(":")) {
    const groups = first.split(":").filter(Boolean).slice(0, 4);
    return groups.length >= 2 ? `${groups.join(":")}::/64` : null;
  }
  return null;
}
