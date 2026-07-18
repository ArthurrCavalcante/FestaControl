export interface NormalizedMessage {
  providerMessageId: string;
  senderId: string;
  recipientId: string;
  content: string;
  mediaType: 'TEXT' | 'AUDIO' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'LOCATION' | 'CONTACT' | 'STICKER';
  mediaUrl?: string | null;
  timestamp?: string;
  platform?: string;
}

export interface Provider {
  name: string;
  receive(req: Request, rawBody: ArrayBuffer, metadata: any): Promise<NormalizedMessage[]>;
  send(recipientId: string, content: string, metadata: any): Promise<{ providerMessageId: string }>;
}
