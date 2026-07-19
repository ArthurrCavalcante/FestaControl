import { NormalizedMessage, Provider } from './Provider.ts';

export class MessengerProvider implements Provider {
  name = 'messenger';

  async receive(req: Request, rawBody: ArrayBuffer, metadata: any): Promise<NormalizedMessage[]> {
    console.warn('MessengerProvider está dormente nesta versão.');
    return [];
  }

  async send(recipientId: string, content: string, metadata: any): Promise<{ providerMessageId: string }> {
    console.warn('MessengerProvider está dormente nesta versão.');
    throw new Error('MessengerProvider is dormant.');
  }
}
