import { NormalizedMessage, Provider } from './Provider.ts';

export class MessengerProvider implements Provider {
  name = 'messenger';

  async receive(_req: Request, _rawBody: ArrayBuffer, _metadata: unknown): Promise<NormalizedMessage[]> {
    console.warn('MessengerProvider está dormente nesta versão.');
    return [];
  }

  async send(_recipientId: string, _content: string, _metadata: unknown): Promise<{ providerMessageId: string }> {
    console.warn('MessengerProvider está dormente nesta versão.');
    throw new Error('MessengerProvider is dormant.');
  }
}
