import type { PaginationOptions, PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface InstagramAdapterOptions {
  accessToken: string;
  userId?: string;
  graphVersion?: string;
  transport?: GenericTransport;
}

export class InstagramAdapter extends HttpPlatformAdapter {
  readonly platform = 'instagram' as const;
  private userId: string;
  private graphVersion: string;

  constructor(options: InstagramAdapterOptions) {
    super({
      baseUrl: 'https://graph.instagram.com',
      accessToken: options.accessToken,
      transport: options.transport,
    });
    this.userId = options.userId ?? 'me';
    this.graphVersion = options.graphVersion ?? 'v19.0';
  }

  async getUserData(username: string = this.userId): Promise<unknown> {
    return this.get(`/${this.graphVersion}/${encodeURIComponent(username)}`, {
      fields: 'id,username,account_type,media_count',
    });
  }

  async getUserPosts(userId: string | number = this.userId, _options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.get(`/${this.graphVersion}/${encodeURIComponent(String(userId))}/media`, {
      fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
    }));
    const paging = asRecord(response.paging);
    const cursors = asRecord(paging.cursors);

    return paginatedFromArray(
      Array.isArray(response.data) ? response.data : [],
      typeof cursors.after === 'string' ? cursors.after : null,
    );
  }

  async getPost(postId: string | number): Promise<unknown> {
    return this.get(`/${this.graphVersion}/${encodeURIComponent(String(postId))}`, {
      fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
    });
  }
}
