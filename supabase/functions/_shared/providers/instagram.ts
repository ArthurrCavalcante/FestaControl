import { NormalizedMessage, Provider } from './Provider.ts';

export class InstagramProvider implements Provider {
  name = 'instagram';

  async receive(req: Request, rawBody: ArrayBuffer, metadata: any): Promise<NormalizedMessage[]> {
    const decoder = new TextDecoder('utf-8');
    const payloadString = decoder.decode(rawBody);
    let payload;
    try {
      payload = JSON.parse(payloadString);
    } catch (e) {
      console.error('Invalid JSON in InstagramProvider receive', e);
      return [];
    }

    const messages: NormalizedMessage[] = [];

    if (payload.object === 'instagram' && payload.entry) {
      for (const entry of payload.entry) {
        if (entry.messaging) {
          for (const msgEvent of entry.messaging) {
            if (msgEvent.message && !msgEvent.message.is_echo) {
              const text = msgEvent.message.text || '';
              const messageId = msgEvent.message.mid;
              const senderId = msgEvent.sender.id;
              const recipientId = msgEvent.recipient.id;
              const timestamp = new Date(msgEvent.timestamp).toISOString();

              let mediaType: NormalizedMessage['mediaType'] = 'TEXT';
              let mediaUrl = null;

              if (msgEvent.message.attachments && msgEvent.message.attachments.length > 0) {
                const attachment = msgEvent.message.attachments[0];
                if (attachment.type === 'image') mediaType = 'IMAGE';
                else if (attachment.type === 'audio') mediaType = 'AUDIO';
                else if (attachment.type === 'video') mediaType = 'VIDEO';
                else if (attachment.type === 'file') mediaType = 'DOCUMENT';
                
                mediaUrl = attachment.payload?.url || null;
              }

              messages.push({
                providerMessageId: messageId,
                senderId: senderId,
                recipientId: recipientId,
                content: text,
                mediaType,
                mediaUrl,
                timestamp,
                platform: 'instagram',
                fromMe: false
              });
            }
          }
        }
      }
    }

    return messages;
  }

  async send(recipientId: string, content: string, metadata: any): Promise<{ providerMessageId: string }> {
    const accessToken = Deno.env.get('INSTAGRAM_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('INSTAGRAM_ACCESS_TOKEN is not configured');
    }

    // A Graph API do Instagram usa o endpoint /v19.0/me/messages (ou a versão mais atual)
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`;

    const body = {
      recipient: { id: recipientId },
      message: { text: content },
      messaging_type: 'RESPONSE'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to send Instagram message:', errorData);
      throw new Error(`Instagram API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      providerMessageId: data.message_id
    };
  }
}
