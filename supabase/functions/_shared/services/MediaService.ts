import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

export class MediaService {
  /**
   * Baixa uma mídia de uma URL pública ou autenticada e converte para Base64 (pronto para o Gemini).
   */
  static async downloadAndEncode(url: string, bearerToken?: string): Promise<{ base64: string, mimeType: string }> {
    const headers: Record<string, string> = {};
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
       throw new Error(`Falha ao baixar mídia da URL ${url}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = base64Encode(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    
    return { base64, mimeType };
  }
}
