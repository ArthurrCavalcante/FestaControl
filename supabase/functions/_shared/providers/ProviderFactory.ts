export interface NormalizedMessage {
  platform: string;
  sender: string;
  receiver: string;
  type: string;
  content: string;
  media?: {
    url: string;
    type: string;
  };
  timestamp: string;
  additionalData?: any;
}

export interface Provider {
  platform: string;
  receive(payload: any): Promise<NormalizedMessage | null>;
  send(params: { to: string; content: string; connectionId: string; metadata?: any }): Promise<boolean>;
}

import { FacebookProvider } from './facebook.ts';
import { WhatsAppProvider } from './whatsapp.ts';

export class ProviderFactory {
  static getProviderForPayload(payload: any): Provider | null {
    if (payload.object === 'whatsapp_business_account') {
      return new WhatsAppProvider();
    }
    
    if (payload.object === 'page' || payload.object === 'instagram') {
      return new FacebookProvider();
    }
    
    return null;
  }
}
