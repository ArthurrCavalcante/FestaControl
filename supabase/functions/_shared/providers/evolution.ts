import { Provider, NormalizedMessage } from './Provider.ts';

export class EvolutionProvider implements Provider {
  name = 'evolution';

  async receive(_req: Request, rawBody: ArrayBuffer, _metadata: unknown): Promise<NormalizedMessage[]> {
      const textDecoder = new TextDecoder();
      const bodyText = textDecoder.decode(rawBody);
      const payload = JSON.parse(bodyText);

      if (payload.event !== 'messages.upsert') {
        return [];
      }

      const instance = payload.instance;
      const data = payload.data;
      
      // Evolution sometimes wraps in an array if multiple messages arrive
      const messages = Array.isArray(data) ? data : [data];
      const normalizedMessages: NormalizedMessage[] = [];

      for (const msg of messages) {
        if (!msg.key || !msg.message) continue;
        
        // Ignore system messages or broadcasts
        if (msg.key.remoteJid === 'status@broadcast') continue;

        const senderId = msg.key.remoteJid.replace('@s.whatsapp.net', '');
        const providerMessageId = msg.key.id;
        const fromMe = msg.key.fromMe || false;
        
        let content = '';
        let mediaType: NormalizedMessage['mediaType'] = 'TEXT';
        let mediaUrl = null;

        // Parse different message types
        const type = msg.messageType || Object.keys(msg.message)[0];
        
        if (type === 'conversation' || type === 'extendedTextMessage') {
          content = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        } else if (type === 'imageMessage') {
          content = msg.message.imageMessage?.caption || '📸 Imagem';
          mediaType = 'IMAGE';
          // Media URL is complex in Evolution, usually requires downloading via another endpoint
          // For now we just identify it as image.
        } else if (type === 'audioMessage') {
          content = '🎤 Áudio';
          mediaType = 'AUDIO';
        } else if (type === 'videoMessage') {
          content = msg.message.videoMessage?.caption || '🎥 Vídeo';
          mediaType = 'VIDEO';
        } else if (type === 'documentMessage') {
          content = msg.message.documentMessage?.fileName || '📄 Documento';
          mediaType = 'DOCUMENT';
        } else {
          content = '[Mensagem não suportada]';
        }

        normalizedMessages.push({
          providerMessageId,
          senderId,
          recipientId: fromMe ? senderId : instance,
          content,
          mediaType,
          mediaUrl,
          platform: 'whatsapp',
          fromMe
        });
      }

      return normalizedMessages;
  }

  async send(recipientId: string, content: string, metadata: { company_id?: string }): Promise<{ providerMessageId: string }> {
      const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
      const globalApiKey = Deno.env.get('EVOLUTION_GLOBAL_API_KEY');

      if (!evolutionUrl || !globalApiKey) {
        throw new Error("Váriaveis EVOLUTION_API_URL ou EVOLUTION_GLOBAL_API_KEY não configuradas.");
      }

      const instanceName = metadata.company_id;
      if (!instanceName) throw new Error('Evolution instance is not configured.');

      const url = `${evolutionUrl}/message/sendText/${instanceName}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': globalApiKey
        },
        body: JSON.stringify({
          number: recipientId,
          text: content,
          delay: 1200 // Optional: Human-like delay
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Falha ao enviar via Evolution API (${response.status}): ${err.slice(0, 300)}`);
      }

      const result = await response.json();
      
      return {
        providerMessageId: result.key?.id || `sent-${Date.now()}`
      };
  }
}
