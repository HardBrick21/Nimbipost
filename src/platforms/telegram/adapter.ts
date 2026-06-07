import type { PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface TelegramAdapterOptions {
  botToken: string;
  transport?: GenericTransport;
}

export class TelegramAdapter extends HttpPlatformAdapter {
  readonly platform = 'telegram' as const;

  constructor(options: TelegramAdapterOptions) {
    super({
      baseUrl: 'https://api.telegram.org',
      transport: options.transport,
    });
    this.botToken = options.botToken;
  }

  private botToken: string;

  async getMe(): Promise<unknown> {
    return this.get(`/bot${this.botToken}/getMe`);
  }

  async getUserData(chatId: string): Promise<unknown> {
    return this.get(`/bot${this.botToken}/getChat`, { chat_id: chatId });
  }

  async getUserPosts(chatId: string | number): Promise<PaginatedResult> {
    const response = asRecord(await this.get(`/bot${this.botToken}/getChat`, {
      chat_id: String(chatId),
    }));

    return paginatedFromArray([response.result ?? response]);
  }

  async getPost(postId: string | number): Promise<unknown> {
    throw new Error(
      `Telegram Bot API does not expose arbitrary message lookup by id: ${String(postId)}`,
    );
  }
}
