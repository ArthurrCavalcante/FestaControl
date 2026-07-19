import { Provider } from './Provider.ts';
import { MessengerProvider } from './messenger.ts';
import { InstagramProvider } from './instagram.ts';

export class ProviderFactory {
  // O Factory decide qual provider usar com base nos headers ou payload (usado pelo webhook)
  static getProvider(req: Request, payload?: any): Provider | null {
    if (payload?.object === 'instagram') {
      return new InstagramProvider();
    }
    
    if (payload?.object === 'whatsapp_business_account' || payload?.object === 'page') {
      return new MessengerProvider();
    }
    
    return null;
  }

  // O Factory decide qual provider usar com base no nome (usado pelo send-message)
  static getProviderByName(name: string): Provider | null {
    if (name === 'instagram') {
      return new InstagramProvider();
    }
    if (name === 'messenger' || name === 'facebook') {
      return new MessengerProvider();
    }
    return null;
  }
}
