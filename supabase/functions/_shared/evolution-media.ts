const MIME_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["audio/ogg", "ogg"],
  ["audio/mpeg", "mp3"],
  ["audio/mp4", "m4a"],
  ["audio/webm", "webm"],
  ["audio/wav", "wav"],
  ["application/pdf", "pdf"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["application/vnd.ms-excel", "xls"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
]);

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function normalizeMimeType(value: unknown): string {
  return String(value ?? "").split(";", 1)[0].trim().toLowerCase();
}

function base64String(payload: Record<string, unknown>): string {
  if (typeof payload.base64 === "string") return payload.base64.replace(/^data:[^;]+;base64,/, "");
  throw new Error("Evolution did not return media bytes.");
}

function bufferBytes(payload: Record<string, unknown>, maxBytes: number): Uint8Array | null {
  const base64 = payload.base64 as { data?: unknown } | undefined;
  if (!Array.isArray(base64?.data)) return null;
  if (base64.data.length > maxBytes) throw new Error("WhatsApp media exceeds the 10 MB limit.");

  const bytes = new Uint8Array(base64.data.length);
  for (let index = 0; index < base64.data.length; index += 1) {
    const value = Number(base64.data[index]);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("Evolution returned invalid media bytes.");
    }
    bytes[index] = value;
  }
  return bytes;
}

export async function decodeEvolutionMedia(
  payload: Record<string, unknown>,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<{ bytes: Uint8Array; mimeType: string; extension: string }> {
  const mimeType = normalizeMimeType(payload.mimetype ?? payload.mimeType);
  const extension = MIME_EXTENSIONS.get(mimeType);
  if (!extension) throw new Error("Unsupported WhatsApp media type.");

  const directBytes = bufferBytes(payload, maxBytes);
  if (directBytes) return { bytes: directBytes, mimeType, extension };

  const encoded = base64String(payload);
  const estimatedBytes = Math.floor((encoded.length * 3) / 4);
  if (estimatedBytes > maxBytes) throw new Error("WhatsApp media exceeds the 10 MB limit.");

  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error("Evolution returned invalid media bytes.");
  }
  if (binary.length > maxBytes) throw new Error("WhatsApp media exceeds the 10 MB limit.");

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return { bytes, mimeType, extension };
}

function safeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export function buildPrivateMediaPath(
  companyId: string,
  conversationId: string,
  messageId: string,
  extension: string,
): string {
  return `companies/${safeSegment(companyId)}/conversations/${safeSegment(conversationId)}/${safeSegment(messageId)}.${safeSegment(extension)}`;
}

export async function downloadEvolutionMedia(
  instanceName: string,
  rawMessage: Record<string, unknown>,
): Promise<{ bytes: Uint8Array; mimeType: string; extension: string }> {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("EVOLUTION_GLOBAL_API_KEY");
  if (!baseUrl || !apiKey) throw new Error("WhatsApp provider is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ message: rawMessage, convertToMp4: false }),
    });
    if (!response.ok) throw new Error(`Evolution media download failed (${response.status}).`);
    return await decodeEvolutionMedia(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
