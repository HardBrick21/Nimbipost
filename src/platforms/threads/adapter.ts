import type { PaginationOptions, PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface ThreadsAdapterOptions {
  accessToken: string;
  userId?: string;
  transport?: GenericTransport;
}

export class ThreadsAdapter extends HttpPlatformAdapter {
  readonly platform = 'threads' as const;
  private userId: string;

  constructor(options: ThreadsAdapterOptions) {
    super({
      baseUrl: 'https://graph.threads.net',
      accessToken: options.accessToken,
      transport: options.transport,
    });
    this.userId = options.userId ?? 'me';
  }

  async getUserData(username: string): Promise<unknown> {
    return this.get(`/v1.0/${encodeURIComponent(username)}`, {
      fields: 'id,username,threads_profile_picture_url,threads_biography',
    });
  }

  async getUserPosts(userId: string | number = this.userId, _options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.get(`/v1.0/${encodeURIComponent(String(userId))}/threads`, {
      fields: 'id,media_product_type,media_type,media_url,permalink,owner,username,text,timestamp,shortcode,thumbnail_url,children,is_quote_post,has_replies',
    }));
    const paging = asRecord(response.paging);
    const cursors = asRecord(paging.cursors);

    return paginatedFromArray(
      Array.isArray(response.data) ? response.data : [],
      typeof cursors.after === 'string' ? cursors.after : null,
    );
  }

  async getPost(postId: string | number): Promise<unknown> {
    return this.get(`/v1.0/${encodeURIComponent(String(postId))}`, {
      fields: 'id,media_product_type,media_type,media_url,permalink,owner,username,text,timestamp,shortcode,thumbnail_url,children,is_quote_post,has_replies',
    });
  }
}
