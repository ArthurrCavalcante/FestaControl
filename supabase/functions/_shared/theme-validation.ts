const MAX_IMAGES = 5;
const MAX_BASE64_LENGTH = 7_000_000;

type ThemePayloadResult =
  | { ok: true; images: string[] }
  | { ok: false; status: number; error: string };

export function validateThemePayload(payload: unknown): ThemePayloadResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, status: 400, error: "Invalid image payload" };
  }

  const body = payload as { imageBase64?: unknown; imagesBase64?: unknown };
  const images = Array.isArray(body.imagesBase64)
    ? body.imagesBase64
    : body.imageBase64 === undefined
    ? []
    : [body.imageBase64];

  if (images.length === 0) return { ok: false, status: 400, error: "No images provided" };
  if (images.length > MAX_IMAGES) return { ok: false, status: 413, error: "Too many images" };
  if (images.some((image) => typeof image !== "string" || image.length === 0)) {
    return { ok: false, status: 400, error: "Invalid image payload" };
  }
  if (images.some((image) => image.length > MAX_BASE64_LENGTH)) {
    return { ok: false, status: 413, error: "Image payload too large" };
  }

  return { ok: true, images: images as string[] };
}
