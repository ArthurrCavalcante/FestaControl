import { NormalizedMessage, Provider } from './Provider.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export class WhatsAppProvider implements Provider {
  name = 'whatsapp';

  async receive(req: Request, rawBody: ArrayBuffer, metadata: any): Promise<NormalizedMessage[]> {
    try {
      const decoder = new TextDecoder('utf-8');
      const body = JSON.parse(decoder.decode(rawBody));

      if (body.object !== 'whatsapp_business_account') return [];

      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0]?.value;
      if (!changes || !changes.messages || changes.messages.length === 0) return [];

      const msg = changes.messages[0];
      const contact = changes.contacts?.[0];
      const businessMetadata = changes.metadata;

      const senderId = msg.from;
      const recipientId = businessMetadata.display_phone_number;
      const timestamp = new Date(msg.timestamp * 1000).toISOString();
      const type = msg.type;

      let content = '';
      let mediaUrl = null;
      let mediaType: NormalizedMessage['mediaType'] = 'TEXT';
      const providerMessageId = msg.id;

      if (type === 'text') {
        content = msg.text.body;
      } else if (['audio', 'image', 'document', 'sticker', 'video'].includes(type)) {
        mediaType = type.toUpperCase() as NormalizedMessage['mediaType'];
        content = `[${mediaType}]`;
        const mediaObj = msg[type];
        if (mediaObj?.id) {
          mediaUrl = await this.downloadMedia(mediaObj.id);
        }
      } else if (type === 'location') {
        mediaType = 'LOCATION';
        content = `[Localização: ${msg.location.latitude}, ${msg.location.longitude}]`;
      } else if (type === 'contacts') {
        mediaType = 'CONTACT';
        content = `[Contato compartilhado]`;
      } else {
        content = `[Mensagem não suportada: ${type}]`;
      }

      return [{
        providerMessageId,
        senderId,
        recipientId,
        content,
        mediaType,
        mediaUrl,
        timestamp,
        platform: this.name
      }];
    } catch (err) {
      console.error('Erro ao fazer parse do WhatsApp:', err);
      return [];
    }
  }

  async send(recipientId: string, content: string, metadata: any): Promise<{ providerMessageId: string }> {
    try {
      const token = metadata?.access_token || Deno.env.get('WA_ACCESS_TOKEN');
      const phoneId = metadata?.phone_number_id || Deno.env.get('WA_PHONE_NUMBER_ID');

      if (!token || !phoneId) {
        throw new Error('Credenciais WhatsApp não encontradas no metadata nem nas vars.');
      }

      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipientId,
        type: 'text',
        text: { body: content }
      };

      const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${JSON.stringify(result)}`);
      }

      return { providerMessageId: result.messages?.[0]?.id || 'unknown' };
    } catch (err) {
      console.error('Exceção ao enviar via WhatsApp:', err);
      throw err;
    }
  }

  private async downloadMedia(mediaId: string): Promise<string | null> {
    return `whatsapp_media://${mediaId}`; 
  }
}
