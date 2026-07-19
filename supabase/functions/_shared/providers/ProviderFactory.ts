import { Provider } from './Provider.ts';
import { EvolutionProvider } from './evolution.ts';
import { MessengerProvider } from './messenger.ts';

export class ProviderFactory {
  // O Factory decide qual provider usar com base nos headers ou payload (usado pelo webhook)
  static getProvider(req: Request, payload?: any): Provider | null {
    if (req.headers.has('x-webhook-secret')) {
      return new EvolutionProvider();
    }
    
    if (payload?.object === 'whatsapp_business_account' || payload?.object === 'page' || payload?.object === 'instagram') {
      return new MessengerProvider();
    }
    
    return null;
  }

  // O Factory decide qual provider usar com base no nome (usado pelo send-message)
  static getProviderByName(name: string): Provider | null {
    if (name === 'evolution' || name === 'whatsapp') {
      return new EvolutionProvider();
    }
    if (name === 'messenger' || name === 'facebook') {
      return new MessengerProvider();
    }
    return null;
  }
}
