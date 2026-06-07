import type { PaginationOptions, PaginatedResult } from '../../core/platform-adapter';
import { asRecord, HttpPlatformAdapter, paginatedFromArray, type GenericTransport } from '../common/http-adapter';

export interface RedditAdapterOptions {
  accessToken?: string;
  transport?: GenericTransport;
}

export class RedditAdapter extends HttpPlatformAdapter {
  readonly platform = 'reddit' as const;

  constructor(options: RedditAdapterOptions = {}) {
    super({
      baseUrl: 'https://oauth.reddit.com',
      accessToken: options.accessToken,
      headers: { 'User-Agent': 'Nimbipost/0.1.0' },
      transport: options.transport,
    });
  }

  async getUserData(username: string): Promise<unknown> {
    return this.get(`/user/${encodeURIComponent(username)}/about`);
  }

  async getUserPosts(userId: string | number, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.get(`/user/${encodeURIComponent(String(userId))}/submitted`, {
      after: options.endCursor,
      limit: options.total,
    }));
    const data = asRecord(response.data);
    const children = Array.isArray(data.children) ? data.children : [];

    return paginatedFromArray(
      children.map((child) => asRecord(child).data),
      typeof data.after === 'string' ? data.after : null,
    );
  }

  async getPost(postId: string | number): Promise<unknown> {
    return this.get('/api/info', { id: String(postId) });
  }

  async search(query: string, options: PaginationOptions = {}): Promise<PaginatedResult> {
    const response = asRecord(await this.get('/search', {
      q: query,
      after: options.endCursor,
      limit: options.total,
      sort: 'relevance',
    }));
    const data = asRecord(response.data);
    const children = Array.isArray(data.children) ? data.children : [];

    return paginatedFromArray(
      children.map((child) => asRecord(child).data),
      typeof data.after === 'string' ? data.after : null,
    );
  }
}
