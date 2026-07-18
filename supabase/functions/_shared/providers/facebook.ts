import { Provider, StandardizedMessage } from "./Provider.ts";

export class FacebookProvider implements Provider {
  name = 'facebook';

  async verifySignature(appSecret: string, signature: string, rawBody: ArrayBuffer): Promise<boolean> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', 
      enc.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, 
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, rawBody);
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const expectedSignature = 'sha256=' + hashHex;
    
    if (expectedSignature.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  }

  async receive(req: Request, rawBody: ArrayBuffer, metadata: any): Promise<StandardizedMessage[]> {
    const appSecret = metadata?.webhook_secret || Deno.env.get('FB_APP_SECRET');
    const signature = req.headers.get('x-hub-signature-256');

    if (!signature || !appSecret) {
      throw new Error('Missing Facebook signature or secret');
    }

    const isValid = await this.verifySignature(appSecret, signature, rawBody);
    if (!isValid) {
      throw new Error('Invalid Facebook signature');
    }

    const decoder = new TextDecoder('utf-8');
    const bodyText = decoder.decode(rawBody);
    const body = JSON.parse(bodyText);

    const messages: StandardizedMessage[] = [];

    if (body.object === 'page') {
      for (const entry of body.entry) {
        if (!entry.messaging) continue;
        
        for (const webhook_event of entry.messaging) {
          const senderId = webhook_event.sender.id;
          const recipientId = webhook_event.recipient?.id;
          
          if (webhook_event.message) {
            let content = webhook_event.message.text || '';
            const providerMessageId = webhook_event.message.mid;
            
            let mediaType: 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' = 'TEXT';
            let mediaUrl = null;

            if (webhook_event.message.attachments && webhook_event.message.attachments.length > 0) {
              const attachment = webhook_event.message.attachments[0];
              if (attachment.type === 'audio') {
                mediaType = 'AUDIO';
                mediaUrl = attachment.payload?.url;
                content = '[Áudio]';
              } else if (attachment.type === 'image') {
                mediaType = 'IMAGE';
                mediaUrl = attachment.payload?.url;
                content = '[Imagem]';
              } else if (attachment.type === 'video') {
                mediaType = 'VIDEO';
                mediaUrl = attachment.payload?.url;
                content = '[Vídeo]';
              } else {
                mediaType = 'DOCUMENT';
                mediaUrl = attachment.payload?.url;
                content = `[Arquivo: ${attachment.type}]`;
              }
            }

            if (content || mediaUrl) {
              messages.push({
                providerMessageId,
                senderId,
                recipientId,
                content,
                mediaType,
                mediaUrl
              });
            }
          }
        }
      }
    }

    return messages;
  }

  async send(recipientId: string, content: string, metadata: any): Promise<{ providerMessageId: string }> {
    const pageAccessToken = metadata?.access_token || Deno.env.get('FB_PAGE_ACCESS_TOKEN');
    
    if (!pageAccessToken) {
       throw new Error('Facebook Page Access Token not found in metadata or environment variables.');
    }

    const fbResponse = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: content }
      })
    });

    const fbResult = await fbResponse.json();

    if (!fbResponse.ok) {
      throw new Error(`Meta API error: ${fbResult.error?.message || 'Unknown error'}`);
    }

    return { providerMessageId: fbResult.message_id };
  }
}
