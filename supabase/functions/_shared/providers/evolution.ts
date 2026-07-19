import { NormalizedMessage, Provider } from './Provider.ts';

export class EvolutionProvider implements Provider {
  name = 'evolution';

  async receive(req: Request, rawBody: ArrayBuffer, metadata: any): Promise<NormalizedMessage[]> {
    try {
      const decoder = new TextDecoder('utf-8');
      const body = JSON.parse(decoder.decode(rawBody));

      if (body.event !== 'messages.upsert') return [];
      
      const instance = body.instance;
      const messagesData = body.data?.messages || [];
      const normalizedMessages: NormalizedMessage[] = [];

      for (const msg of messagesData) {
        // Evolution sometimes sends protocol messages we should ignore
        if (msg.message?.protocolMessage) continue;

        const remoteJid = msg.key.remoteJid;
        const fromMe = msg.key.fromMe;
        const providerMessageId = msg.key.id;
        const timestamp = msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString();

        // Extrai texto da mensagem (pode vir em vários formatos no Baileys/Evolution)
        let content = '';
        let mediaType: NormalizedMessage['mediaType'] = 'TEXT';
        let mediaUrl = null;

        const messageContent = msg.message;
        if (!messageContent) continue;

        if (messageContent.conversation) {
          content = messageContent.conversation;
        } else if (messageContent.extendedTextMessage?.text) {
          content = messageContent.extendedTextMessage.text;
        } else if (messageContent.imageMessage) {
          mediaType = 'IMAGE';
          content = messageContent.imageMessage.caption || '[Imagem]';
        } else if (messageContent.audioMessage) {
          mediaType = 'AUDIO';
          content = '[Áudio]';
        } else if (messageContent.documentMessage) {
          mediaType = 'DOCUMENT';
          content = messageContent.documentMessage.fileName || '[Documento]';
        } else if (messageContent.videoMessage) {
          mediaType = 'VIDEO';
          content = messageContent.videoMessage.caption || '[Vídeo]';
        } else if (messageContent.locationMessage) {
          mediaType = 'LOCATION';
          content = '[Localização]';
        } else if (messageContent.contactMessage) {
          mediaType = 'CONTACT';
          content = '[Contato]';
        } else if (messageContent.stickerMessage) {
          mediaType = 'STICKER';
          content = '[Figurinha]';
        } else {
          content = '[Mensagem não suportada]';
        }

        normalizedMessages.push({
          providerMessageId,
          senderId: fromMe ? instance : remoteJid, // Se fromMe, o sender é a instância
          recipientId: fromMe ? remoteJid : instance,
          content,
          mediaType,
          mediaUrl, // Media download to be implemented in phase 3
          timestamp,
          platform: this.name,
          fromMe
        });
      }

      return normalizedMessages;
    } catch (err) {
      console.error('Erro ao fazer parse do Evolution API:', err);
      return [];
    }
  }

  async send(recipientId: string, content: string, metadata: any): Promise<{ providerMessageId: string }> {
    try {
      const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
      const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');
      const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

      if (!evolutionUrl || !evolutionKey || !instanceName) {
        throw new Error('Credenciais da Evolution API não configuradas no Supabase.');
      }

      const payload = {
        number: recipientId,
        options: {
          delay: 0,
          presence: "composing"
        },
        textMessage: {
          text: content
        }
      };

      const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': evolutionKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(`Evolution API error: ${JSON.stringify(result)}`);
      }

      // Evolution retorna a key.id na resposta se configurado, ou podemos pegar do result
      return { providerMessageId: result?.key?.id || `sent-${Date.now()}` };
    } catch (err) {
      console.error('Erro ao enviar mensagem via Evolution API:', err);
      throw err;
    }
  }
}
